import { describe, expect, it } from "vitest";
import { refinedMarks, scaleCrop } from "@/lib/plans/measure";
import { applyMeasure, applyTrace, decodeToolInput, mergeReading, traceFloor, traceScale } from "@/lib/plans/trace";
import { introducedWarnings } from "@/lib/plans/design";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { hasDesignReferences } from "@/lib/sources/schema";

const size = { width: 1836, height: 2376 };
const plan: PlanDocument = {
  schemaVersion: 1, source: { name: "west-L3.pdf", format: "pdf", page: 1, pages: 1, ...size },
  preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
  lines: [], texts: [], warnings: [], method: "preview",
};
const trace = { summary: "Level", uncertainties: [], walls: [{ a: { x: 0.1, y: 0.1 }, b: { x: 0.9, y: 0.1 } }] };
// A vertical 0–15 m bar spanning 200.5 px of a 1836 × 2376 page (Moscone West L3).
const bar = { a: { x: 291 / 1836, y: 56 / 2376 }, b: { x: 291 / 1836, y: 256.5 / 2376 }, meters: 15, evidence: "0–15 m scale bar" };

describe("Muse scale and floor measurement", () => {
  it("derives the whole drawing extent from a measured reference like a two-point calibration", () => {
    expect(traceScale(plan, bar)).toEqual({ widthMeters: 137.36, heightMeters: 177.76, evidence: "0–15 m scale bar" });
    expect(traceScale(plan, { ...bar, b: { x: bar.a.x, y: bar.a.y + 0.005 } })).toBeNull();
    expect(traceScale(plan, { ...bar, meters: 5000 })).toBeNull();
    expect(traceScale(plan, undefined)).toBeNull();
  });
  it("confirms Muse-measured scale with its evidence and keeps a user-confirmed scale", () => {
    const measured = applyTrace(plan, trace, { scale: bar, notes: [] });
    expect(PlanDocumentSchema.parse(measured)).toMatchObject({ widthMeters: 137.36, heightMeters: 177.76, scaleConfirmed: true, scaleSource: "muse", scaleEvidence: "0–15 m scale bar" });
    expect(measured.warnings.some(warning => warning.includes("0–15 m scale bar"))).toBe(true);
    const user = { ...plan, widthMeters: 90, heightMeters: 63, scaleConfirmed: true, scaleSource: "user" as const };
    expect(applyTrace(user, trace, { scale: bar, notes: [] })).toMatchObject({ widthMeters: 90, heightMeters: 63, scaleSource: "user" });
    expect(applyTrace(plan, trace, null).scaleConfirmed).toBe(false);
  });
  it("accepts only a simple floor outline and never replaces a reviewed one", () => {
    const outline = [{ x: 0.2, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.8 }, { x: 0.2, y: 0.8 }];
    expect(traceFloor(outline)).toEqual(outline);
    expect(traceFloor([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBeNull();
    expect(applyTrace(plan, trace, { floorBoundary: outline, notes: [] }).floorBoundary).toEqual(outline);
    const reviewed = [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }];
    expect(applyTrace({ ...plan, floorBoundary: reviewed }, trace, { floorBoundary: outline, notes: [] }).floorBoundary).toEqual(reviewed);
  });
  it("maps zoomed bar readings back to page marks, averaging them and rejecting outliers", () => {
    const estimate = { ...bar, a: { x: 0.142, y: 0.021 }, b: { x: 0.142, y: 0.109 } };
    const box = scaleCrop(size, estimate);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBe(0);
    const reading = (top: number, bottom: number) => ({ left: (286 - box.left) / box.width, right: (306 - box.left) / box.width, top: (top - box.top) / box.height, bottom: (bottom - box.top) / box.height });
    const marks = refinedMarks(size, box, [reading(54, 258), reading(58, 255), reading(20, 330)], estimate)!;
    expect((marks.b.y - marks.a.y) * size.height).toBeCloseTo(200.5, 0);
    expect(marks.a.x * size.width).toBeCloseTo(296, 0);
    expect(refinedMarks(size, box, [reading(20, 400)], estimate)).toBeNull();
  });
  it("decodes stringified tool arguments before validation", () => {
    expect(decodeToolInput({ walls: JSON.stringify(trace.walls), summary: "[draft] Level" })).toEqual({ walls: trace.walls, summary: "[draft] Level" });
    expect(applyTrace(plan, { ...trace, walls: JSON.stringify(trace.walls) }).lines).toHaveLength(1);
  });
  it("starts automatic design only with selected brand URLs or reference images", () => {
    const base = { version: 1 as const, drawingSelected: true };
    const brand = { id: "b", kind: "brand" as const, name: "Instagram", selected: true, url: "https://www.instagram.com/", text: "", notes: "", images: [] };
    expect(hasDesignReferences({ ...base, items: [brand] })).toBe(true);
    expect(hasDesignReferences({ ...base, items: [{ ...brand, selected: false }] })).toBe(false);
    expect(hasDesignReferences({ ...base, items: [{ ...brand, kind: "brief", url: undefined }] })).toBe(false);
    expect(hasDesignReferences({ ...base, items: [{ ...brand, kind: "concept", url: undefined, images: ["data:image/png;base64,AA=="] }] })).toBe(true);
  });
  it("merges reading steps without overwriting scale or floor the user set meanwhile", () => {
    const walls = applyTrace(plan, trace);
    const measured = applyMeasure(walls, { scale: bar, floorBoundary: [{ x: .2, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .8 }], notes: [] });
    const userScaled = { ...plan, widthMeters: 90, heightMeters: 63, scaleConfirmed: true, scaleSource: "user" as const };
    const merged = mergeReading(mergeReading(userScaled, "walls", walls), "measured", measured);
    expect(merged).toMatchObject({ widthMeters: 90, heightMeters: 63, scaleSource: "user", method: "muse" });
    expect(merged.lines).toHaveLength(1);
    expect(merged.floorBoundary).toHaveLength(3);
    expect(mergeReading(walls, "measured", measured)).toMatchObject({ widthMeters: 137.36, scaleSource: "muse" });
    expect(applyMeasure(walls, null)).toBe(walls);
  });
  it("reports only geometry problems an operation adds", () => {
    const scaled = PlanDocumentSchema.parse({ ...plan, widthMeters: 20, heightMeters: 20, scaleConfirmed: true });
    const stage = { id: "stage", kind: "stage" as const, label: "Stage", x: .5, y: .5, width: 4, depth: 3, height: 1, rotation: 0 as const, color: "#335577" };
    const one = { ...scaled, objects: [stage] };
    const two = { ...scaled, objects: [stage, { ...stage, id: "second", label: "Second" }] };
    expect(introducedWarnings(scaled, one)).toEqual([]);
    expect(introducedWarnings(one, two).join(" ")).toContain("overlaps");
    expect(introducedWarnings(two, two)).toEqual([]);
  });
});
