import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";

/** Original schematic example: no third-party venue assets or generated model output. */
export function boothExample(): PlanDocument {
  return PlanDocumentSchema.parse({
    schemaVersion: 1,
    source: { name: "Brand space design example", format: "image", page: 1, pages: 1, width: 1200, height: 800 },
    preview: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    widthMeters: 18, heightMeters: 12, scaleConfirmed: true,
    method: "opencv", lines: [], texts: [], objects: [],
    warnings: ["Hand-made demo example. Not a real venue drawing or a verified construction result."],
    wallHeight: 3, floorBoundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    zones: [
      { id: "booth-a1", label: "A1 · Brand showcase", purpose: "booth", assignable: true, x: .22, y: .25, width: 4, depth: 3, rotation: 0 },
      { id: "booth-a2", label: "A2 · Experience booth", purpose: "booth", assignable: true, x: .62, y: .25, width: 4, depth: 3, rotation: 0 },
      { id: "booth-b1", label: "B1 · Partner booth", purpose: "booth", assignable: true, x: .22, y: .75, width: 3, depth: 3, rotation: 0 },
      { id: "booth-b2", label: "B2 · Pop-up booth", purpose: "booth", assignable: true, x: .62, y: .75, width: 3, depth: 3, rotation: 0 },
      { id: "main-aisle", label: "Shared aisle", purpose: "circulation", assignable: false, x: .5, y: .5, width: 16, depth: 2, rotation: 0 },
    ],
  });
}
