import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockLayout, mockSimulate } from "@/lib/engine/mock";
import type { SimulateRequestInput } from "@/lib/engine/contract";
import { project } from "./helpers";

function body(): SimulateRequestInput {
  const p = project();
  return {
    venue: p.venue,
    booths: p.booths,
    layout: mockLayout({ venue: p.venue, booths: p.booths }).layout,
    scenario: { kind: "entry", agents: 120, duration_s: 120, seed: 3 },
  };
}

const post = async (b: unknown, query = "") => {
  const { POST } = await import("@/app/api/trajectories/route");
  return POST(new Request(`http://localhost/api/trajectories${query}`, { method: "POST", body: JSON.stringify(b) }));
};

describe("POST /api/trajectories (mock engine)", () => {
  beforeEach(() => {
    vi.stubEnv("ENGINE_MOCK", "1");
    vi.stubEnv("LIVE_AGENT", "on");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("proxies to the engine and returns trajectories with the SimResult's run_id", async () => {
    const b = body();
    const res = await post(b, `?expect=${mockSimulate(b).run_id}`);
    expect(res.status).toBe(200);
    const t = await res.json();
    expect(t.run_id).toBe(mockSimulate(b).run_id);
    expect(t.frames).toBe(241);
    expect(t.agents.length).toBeGreaterThan(100);
  });

  it("rejects bad bodies, run mismatches and oversized scenarios", async () => {
    expect((await post({ nope: 1 })).status).toBe(400);
    expect((await post(body(), "?expect=S-other")).status).toBe(409);
    vi.stubEnv("TRAJECTORY_MAX_AGENTS", "50");
    expect((await post(body())).status).toBe(400);
  });

  it("is off when live runs are disabled", async () => {
    vi.stubEnv("LIVE_AGENT", "off");
    const res = await post(body());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("live_disabled");
  });
});
