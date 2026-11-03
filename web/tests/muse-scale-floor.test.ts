import { describe, expect, it } from "vitest";
import { applyFloor, applyTrace, decodeToolInput, mergeReading, traceFloor } from "@/lib/plans/trace";
import { introducedWarnings } from "@/lib/plans/design";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { hasDesignReferences } from "@/lib/sources/schema";

const size = { width: 1836, height: 2376 };
const plan: PlanDocument = {
  schemaVersion: 1, source: { name: "west-L3.pdf", format: "pdf", page: 1, pages: 1, ...size },
  preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
  lines: [], texts: [], warnings: [], method: "preview",
};
// A vertical 0–15 m bar spanning 200.5 px of a 1836 × 2376 page (Moscone West L3).
const bar = { source: "scale-bar" as const, label: "0–15 m", value: 15, unit: "m" as const, a: { x: 291 / 1836, y: 56 / 2376 }, b: { x: 291 / 1836, y: 256.5 / 2376 } };
// The same bar after a successful zoomed tick fit; only code sets `refined`.
const refinedBar = { ...bar, refined: true };
const trace = (scaleEvidence: unknown[] = []) => ({ summary: "Level", uncertainties: [], scaleEvidence, walls: [{ a: { x: 0.1, y: 0.1 }, b: { x: 0.9, y: 0.1 } }] });
const outline = [{ x: 0.2, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.8 }, { x: 0.2, y: 0.8 }];

describe("Muse scale confirmation and floor outline", () => {
  it("confirms scale only from a cross-checked printed length and records its evidence", () => {
    const measured = PlanDocumentSchema.parse(applyTrace(plan, trace([refinedBar])));
    expect(measured).toMatchObject({ widthMeters: 137.4, heightMeters: 177.8, scaleConfirmed: true, scaleSource: "muse" });
    expect(measured.scaleEvidence).toContain("0–15 m");
    expect(measured.warnings.some(warning => warning.startsWith("Muse set the scale"))).toBe(true);
    // One unchecked reading stays an estimate; two agreeing dimension lines are confirmed.
    expect(applyTrace(plan, trace([bar]))).toMatchObject({ widthMeters: 137.4, scaleConfirmed: false });
    const across = { source: "dimension" as const, label: "26.0 m", value: 26, unit: "m" as const, a: { x: 0.1, y: 0.9 }, b: { x: 0.1 + 26 / 137.36, y: 0.9 } };
    const down = { source: "dimension" as const, label: "15.0 m", value: 15, unit: "m" as const, a: { x: 0.05, y: 0.1 }, b: { x: 0.05, y: 0.1 + 15 / 177.76 } };
    expect(applyTrace(plan, trace([across, down]))).toMatchObject({ scaleConfirmed: true, scaleSource: "muse" });
  });
  it("keeps area, module and disagreeing references as estimates for the user to confirm", () => {
    const booth = { source: "module" as const, label: "10 ft booth", value: 10, unit: "ft" as const, a: { x: 0.1, y: 0.5 }, b: { x: 0.3, y: 0.5 } };
    expect(applyTrace(plan, trace([booth]))).toMatchObject({ scaleConfirmed: false });
    const disagreeing = { ...bar, label: "0–15 m (second)", b: { x: bar.b.x, y: 300 / 2376 } };
    expect(applyTrace(plan, trace([bar, disagreeing]))).toMatchObject({ scaleConfirmed: false });
    expect(applyTrace(plan, trace()).scaleConfirmed).toBe(false);
  });
  it("accepts only a simple floor outline and never replaces a reviewed one", () => {
    expect(traceFloor(outline)).toEqual(outline);
    expect(traceFloor([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBeNull();
    expect(applyFloor(plan, { floorBoundary: outline, notes: [] }).floorBoundary).toEqual(outline);
    const reviewed = [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }];
    expect(applyFloor({ ...plan, floorBoundary: reviewed }, { floorBoundary: outline, notes: [] }).floorBoundary).toEqual(reviewed);
    expect(applyFloor(plan, null)).toBe(plan);
  });
  it("merges reading steps without overwriting scale or floor the user set meanwhile", () => {
    const walls = applyTrace(plan, trace([refinedBar]));
    const floored = applyFloor(walls, { floorBoundary: outline, notes: [] });
    const userScaled = { ...plan, widthMeters: 90, heightMeters: 63, scaleConfirmed: true, scaleSource: "user" as const, floorBoundary: outline.slice(0, 3) };
    const merged = mergeReading(mergeReading(userScaled, "walls", walls), "floor", floored);
    expect(merged).toMatchObject({ widthMeters: 90, heightMeters: 63, scaleSource: "user", method: "muse" });
    expect(merged.lines).toHaveLength(1);
    expect(merged.floorBoundary).toHaveLength(3);
    expect(mergeReading(mergeReading(plan, "walls", walls), "floor", floored)).toMatchObject({ widthMeters: 137.4, scaleSource: "muse", floorBoundary: outline });
  });
  it("decodes stringified tool arguments before validation", () => {
    const walls = trace().walls;
    expect(decodeToolInput({ walls: JSON.stringify(walls), summary: "[draft] Level" })).toEqual({ walls, summary: "[draft] Level" });
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
  it("starts automatic design only with selected brand URLs or reference images", () => {
    const base = { version: 1 as const, drawingSelected: true };
    const brand = { id: "b", kind: "brand" as const, name: "Instagram", selected: true, url: "https://www.instagram.com/", text: "", notes: "", images: [] };
    expect(hasDesignReferences({ ...base, items: [brand] })).toBe(true);
    expect(hasDesignReferences({ ...base, items: [{ ...brand, selected: false }] })).toBe(false);
    expect(hasDesignReferences({ ...base, items: [{ ...brand, kind: "brief", url: undefined }] })).toBe(false);
    expect(hasDesignReferences({ ...base, items: [{ ...brand, kind: "concept", url: undefined, images: ["data:image/png;base64,AA=="] }] })).toBe(true);
  });
});
