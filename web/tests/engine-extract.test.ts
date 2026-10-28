import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpEngine, EngineError } from "@/server/engine/client";
import { POST as extract } from "@/app/api/plans/extract/route";
import { POST as pdf } from "@/app/api/sources/pdf/route";

const plan = {
  schemaVersion: 1, source: { name: "hall.pdf", format: "pdf", page: 1, pages: 2, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
  lines: [], texts: [{ id: "label", text: "Hall", x: 0, y: 0 }], warnings: [], method: "pdf-vector",
};
const file = () => new File(["%PDF-test"], "hall.pdf", { type: "application/pdf" });
function upload() {
  const body = new FormData(); body.set("file", file());
  return new Request("http://localhost/upload", { method: "POST", body });
}
afterEach(() => vi.unstubAllGlobals());

describe("shared extraction transport", () => {
  it("sends multipart without a JSON content type and validates the response", async () => {
    const transport = vi.fn(async () => Response.json(plan));
    const engine = createHttpEngine({ baseUrl: "http://engine/", fetch: transport });
    expect((await engine.extract(file(), 2)).source.name).toBe("hall.pdf");
    const [url, options] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://engine/plans/extract");
    expect(options.headers).toBeUndefined();
    expect((options.body as FormData).get("page")).toBe("2");
    expect(options.cache).toBe("no-store");
  });
  it("propagates caller cancellation to the underlying upload", async () => {
    const controller = new AbortController();
    const transport = vi.fn((_url: unknown, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason));
    }));
    const pending = createHttpEngine({ fetch: transport }).extract(file(), 1, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(EngineError);
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it("maps a bad engine success payload to 502 and preserves engine input errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ invalid: true })));
    expect((await extract(upload())).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "Bad page" }, { status: 422 })));
    const response = await extract(upload());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Bad page" });
  });
  it("uses the same client for each page of a planning PDF", async () => {
    const transport = vi.fn(async (_url: unknown, options?: RequestInit) => {
      const page = Number((options!.body as FormData).get("page"));
      return Response.json({ ...plan, source: { ...plan.source, page } });
    });
    vi.stubGlobal("fetch", transport);
    const response = await pdf(upload());
    expect(response.status).toBe(200);
    expect((await response.json()).previews).toHaveLength(2);
    expect(transport.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8000/plans/extract", "http://localhost:8000/plans/extract",
    ]);
  });
  it("stops before fetching more pages when a PDF exceeds the page limit", async () => {
    const transport = vi.fn(async () => Response.json({ ...plan, source: { ...plan.source, pages: 13 } }));
    vi.stubGlobal("fetch", transport);
    expect((await pdf(upload())).status).toBe(422);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
