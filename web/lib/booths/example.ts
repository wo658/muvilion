import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";

/** Original schematic example: no third-party venue assets or generated model output. */
export function boothExample(): PlanDocument {
  return PlanDocumentSchema.parse({
    schemaVersion: 1,
    source: { name: "참가 부스 체험 공간", format: "image", page: 1, pages: 1, width: 1200, height: 800 },
    preview: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    widthMeters: 18, heightMeters: 12, scaleConfirmed: true,
    method: "opencv", lines: [], texts: [], objects: [],
    warnings: ["직접 제작한 체험용 예시입니다. 실제 행사장 도면이나 시공 검증 결과가 아닙니다."],
    wallHeight: 3, floorBoundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    zones: [
      { id: "booth-a1", label: "A1 · 브랜드 쇼케이스", purpose: "booth", assignable: true, x: .22, y: .25, width: 4, depth: 3, rotation: 0 },
      { id: "booth-a2", label: "A2 · 체험 부스", purpose: "booth", assignable: true, x: .62, y: .25, width: 4, depth: 3, rotation: 0 },
      { id: "booth-b1", label: "B1 · 파트너 부스", purpose: "booth", assignable: true, x: .22, y: .75, width: 3, depth: 3, rotation: 0 },
      { id: "booth-b2", label: "B2 · 팝업 부스", purpose: "booth", assignable: true, x: .62, y: .75, width: 3, depth: 3, rotation: 0 },
      { id: "main-aisle", label: "공용 동선", purpose: "circulation", assignable: false, x: .5, y: .5, width: 16, depth: 2, rotation: 0 },
    ],
  });
}
