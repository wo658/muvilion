import { z } from "zod";
import { DesignObjectSchema, PlanDocumentSchema, type DesignObject, type PlanDocument } from "@/lib/plans/schema";
import { designWarnings } from "@/lib/plans/design";

export const BoothBoundsSchema = z.object({
  id: z.string().min(1), name: z.string().min(1).max(255),
  width: z.number().positive().max(100), depth: z.number().positive().max(100),
  maxHeight: z.number().positive().max(30),
});
export type BoothBounds = z.infer<typeof BoothBoundsSchema>;
export const BoothObjectsSchema = z.array(DesignObjectSchema).max(80);
const EMPTY_PREVIEW = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

/** Every participant works in their own local rectangle; parent venue data is never mutable here. */
export function createBoothDocument(bounds: BoothBounds, objects: DesignObject[] = []): PlanDocument {
  const booth = BoothBoundsSchema.parse(bounds);
  return PlanDocumentSchema.parse({
    schemaVersion: 1,
    source: { name: booth.name, format: "image", page: 1, pages: 1, width: booth.width * 100, height: booth.depth * 100 },
    preview: EMPTY_PREVIEW, widthMeters: booth.width, heightMeters: booth.depth, scaleConfirmed: true,
    lines: [], texts: [], warnings: [], method: "opencv", visualStyle: "exhibition",
    floorBoundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    wallHeight: booth.maxHeight, objects,
  });
}

/** Shared deterministic guard used by model tools AND the persistence boundary. */
export function validateBoothDesign(bounds: BoothBounds, input: unknown): string[] {
  const parsed = BoothObjectsSchema.safeParse(input);
  if (!parsed.success) return ["설치물 형식, 크기 또는 좌표가 올바르지 않습니다."];
  const objects = parsed.data;
  if (new Set(objects.map(object => object.id)).size !== objects.length) return ["설치물 ID가 중복되었습니다."];
  const issues = objects.flatMap(object => [
    ...((object.elevation ?? 0) + object.height > bounds.maxHeight + 1e-6 ? [`${object.label}: 부스의 최대 높이 ${bounds.maxHeight}m를 초과합니다.`] : []),
    ...(object.zoneId ? [`${object.label}: 다른 공간 구역을 참조할 수 없습니다.`] : []),
  ]);
  const document = createBoothDocument(bounds, objects);
  return [...issues, ...designWarnings(document)];
}

export function sanitizeBoothDocument(bounds: BoothBounds, input: unknown): PlanDocument {
  const parsed = PlanDocumentSchema.parse(input);
  const issues = validateBoothDesign(bounds, parsed.objects ?? []);
  if (issues.length) throw new Error(issues.join("\n"));
  return createBoothDocument(bounds, parsed.objects ?? []);
}

export function boothHandoff(document: PlanDocument, notes: string[] = []) {
  return {
    status: "concept" as const,
    items: (document.objects ?? []).map(object => ({
      label: object.label, kind: object.kind, quantity: 1,
      width: object.width, depth: object.depth, height: object.height,
    })),
    notes: [
      "시공 협의를 위한 컨셉 자료입니다. 구조·전기·소방·리깅 검토와 시공 견적은 별도 확인이 필요합니다.",
      ...notes.slice(0, 12),
    ],
  };
}

/** Submission must match a successfully checked candidate, never merely claim it passed. */
export function createBoothReviewSession(bounds: BoothBounds) {
  let checked: string | null = null;
  let accepted: DesignObject[] | null = null;
  return {
    validate(objects: DesignObject[]) {
      const issues = validateBoothDesign(bounds, objects);
      checked = issues.length ? null : JSON.stringify(objects);
      return { valid: issues.length === 0, issues };
    },
    submit(objects: DesignObject[]) {
      const issues = validateBoothDesign(bounds, objects);
      if (issues.length) return { accepted: false, issues };
      if (checked !== JSON.stringify(objects)) return { accepted: false, issues: ["Call validate_booth_design on this exact candidate before submitting."] };
      accepted = structuredClone(objects);
      return { accepted: true, issues: [] as string[] };
    },
    result() { return accepted ? structuredClone(accepted) : null; },
  };
}

/** An organizer explicitly imports a submitted local design into the current venue. */
export function importBoothDesignIntoVenue(
  venue: PlanDocument, booth: BoothBounds & { zoneId: string }, applicationId: string, objects: DesignObject[],
): PlanDocument {
  if (!venue.scaleConfirmed || !venue.widthMeters || !venue.heightMeters) throw new Error("전체 공간의 축척을 먼저 확정해 주세요.");
  if (!/^[a-zA-Z0-9-]{1,60}$/.test(applicationId)) throw new Error("신청 ID가 올바르지 않습니다.");
  const zone = venue.zones?.find(item => item.id === booth.zoneId);
  if (!zone || !zone.assignable || Math.abs(zone.width - booth.width) > 1e-6 || Math.abs(zone.depth - booth.depth) > 1e-6)
    throw new Error("공개한 부스의 구역 또는 크기가 변경되었습니다. 원래 구역을 확인해 주세요.");
  const issues = validateBoothDesign(booth, objects);
  if (issues.length) throw new Error(issues.join("\n"));
  const prefix = `participant-${applicationId}-`;
  const imported: DesignObject[] = objects.map((object, index) => {
    const dx = (object.x - 0.5) * booth.width, dy = (object.y - 0.5) * booth.depth;
    return {
      ...object, id: `${prefix}${index}`, label: `${booth.name} · ${object.label}`.slice(0, 100), zoneId: zone.id,
      x: zone.x + (zone.rotation === 90 ? -dy : dx) / venue.widthMeters!,
      y: zone.y + (zone.rotation === 90 ? dx : dy) / venue.heightMeters!,
      rotation: ((object.rotation + zone.rotation) % 180) as 0 | 90,
    };
  });
  const next = PlanDocumentSchema.parse({ ...venue, objects: [...(venue.objects ?? []).filter(object => !object.id.startsWith(prefix)), ...imported] });
  const labels = imported.map(object => object.label);
  const conflicts = designWarnings(next).filter(warning => labels.some(label => warning.includes(label)));
  if (conflicts.length) throw new Error(conflicts.join("\n"));
  return next;
}
