import { afterEach, describe, expect, it, vi } from "vitest";
import { applyRefinement, applyTrace, needsRefinement, refinementWindow, scaleFromEvidence, traceLines, type ScaleEvidence } from "@/lib/plans/trace";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";

const trace = vi.hoisted(() => ({ available: true, run: vi.fn(), prepare: vi.fn() }));
vi.mock("@/server/plans/prepare", () => ({ preparePages: trace.prepare }));
import { PlanServiceError } from "@/server/plans/errors";
vi.mock("@/server/plans/trace", () => ({ museTracingAvailable: () => trace.available, traceWalls: trace.run }));
import { POST as extract } from "@/app/api/plans/extract/route";

const plan: PlanDocument = {
  schemaVersion: 1, source: { name: "hall.pdf", format: "pdf", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
  lines: [{ id: "v1", a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, kind: "unknown", origin: "vector", confidence: 1 }],
  texts: [], warnings: [], method: "pdf-vector",
};
function upload(name = "hall.pdf") {
  const body = new FormData(); body.set("file", new File(["%PDF-test"], name));
  return new Request("http://localhost/upload", { method: "POST", body });
}
afterEach(() => { vi.unstubAllGlobals(); trace.run.mockReset(); trace.available = true; });

describe("Muse wall tracing", () => {
  it("squares nearly axis-aligned walls, clamps to the frame and drops degenerate segments", () => {
    const lines = traceLines({ walls: [
      { a: { x: 0.1, y: 0.2 }, b: { x: 0.9, y: 0.205 } },
      { a: { x: -0.1, y: 0.5 }, b: { x: 0.5, y: 1.2 } },
      { a: { x: 0.3, y: 0.3 }, b: { x: 0.301, y: 0.301 } },
    ] });
    expect(lines).toHaveLength(2);
    expect(lines[0].a.y).toBe(lines[0].b.y);
    expect(lines[1].a.x).toBe(0);
    expect(lines[1].b.y).toBe(1);
    expect(lines.every(line => line.kind === "wall" && line.origin === "ai")).toBe(true);
  });
  it("replaces extracted lines and keeps a computed scale unconfirmed", () => {
    const traced = applyTrace(plan, { summary: "Hall", uncertainties: ["Door widths unclear"],
      scaleEvidence: [{ source: "dimension", label: "171m", value: 171, unit: "m", a: { x: 0.1, y: 0.9 }, b: { x: 0.955, y: 0.9 } }],
      walls: [{ a: { x: 0.1, y: 0.1 }, b: { x: 0.9, y: 0.1 } }] });
    expect(PlanDocumentSchema.parse(traced).method).toBe("muse");
    expect(traced.lines.map(line => line.id)).toEqual(["muse-1"]);
    expect(traced).toMatchObject({ widthMeters: 200, heightMeters: 200, scaleConfirmed: false });
    expect(traced.warnings[1]).toContain("a dimension line (171m)");
    expect(traced.warnings).toContain("Door widths unclear");
    const unscaled = applyTrace(plan, { summary: "Hall", uncertainties: [], walls: [{ a: { x: 0.1, y: 0.1 }, b: { x: 0.9, y: 0.1 } }] });
    expect(unscaled.widthMeters).toBeNull();
    expect(unscaled.warnings[1]).toContain("No scale reference");
  });
  it("prefers long stated lengths, then areas, then module assumptions", () => {
    const wide = { ...plan, source: { ...plan.source, width: 200, height: 100 } };
    const bar: ScaleEvidence = { source: "scale-bar", label: "0-15m", value: 15, unit: "m", a: { x: 0.1, y: 0.1 }, b: { x: 0.175, y: 0.1 } };
    const overall: ScaleEvidence = { source: "dimension", label: "100 m", value: 100, unit: "m", a: { x: 0, y: 0.5 }, b: { x: 0.5, y: 0.5 } };
    const hall: ScaleEvidence = { source: "area-label", label: "Hall W4 154,200 ft2", value: 154200, unit: "ft2", polygon: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }] };
    const booth: ScaleEvidence = { source: "module", label: "10 ft booth", value: 10, unit: "ft", a: { x: 0, y: 0 }, b: { x: 0.1, y: 0 } };
    expect(scaleFromEvidence(wide, [booth, hall, bar])).toMatchObject({ source: "scale-bar", widthMeters: 200, heightMeters: 100 });
    expect(scaleFromEvidence(wide, [bar, overall])).toMatchObject({ source: "dimension", widthMeters: 200 });
    // 154,200 ft2 = 14,325.6 m2 over a 100 x 100 px hall.
    expect(scaleFromEvidence(wide, [booth, hall])).toMatchObject({ source: "area-label", widthMeters: 239.4, heightMeters: 119.7 });
    expect(scaleFromEvidence(wide, [booth])).toMatchObject({ source: "module", widthMeters: 30.5 });
    expect(scaleFromEvidence(wide, [{ ...bar, unit: "m2" }, { ...hall, polygon: hall.polygon!.slice(0, 2) }])).toBeNull();
  });
  it("re-reads short references on a zoomed crop and fits every labelled tick", () => {
    const bar: ScaleEvidence = { source: "scale-bar", label: "0-15m", value: 15, unit: "m", a: { x: 0.2, y: 0.1 }, b: { x: 0.2, y: 0.2 } };
    expect(needsRefinement(bar, 612, 792)).toBe(true);
    expect(needsRefinement({ ...bar, b: { x: 0.2, y: 0.9 } }, 612, 792)).toBe(false);
    const window = refinementWindow(bar, 612, 792);
    expect(window.y).toBeLessThan(0.1);
    expect(window.y + window.height).toBeGreaterThan(0.2);
    // Ticks at 0/5/10/15 m every 0.2 of the crop height, with the 10 m tick misplaced slightly.
    const refined = applyRefinement(bar, window, { found: true, ticks: [
      { value: 0, x: 0.5, y: 0.2 }, { value: 5, x: 0.5, y: 0.4 }, { value: 10, x: 0.5, y: 0.62 }, { value: 15, x: 0.5, y: 0.8 }] });
    const span = (refined.b!.y - refined.a!.y) / window.height;
    expect(span).toBeGreaterThan(0.59);
    expect(span).toBeLessThan(0.62);
    expect(applyRefinement(bar, window, { found: false, ticks: [] })).toBe(bar);
    expect(applyRefinement(bar, window, { found: true, ticks: [{ value: 0, x: 0.5, y: 0.2 }] })).toBe(bar);
  });
  it.each(["hall.pdf", "hall.png", "hall.jpg"])("reads %s with Muse and never falls back to locally extracted geometry", async name => {
    trace.prepare.mockResolvedValue([{ ...plan, lines: [], method: "preview" }]);
    trace.run.mockResolvedValueOnce({ ...plan, method: "muse" });
    expect((await (await extract(upload(name))).json()).method).toBe("muse");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    trace.run.mockRejectedValue(new PlanServiceError("Model failed", 502));
    const response = await extract(upload(name));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Model failed" });
  });
  it("retries a failed Muse reading once before surfacing the error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    trace.prepare.mockResolvedValue([{ ...plan, lines: [], method: "preview" }]);
    trace.run.mockRejectedValueOnce(new Error("no tool call")).mockResolvedValueOnce({ ...plan, method: "muse" });
    expect((await (await extract(upload())).json()).method).toBe("muse");
    expect(trace.run).toHaveBeenCalledTimes(2);
    trace.run.mockReset().mockRejectedValue(new PlanServiceError("Model failed", 502));
    expect((await extract(upload())).status).toBe(502);
    expect(trace.run).toHaveBeenCalledTimes(2);
  });
  it("rejects DXF through the upload API before rendering or calling Muse", async () => {
    trace.prepare.mockClear();
    const response = await extract(upload("legacy.DXF"));
    expect(response.status).toBe(415);
    expect((await response.json()).error).toContain("Export CAD drawings to PDF");
    expect(trace.prepare).not.toHaveBeenCalled();
    expect(trace.run).not.toHaveBeenCalled();
  });
  it("keeps a source preview available without a model key and never fabricates geometry", async () => {
    trace.available = false;
    trace.prepare.mockResolvedValue([{ ...plan, lines: [], method: "preview" }]);
    const result = await (await extract(upload())).json();
    expect(result.method).toBe("preview");
    expect(result.lines).toEqual([]);
    expect(result.warnings.join(' ')).toContain('Source preview only');
    expect(trace.run).not.toHaveBeenCalled();
  });
  it("preserves rendering limitations and model-read text without confirming scale", () => {
    const result = applyTrace({ ...plan, warnings: ["Unsupported CAD annotation"] }, { summary: "Read", walls: [], uncertainties: ["No walls"], texts: [{ text: "회의실", x: .2, y: .3 }] });
    expect(result.warnings).toContain("Unsupported CAD annotation");
    expect(result.texts[0]).toMatchObject({ text: "회의실", x: .2, y: .3 });
    expect(result.scaleConfirmed).toBe(false);
  });
});
