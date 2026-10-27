import { describe, expect, it } from "vitest";
import { createHttpEngine, EngineError } from "@/lib/engine/client";

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("HTTP engine client", () => {
  it("parses valid responses and fills contract defaults", async () => {
    const e = createHttpEngine({ baseUrl: "http://x", fetch: json({ ok: true, violations: [{ rule_id: "wall_margin", severity: "warning", message: "m" }] }) });
    const r = await e.validate({ venue: { id: "v", name: "v", width: 1, height: 1, doors: [{ id: "d", kind: "entrance", a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }] }, layout: { id: "l", venue_id: "v", booths: [] } });
    expect(r.violations[0]).toMatchObject({ booth_ids: [], location: null, source: "internal:geometry" });
  });

  it("rejects responses that break the contract", async () => {
    const e = createHttpEngine({ baseUrl: "http://x", fetch: json({ ok: "yes", violations: [] }) });
    await expect(e.queue({ arrivals_per_min: 1, service_time_s: 1, servers: 1 })).rejects.toBeInstanceOf(EngineError);
  });

  it("surfaces HTTP errors with status and body", async () => {
    const e = createHttpEngine({ baseUrl: "http://x", fetch: json({ detail: "bad" }, 422) });
    await expect(e.health()).rejects.toMatchObject({ status: 422, endpoint: "/health" });
  });

  it("times out", async () => {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(init.signal!.reason)))) as unknown as typeof fetch;
    const e = createHttpEngine({ baseUrl: "http://x", timeoutMs: 20, fetch: hang });
    await expect(e.queue({ arrivals_per_min: 1, service_time_s: 1, servers: 1 })).rejects.toThrow(/timed out/);
  });
});
