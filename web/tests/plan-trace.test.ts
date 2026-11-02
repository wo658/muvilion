import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTrace, traceLines } from "@/lib/plans/trace";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";

const trace = vi.hoisted(() => ({ available: true, run: vi.fn(), prepare: vi.fn(), measure: vi.fn(async () => null) }));
vi.mock("@/server/plans/prepare", () => ({ preparePages: trace.prepare }));
import { PlanServiceError } from "@/server/plans/errors";
vi.mock("@/server/plans/trace", () => ({ museTracingAvailable: () => trace.available, traceWalls: trace.run }));
vi.mock("@/server/plans/measure", () => ({ measureDrawing: trace.measure }));
import { readReadingStream } from "@/lib/plans/reading-stream";
import { POST as extract } from "@/app/api/plans/extract/route";

const plan: PlanDocument = {
  schemaVersion: 1, source: { name: "hall.pdf", format: "pdf", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
  lines: [{ id: "v1", a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, kind: "unknown", origin: "vector", confidence: 1 }],
  texts: [], warnings: [], method: "pdf-vector",
};
function upload(name = "hall.pdf", headers: Record<string, string> = {}) {
  const body = new FormData(); body.set("file", new File(["%PDF-test"], name));
  return new Request("http://localhost/upload", { method: "POST", body, headers });
}
afterEach(() => { vi.unstubAllGlobals(); trace.run.mockReset(); trace.available = true; });

describe("Muse wall tracing", () => {
  it("squares nearly axis-aligned walls, clamps to the frame and drops degenerate segments", () => {
    const lines = traceLines({ summary: "s", uncertainties: [], walls: [
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
  it("replaces extracted lines and keeps an estimated scale unconfirmed", () => {
    const traced = applyTrace(plan, { summary: "Hall", uncertainties: ["Door widths unclear"], widthMeters: 40, heightMeters: 30,
      walls: [{ a: { x: 0.1, y: 0.1 }, b: { x: 0.9, y: 0.1 } }] });
    expect(PlanDocumentSchema.parse(traced).method).toBe("muse");
    expect(traced.lines.map(line => line.id)).toEqual(["muse-1"]);
    expect(traced).toMatchObject({ widthMeters: 40, heightMeters: 30, scaleConfirmed: false });
    expect(traced.warnings).toContain("Door widths unclear");
  });
  it.each(["hall.pdf", "hall.png", "hall.dxf"])("reads %s with Muse and never falls back to locally extracted geometry", async name => {
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
  it("streams preview, walls and measured scale/floor as separate committed steps", async () => {
    const preview = { ...plan, lines: [], method: "preview" as const };
    trace.prepare.mockResolvedValue([preview]);
    trace.run.mockResolvedValueOnce({ ...preview, method: "muse", lines: plan.lines });
    const outline = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }];
    trace.measure.mockResolvedValueOnce({ scale: { a: { x: .1, y: .5 }, b: { x: .3, y: .5 }, meters: 10, evidence: "0–10 m scale bar" }, floorBoundary: outline, notes: [] } as never);
    const steps: string[] = [];
    let last: PlanDocument | undefined;
    await readReadingStream(await extract(upload("hall.pdf", { Accept: "application/x-ndjson" })), (type, document) => { steps.push(type); last = document; });
    expect(steps).toEqual(["preview", "walls", "measured"]);
    expect(last).toMatchObject({ method: "muse", widthMeters: 50, heightMeters: 50, scaleConfirmed: true, scaleSource: "muse", floorBoundary: outline });
  });
  it("keeps the committed preview when wall reading fails later in the stream", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    trace.prepare.mockResolvedValue([{ ...plan, lines: [], method: "preview" }]);
    trace.run.mockRejectedValue(new PlanServiceError("Model failed", 502));
    const steps: string[] = [];
    await expect(readReadingStream(await extract(upload("hall.pdf", { Accept: "application/x-ndjson" })), type => steps.push(type))).rejects.toThrow("Model failed");
    expect(steps).toEqual(["preview"]);
  });
});
