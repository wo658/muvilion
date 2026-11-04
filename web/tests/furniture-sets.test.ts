import { describe, expect, it } from "vitest";
import { expandFurnitureSet, FURNITURE_SET_TYPES, type FurnitureSet } from "@/lib/plans/furniture-sets";
import { applyDesignPatch, partitionDesignPatch } from "@/lib/plans/design-stream";
import { designWarnings } from "@/lib/plans/design";
import { reviewUsability } from "@/lib/plans/usability";
import { PlanDocumentSchema } from "@/lib/plans/schema";

const base = PlanDocumentSchema.parse({ schemaVersion: 1, source: { name: "hall", format: "pdf", page: 1, pages: 1, width: 100, height: 100 }, preview: "data:image/png;base64,AA==", widthMeters: 20, heightMeters: 20, scaleConfirmed: true, lines: [], texts: [], warnings: [], method: "pdf-vector", floorBoundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] });
const patch = { label: "Sets", objects: [], zones: [], removeObjects: [], removeZones: [] };
const stage = { id: "stage", kind: "stage" as const, label: "Stage", x: .5, y: .25, width: 6, depth: 3, height: .6, rotation: 0 as const, color: "#335577" };
const set = (type: FurnitureSet["type"], rotation: FurnitureSet["rotation"]): FurnitureSet => ({ type, id: "s", label: "Set", x: .5, y: .5, rotation, color: "#c08040", ...(type === "audience-rows" ? { targetId: "stage", count: 4 } : {}) });

describe("furniture sets", () => {
  // Layout-dependent checks (aisles, approach) are excluded; the set itself must be usable as placed.
  const local = ["seat_target", "seat_facing", "seat_reach", "table_height", "seat_clearance", "row_legroom", "unsupported_seating"];
  for (const type of FURNITURE_SET_TYPES) for (const rotation of [0, 90, 180, 270] as const) it(`${type} at ${rotation}° is valid by construction`, () => {
    const audience = type === "audience-rows";
    // Audience rows face north, so the stage must be north of them after rotation.
    const target = audience ? { ...stage, ...[{ x: .5, y: .25 }, { x: .75, y: .5 }, { x: .5, y: .75 }, { x: .25, y: .5 }][rotation / 90], rotation: (rotation % 180 === 0 ? 0 : 90) as 0 | 90 } : null;
    const doc = applyDesignPatch({ ...base, objects: target ? [target] : [] }, { ...patch, sets: [set(type, rotation)] });
    expect(designWarnings(doc)).toEqual([]);
    expect(reviewUsability(doc).issues.filter(issue => local.includes(issue.code))).toEqual([]);
  });
  it("reports a footprint that contains every object and turns with the set", () => {
    const north = expandFurnitureSet(base, set("meeting-4", 0)), east = expandFurnitureSet(base, set("meeting-4", 90));
    expect(north.footprint.depth).toBeCloseTo(east.footprint.width);
    for (const o of north.objects) { expect(o.x).toBeGreaterThanOrEqual(north.footprint.x0); expect(o.x).toBeLessThanOrEqual(north.footprint.x1); }
    expect(north.objects.map(o => o.id)).toEqual(["s-table", "s-chair-s1", "s-chair-n1", "s-chair-s2", "s-chair-n2"]);
  });
  it("saves or holds a set whole and removes it by set ID", () => {
    const blocker = { id: "box", kind: "furniture" as const, label: "Box", x: .5, y: .5, width: 1, depth: 1, height: 1, rotation: 0 as const, color: "#335577" };
    const result = partitionDesignPatch({ ...base, objects: [blocker] }, { ...patch, sets: [set("meeting-4", 0), { ...set("lounge-pair", 0), id: "l", x: .2, y: .2 }] });
    expect(result.held).toEqual([{ kind: "set", id: "s", label: "Set" }]);
    expect(result.draft.objects?.filter(o => o.id.startsWith("s-"))).toEqual([]);
    expect(result.draft.objects?.filter(o => o.id.startsWith("l-"))).toHaveLength(3);
    expect(applyDesignPatch(result.draft, { ...patch, removeSets: ["l"] }).objects?.map(o => o.id)).toEqual(["box"]);
    expect(() => applyDesignPatch(result.draft, { ...patch, removeSets: ["missing"] })).toThrow("Unknown set ID");
  });
});
