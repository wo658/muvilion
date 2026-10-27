import { z } from "zod";
import { ProjectInput, Scenario } from "@/lib/engine/contract";

const Point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const Box = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().positive().max(1), h: z.number().positive().max(1) }).refine((r) => r.x + r.w <= 1.000001 && r.y + r.h <= 1.000001);
export type PlanPoint = z.infer<typeof Point>;
export type PlanBox = z.infer<typeof Box>;
export const Mark = z.object({ id: z.string(), kind: z.enum(["obstacle", "keepout", "entrance", "exit"]), a: Point, b: Point });
export type PlanMark = z.infer<typeof Mark>;
export const Draft = z.object({
  version: z.literal(1), id: z.string().uuid(), name: z.string().max(120), updatedAt: z.string().datetime(),
  step: z.number().int().min(0).max(3), setting: z.enum(["indoor", "outdoor"]),
  source: z.object({ name: z.string(), type: z.enum(["application/pdf", "image/png", "image/jpeg"]), page: z.number().int().positive(), pages: z.number().int().positive(), width: z.number().positive(), height: z.number().positive(), preview: z.string().startsWith("data:image/png;base64,") }).nullable(),
  boundary: Box, width: z.number().positive().max(1000), height: z.number().positive().max(1000),
  scaleConfirmed: z.boolean(), spaceConfirmed: z.boolean(), marks: z.array(Mark).max(500),
  booths: z.number().int().min(1).max(200), boothWidth: z.number().min(1).max(30), boothDepth: z.number().min(1).max(30),
  aisle: z.number().min(1.2).max(10), scenario: Scenario,
});
export type ProjectDraft = z.infer<typeof Draft>;
export type StoredProject = { draft: ProjectDraft; file: Blob | null };

export function newProject(): ProjectDraft {
  return { version: 1, id: crypto.randomUUID(), name: "새 행사 프로젝트", updatedAt: new Date().toISOString(), step: 0, setting: "indoor", source: null,
    boundary: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, width: 60, height: 40, scaleConfirmed: false, spaceConfirmed: false, marks: [],
    booths: 20, boothWidth: 3, boothDepth: 3, aisle: 3, scenario: { kind: "browse", agents: 200, duration_s: 300, seed: 42 } };
}

export function boxFromPoints(a: PlanPoint, b: PlanPoint): PlanBox {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function calibratedSize(draft: ProjectDraft, a: PlanPoint, b: PlanPoint, meters: number) {
  const pw = draft.source?.width ?? 1200, ph = draft.source?.height ?? 800;
  const length = Math.hypot((a.x - b.x) * pw, (a.y - b.y) * ph);
  if (length < 2 || !Number.isFinite(meters) || meters <= 0) throw new Error("두 점과 실제 거리를 확인해 주세요.");
  return { width: Math.round(draft.boundary.w * pw / length * meters * 100) / 100, height: Math.round(draft.boundary.h * ph / length * meters * 100) / 100 };
}

/** Snap both endpoints to the same nearest boundary edge. */
export function doorOnBoundary(a: PlanPoint, b: PlanPoint, r: PlanBox): [PlanPoint, PlanPoint] {
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const edges = [Math.abs(cx - r.x), Math.abs(cx - r.x - r.w), Math.abs(cy - r.y), Math.abs(cy - r.y - r.h)];
  const edge = edges.indexOf(Math.min(...edges));
  return [a, b].map((p) => edge < 2
    ? { x: r.x + (edge === 1 ? r.w : 0), y: clamp(p.y, r.y, r.y + r.h) }
    : { x: clamp(p.x, r.x, r.x + r.w), y: r.y + (edge === 3 ? r.h : 0) }) as [PlanPoint, PlanPoint];
}

export function spaceErrors(d: ProjectDraft): string[] {
  const errors: string[] = [];
  if (!d.scaleConfirmed) errors.push("실제 치수를 확인해 주세요.");
  if (!d.marks.some((m) => m.kind === "entrance")) errors.push("외곽선에 입구를 하나 이상 표시해 주세요.");
  if (!d.marks.some((m) => m.kind === "exit")) errors.push("외곽선에 출구를 하나 이상 표시해 주세요.");
  if (!d.spaceConfirmed) errors.push("도면과 공간 표시를 확인해 주세요.");
  return errors;
}

export function projectInput(d: ProjectDraft): ProjectInput {
  const errors = spaceErrors(d);
  if (errors.length) throw new Error(errors[0]);
  const point = (p: PlanPoint) => ({ x: Math.round((p.x - d.boundary.x) / d.boundary.w * d.width * 1000) / 1000, y: Math.round((1 - (p.y - d.boundary.y) / d.boundary.h) * d.height * 1000) / 1000 });
  const polygon = (m: PlanMark) => {
    const r = boxFromPoints(m.a, m.b);
    return [point({ x: r.x, y: r.y }), point({ x: r.x + r.w, y: r.y }), point({ x: r.x + r.w, y: r.y + r.h }), point({ x: r.x, y: r.y + r.h })];
  };
  return ProjectInput.parse({
    venue: { id: d.id, name: d.name, setting: d.setting, width: d.width, height: d.height,
      doors: d.marks.filter((m) => m.kind === "entrance" || m.kind === "exit").map((m) => ({ id: m.id, kind: m.kind, a: point(m.a), b: point(m.b) })),
      obstacles: d.marks.filter((m) => m.kind === "obstacle").map((m) => ({ id: m.id, kind: "structure", polygon: polygon(m) })),
      zones: d.marks.filter((m) => m.kind === "keepout").map((m) => ({ id: m.id, kind: "queue_area", buildable: false, polygon: polygon(m) })), unknowns: [] },
    booths: Array.from({ length: d.booths }, (_, i) => ({ id: `booth-${i + 1}`, label: `부스 ${i + 1}`, w: d.boothWidth, h: d.boothDepth, popularity: 0.5, kind: "booth" })),
    constraints: { min_aisle_width: d.aisle },
  });
}

export const STEP_LABELS = ["도면 등록", "공간 확인", "행사 조건", "검토 및 분석"] as const;
