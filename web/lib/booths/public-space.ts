import type { PlanDocument } from "@/lib/plans/schema";

export function publicSpace(document: PlanDocument): PlanDocument {
  return {
    schemaVersion: 1, preview: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    source: { name: "공개 공간", format: document.source.format, page: 1, pages: 1, width: document.source.width, height: document.source.height },
    widthMeters: document.widthMeters, heightMeters: document.heightMeters,
    scaleConfirmed: document.scaleConfirmed, method: document.method,
    lines: document.lines.filter(line => line.kind === "wall"), texts: [], warnings: [],
    floorBoundary: document.floorBoundary, wallHeight: document.wallHeight,
    ceiling: document.ceiling, walkStart: document.walkStart,
    entrances: document.entrances, zones: document.zones, objects: document.objects,
  };
}
