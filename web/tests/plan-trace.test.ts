import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTrace, traceLines } from "@/lib/plans/trace";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";

const trace = vi.hoisted(() => ({ available: true, run: vi.fn() }));
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
  it("traces uploaded PDFs and falls back to extracted lines when Muse fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(plan)));
    trace.run.mockResolvedValueOnce({ ...plan, method: "muse", lines: [] });
    expect((await (await extract(upload())).json()).method).toBe("muse");
    trace.run.mockRejectedValueOnce(new Error("timeout"));
    const fallback = await (await extract(upload())).json();
    expect(fallback.lines).toEqual(plan.lines);
    expect(fallback.warnings[0]).toContain("Muse could not trace");
  });
  it("leaves images and unconfigured Muse on the engine path", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...plan, source: { ...plan.source, format: "image" }, method: "opencv" })));
    expect((await (await extract(upload("hall.png"))).json()).method).toBe("opencv");
    trace.available = false;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(plan)));
    expect((await (await extract(upload())).json()).method).toBe("pdf-vector");
    expect(trace.run).not.toHaveBeenCalled();
  });
});
