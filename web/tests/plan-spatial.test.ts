import { describe, expect, it } from "vitest";
import { designWarnings, footprintFitsBoundary } from "@/lib/plans/design";
import { PlanDocumentSchema, type PlanDocument, type DesignObject, type SpaceZone } from "@/lib/plans/schema";
import { cropEvidence } from "@/lib/plans/crop";
import { canStand } from "@/lib/plans/walk";
const object: DesignObject = { id: "a", kind: "equipment", label: "Display", x: .5, y: .5, width: 2, depth: 2, height: 2, rotation: 0, color: "#ffffff" };
const zone: SpaceZone = { id: "zone", label: "Experience", purpose: "experience", x: .5, y: .5, width: 6, depth: 6, rotation: 0, assignable: false };
const doc: PlanDocument = { schemaVersion: 1, source: { name: "x", format: "image", page: 1, pages: 1, width: 100, height: 100 }, preview: "data:image/png;base64,AA==", widthMeters: 10, heightMeters: 10, scaleConfirmed: true, lines: [], texts: [], warnings: [], method: "opencv", objects: [object] };
describe("space model and vertical geometry", () => {
  it("loads old documents without inventing a ceiling or elevation", () => {
    const restored = PlanDocumentSchema.parse(doc);
    expect(restored.ceiling).toBeUndefined(); expect(restored.objects![0].elevation).toBeUndefined();
    expect(PlanDocumentSchema.safeParse({ ...doc, ceiling: { height: 0, status: "confirmed", color: "#ffffff" } }).success).toBe(false);
    expect(PlanDocumentSchema.safeParse({ ...doc, objects: [{ ...object, elevation: -1 }] }).success).toBe(false);
  });
  it("checks vertical overlap instead of treating all projected footprints as collisions", () => {
    const upper: DesignObject = { ...object, id: "b", kind: "hanging-sign", label: "Sign", elevation: 3, height: 1 };
    expect(designWarnings({ ...doc, objects: [object, upper] })).toEqual([]);
    expect(designWarnings({ ...doc, objects: [object, { ...upper, elevation: 1.5 }] })).toContain("Display overlaps Sign.");
    expect(designWarnings({ ...doc, objects: [object, { ...upper, elevation: 2 }] })).toEqual([]);
  });
  it("checks ceiling and source wall limits using bottom plus height", () => {
    const elevated = { ...object, elevation: 3, height: 1 };
    const room = { ...doc, objects: [elevated], ceiling: { height: 3.5, status: "estimated" as const, color: "#ffffff" }, lines: [{ id: "wall", a: { x: 0, y: .5 }, b: { x: 1, y: .5 }, kind: "wall" as const, origin: "vector" as const, confidence: 1 }] };
    expect(designWarnings(room)).toEqual(["Display exceeds the estimated ceiling height (3.5 m)."]);
    expect(designWarnings({ ...room, wallHeight: 5 })).toContain("Display intersects a classified wall line.");
  });
  it("treats zones as nonsolid allocations and checks assigned containment", () => {
    expect(designWarnings({ ...doc, zones: [zone], objects: [{ ...object, zoneId: zone.id }] })).toEqual([]);
    expect(designWarnings({ ...doc, zones: [zone], objects: [{ ...object, zoneId: zone.id, x: .8 }] })).toContain("Display extends outside its assigned space (Experience).");
    expect(designWarnings({ ...doc, objects: [{ ...object, zoneId: "missing" }] })).toContain("Display references a missing space.");
  });
  it("detects a concave notch crossing an object even when all corners are inside", () => {
    const boundary = [{ x: 0, y: 0 }, { x: .4, y: 0 }, { x: .4, y: .6 }, { x: .6, y: .6 }, { x: .6, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    expect(footprintFitsBoundary({ x: .2, y: .2, width: .6, height: .6 }, boundary)).toBe(false);
    expect(footprintFitsBoundary({ x: 0, y: .7, width: 1, height: .3 }, boundary)).toBe(true);
    expect(designWarnings({ ...doc, floorBoundary: boundary })).toContain("Display extends outside the reviewed floor boundary.");
  });
  it("lets walkers pass elevated signs but blocks low overhead objects", () => {
    const room = { width: 10, depth: 10, walls: [], objects: [{ ...object, kind: "beam" as const, elevation: 2 }] };
    expect(canStand({ x: 5, y: 5 }, room)).toBe(true);
    expect(canStand({ x: 5, y: 5 }, { ...room, objects: [{ ...room.objects[0], elevation: 1.7 }] })).toBe(false);
  });
  it("blocks circulation only for physical objects within walking height", () => {
    const path = { ...zone, purpose: "circulation" as const };
    expect(designWarnings({ ...doc, zones: [path] })).toContain("Display obstructs a circulation space.");
    expect(designWarnings({ ...doc, zones: [path], objects: [{ ...object, elevation: 3 }] })).toEqual([]);
  });
  it("rejects low ceiling walking even with no objects and reports its clearance", () => {
    expect(canStand({ x: 5, y: 5 }, { width: 10, depth: 10, walls: [], objects: [], ceilingHeight: 1.7 })).toBe(false);
    expect(canStand({ x: 5, y: 5 }, { width: 10, depth: 10, walls: [], objects: [], ceilingHeight: 1.8 })).toBe(true);
    expect(designWarnings({ ...doc, objects: [], ceiling: { height: 1.7, status: "confirmed", color: "#ffffff" } })).toContain("Ceiling clearance is below the 1.8 m walking body height.");
  });
  it("clears spatial design scope after cropping and rejects duplicate IDs", () => {
    const input = { ...doc, zones: [zone], wallHeight: 5, ceiling: { height: 6, status: "confirmed" as const, color: "#ffffff" } };
    const cropped = cropEvidence(input, { x: .1, y: .1, width: .8, height: .8 });
    expect(cropped.zones).toEqual([]); expect(cropped.ceiling).toBeUndefined(); expect(cropped.wallHeight).toBeUndefined();
    expect(PlanDocumentSchema.safeParse({ ...doc, zones: [zone, zone] }).success).toBe(false);
    expect(PlanDocumentSchema.safeParse({ ...doc, objects: [object, object] }).success).toBe(false);
  });
});
