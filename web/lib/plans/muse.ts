import { z } from "zod";
import { DesignObjectSchema, ZoneSchema, PlanDocumentSchema, type PlanDocument } from "./schema";
import { designWarnings } from "./design";

/** Muse can label observed geometry; it cannot invent coordinates or confirm dimensions. */
export const PlanInterpretation = z.object({
  summary: z.string().min(1).max(2000),
  classifications: z.array(z.object({
    id: z.string().min(1).max(100),
    kind: z.enum(["wall", "dimension", "unknown"]),
    confidence: z.number().min(0).max(1),
  })).max(600),
  uncertainties: z.array(z.string().max(300)).max(12),
});
export type PlanInterpretation = z.infer<typeof PlanInterpretation>;

export function interpretationEvidence(document: PlanDocument) {
  if (document.lines.filter(line => line.kind === "unknown").length > 600) throw new Error("Split this drawing into regional batches before interpretation.");
  return {
    source: document.source,
    coordinates: "Normalized 0..1; origin top-left; x right, y down. The image and line coordinates share this frame.",
    scaleConfirmed: document.scaleConfirmed,
    widthMeters: document.widthMeters,
    heightMeters: document.heightMeters,
    lines: document.lines.filter((line) => line.kind === "unknown"),
    texts: document.texts.slice(0, 200),
  };
}

export function applyInterpretation(document: PlanDocument, input: unknown): PlanDocument {
  const interpretation = PlanInterpretation.parse(input);
  const allowed = new Set(interpretationEvidence(document).lines.map((line) => line.id));
  const updates = new Map<string, PlanInterpretation["classifications"][number]>();
  for (const item of interpretation.classifications) {
    if (!allowed.has(item.id)) throw new Error("Muse returned an ID outside the supplied evidence.");
    if (updates.has(item.id)) throw new Error("Muse returned duplicate classifications.");
    updates.set(item.id, item);
  }
  return {
    ...document,
    lines: document.lines.map((line) => {
      const update = updates.get(line.id);
      // Low-confidence guesses remain unclassified for human review.
      return update && update.confidence >= 0.7 ? { ...line, kind: update.kind, confidence: update.confidence } : line;
    }),
    warnings: [...new Set([...document.warnings, "Muse classifications are suggestions; review them against the source drawing.", ...interpretation.uncertainties])].slice(0, 40),
  };
}

/** No preview bytes in ordinary chat; no claim of seeing an image it did not receive. */
export function planChatContext(document: Omit<PlanDocument, "preview"> | null) {
  if (!document) return { state: "No drawing uploaded" };
  return {
    source: document.source,
    method: document.method,
    scaleConfirmed: document.scaleConfirmed,
    widthMeters: document.widthMeters,
    heightMeters: document.heightMeters,
    coordinates: "x/y are normalized plan centres, origin top-left; width/depth/height/elevation are metres. Elevation is the object bottom above floor; top = elevation + height.",
    floorBoundary: document.floorBoundary ?? null,
    entrances: document.entrances ?? [],
    zones: document.zones ?? [],
    ceiling: document.ceiling ?? null,
    wallHeight: document.wallHeight ?? null,
    heightStatus: document.ceiling?.status ?? "unknown",
    visibilityPolicy: "All physical elements are supplied regardless of 3D display toggles; hiding never removes a height or collision constraint.",
    objects: document.objects ?? [],
    lineCounts: {
      total: document.lines.length,
      walls: document.lines.filter((line) => line.kind === "wall").length,
      dimensions: document.lines.filter((line) => line.kind === "dimension").length,
      unknown: document.lines.filter((line) => line.kind === "unknown").length,
    },
    lines: document.lines.slice(0, 180),
    linesTruncated: document.lines.length > 180,
    texts: document.texts.slice(0, 100),
    warnings: document.warnings,
  };
}






export const PlanDesignProposal = z.object({
  summary: z.string().min(1).max(2000),
  zones: z.array(ZoneSchema).max(80).optional().describe("Complete proposed space-zone list. Omit to preserve existing zones; [] explicitly clears them. Zones do not create walls."),
  objects: z.array(DesignObjectSchema).max(80),
  assumptions: z.array(z.string().max(300)).max(12),
});

export function applyDesignProposal(document: PlanDocument, input: unknown): PlanDocument {
  if (!document.scaleConfirmed || !document.widthMeters || !document.heightMeters)
    throw new Error("Confirm the drawing scale before drafting a layout.");
  const proposal = PlanDesignProposal.parse(input);
  if (new Set(proposal.objects.map(object => object.id)).size !== proposal.objects.length)
    throw new Error("Design object IDs must be unique.");
  if (proposal.zones && new Set(proposal.zones.map(zone => zone.id)).size !== proposal.zones.length)
    throw new Error("Space zone IDs must be unique.");
  const zones = proposal.zones ?? document.zones;
  const zoneIds = new Set(zones?.map(zone => zone.id));
  if (proposal.objects.some(object => object.zoneId && !zoneIds.has(object.zoneId)))
    throw new Error("Design object references an unknown space zone.");
  // Only editable design collections may be replaced. Source, floor and height review stay intact.
  const objects = proposal.objects.map(object => {
    const previous = document.objects?.find(item => item.id === object.id);
    const shape = { ...object }; delete shape.provenance;
    const previousShape = previous ? { ...previous } : undefined;
    if (previousShape) delete previousShape.provenance;
    const unchanged = previousShape && Object.keys(shape).length === Object.keys(previousShape).length && Object.entries(shape).every(([key, value]) => previousShape[key as keyof typeof previousShape] === value);
    return { ...shape, provenance: unchanged ? previous?.provenance : "ai" as const };
  });
  const next = PlanDocumentSchema.parse({ ...document, zones, objects });
  return {
    ...next,
    warnings: [...new Set([...document.warnings, "Muse layout is a concept, not a verified construction or safety plan.", ...proposal.assumptions, ...designWarnings(next)])].slice(0, 100),
  };
}
