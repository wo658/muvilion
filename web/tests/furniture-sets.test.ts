import { describe, expect, it } from "vitest";
import { expandFurnitureSet, FURNITURE_SET_TYPES, type FurnitureSet } from "@/lib/plans/furniture-sets";
import { applyDesignPatch, partitionDesignPatch } from "@/lib/plans/design-stream";
import { designWarnings } from "@/lib/plans/design";
import { reviewUsability } from "@/lib/plans/usability";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { reviewDesignCoverage } from "@/lib/plans/design-review";

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
  it("connects every seat when circulation zones cover the suggested access strips", () => {
    for (const type of ["meeting-4", "counter-bar", "lounge-pair"] as const) for (const rotation of [0, 90] as const) {
      const { access } = expandFurnitureSet(base, set(type, rotation));
      const strips = type === "lounge-pair" ? access.slice(0, 1) : access;
      // Each strip is extended across the floor and joined by one spine, so the zones form one network.
      const across = (a: typeof access[number]) => a.side === "north" || a.side === "south"
        ? { x: .5, y: (a.y0 + a.y1) / 2, width: 20, depth: (a.y1 - a.y0) * 20 } : { x: (a.x0 + a.x1) / 2, y: .5, width: (a.x1 - a.x0) * 20, depth: 20 };
      const vertical = strips[0].side === "east" || strips[0].side === "west";
      const zones = [...strips.map((a, i) => ({ id: `a${i}`, label: `Aisle ${i}`, purpose: "circulation" as const, ...across(a), rotation: 0 as const, assignable: false })),
        { id: "spine", label: "Spine", purpose: "circulation" as const, ...(vertical ? { x: .5, y: .04, width: 20, depth: 1.5 } : { x: .04, y: .5, width: 1.5, depth: 20 }), rotation: 0 as const, assignable: false }];
      const doc = applyDesignPatch(base, { ...patch, zones, sets: [set(type, rotation)] });
      expect(reviewUsability(doc).issues.filter(issue => issue.code === "seat_access").map(issue => `${type}@${rotation} ${issue.objectId}`)).toEqual([]);
    }
  });
  it("brings its own aisles, so a route just past any edge connects every seat", () => {
    for (const type of ["meeting-4", "counter-bar", "lounge-pair", "consult-desk"] as const) for (const rotation of [0, 90, 180, 270] as const) {
      const { footprint, zones } = expandFurnitureSet(base, set(type, rotation));
      expect(zones.length).toBeGreaterThan(0);
      // Set aisles run 1.2 m past the footprint, so a spine touching its east or south edge meets them.
      const sideways = type === "lounge-pair" ? rotation % 180 === 0 : rotation % 180 !== 0;
      const spine = sideways ? { x: .5, y: footprint.y1 + .0376, width: 20, depth: 1.5 } : { x: footprint.x1 + .0376, y: .5, width: 1.5, depth: 20 };
      const doc = applyDesignPatch(base, { ...patch, zones: [{ id: "spine", label: "Spine", purpose: "circulation" as const, ...spine, rotation: 0 as const, assignable: false }], sets: [set(type, rotation)] });
      expect(reviewUsability(doc).issues.filter(issue => ["seat_access", "disconnected_routes"].includes(issue.code)).map(issue => `${type}@${rotation} ${issue.code} ${issue.objectId ?? ""}`)).toEqual([]);
    }
  });
  it("stops a set aisle short of a neighbour so the set is not held for obstructing it", () => {
    const free = expandFurnitureSet(base, set("meeting-4", 0)).zones[0];
    const neighbour = { id: "plinth", kind: "furniture" as const, label: "Plinth", x: free.x + (free.width / 2 - .4) / 20, y: free.y, width: .5, depth: .5, height: 1, rotation: 0 as const, color: "#335577" };
    const clipped = expandFurnitureSet({ ...base, objects: [neighbour] }, set("meeting-4", 0)).zones[0];
    expect(clipped.width).toBeLessThan(free.width);
    expect(designWarnings(applyDesignPatch({ ...base, objects: [neighbour] }, { ...patch, sets: [set("meeting-4", 0)] }))).toEqual([]);
  });
  it("counts a set ID in coverage as its objects of the required kinds", () => {
    const doc = applyDesignPatch(base, { ...patch, sets: [set("meeting-4", 0)] });
    const brief = { scope: "interior" as const, direction: "Meetings", requirements: [{ id: "seats", label: "Seats", target: "objects" as const, kinds: ["furniture" as const], minimum: 5 }] };
    expect(reviewDesignCoverage(brief, doc, [{ requirementId: "seats", ids: ["s"], decision: "One meeting set." }]).requirements[0]).toMatchObject({ count: 5, satisfied: true, invalidIds: [] });
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
