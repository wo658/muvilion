import { describe, expect, it } from "vitest";
import { createHttpEngine, EngineError } from "@/lib/engine/client";
import { Trajectories, type Layout, type SimulateRequestInput } from "@/lib/engine/contract";
import { mockLayout, mockSimulate } from "@/lib/engine/mock";
import { mockTrajectories } from "@/lib/engine/mock-trajectories";
import { boothRect, polygonBBox, rectContainsPoint } from "@/lib/geometry";
import { countPresent, frameAt, sampleTrack, trajectoryDuration, trackLength } from "@/lib/trajectory/playback";
import { project } from "./helpers";

function simRequest(seed = 42, agents = 200, layout?: Layout): SimulateRequestInput {
  const p = project();
  return {
    venue: p.venue,
    booths: p.booths,
    layout: layout ?? mockLayout({ venue: p.venue, booths: p.booths }).layout,
    scenario: { kind: "entry", agents, duration_s: 300, seed },
  };
}

describe("trajectory contract + client", () => {
  const good = { run_id: "S-1", layout_id: "L-1", dt: 0.5, frames: 3, agents: [{ id: 0, t0: 1, xy: [0, 0, 1, 1] }] };
  it("parses valid trajectories and rejects malformed ones", () => {
    expect(Trajectories.parse(good).agents[0].t0).toBe(1);
    expect(Trajectories.safeParse({ ...good, agents: [{ id: 0.5, t0: 0, xy: [] }] }).success).toBe(false);
    expect(Trajectories.safeParse({ ...good, frames: undefined }).success).toBe(false);
  });

  it("POSTs /trajectories and validates the response", async () => {
    let url = "";
    const fetch = (async (u: string) => ((url = u), new Response(JSON.stringify(good)))) as unknown as typeof globalThis.fetch;
    const t = await createHttpEngine({ baseUrl: "http://x", fetch }).trajectories(simRequest());
    expect(url).toBe("http://x/trajectories");
    expect(t.run_id).toBe("S-1");
    const bad = (async () => new Response(JSON.stringify({ ...good, dt: "x" }))) as unknown as typeof globalThis.fetch;
    await expect(createHttpEngine({ baseUrl: "http://x", fetch: bad }).trajectories(simRequest())).rejects.toBeInstanceOf(EngineError);
  });

  it("uses a generous timeout (>= 90 s)", async () => {
    let signal: AbortSignal | undefined;
    const fetch = (async (_u: string, init: RequestInit) => ((signal = init.signal ?? undefined), new Response(JSON.stringify(good)))) as unknown as typeof globalThis.fetch;
    const started = Date.now();
    await createHttpEngine({ baseUrl: "http://x", fetch, timeoutMs: 10 }).trajectories(simRequest());
    // short-call timeout is 10 ms, but the trajectories signal must still be alive well after that
    await new Promise((r) => setTimeout(r, 30));
    expect(Date.now() - started).toBeGreaterThan(20);
    expect(signal?.aborted).toBe(false);
  });
});

describe("playback math", () => {
  const track = { id: 1, t0: 4, xy: [0, 0, 1, 0, 1, 2] }; // frames 4, 5, 6
  const dt = 0.5;
  it("hides the agent before t0 and after its last sample", () => {
    expect(sampleTrack(track, 1.99, dt)).toBeNull();
    expect(sampleTrack(track, 2, dt)).toMatchObject({ x: 0, y: 0 });
    expect(sampleTrack(track, 3, dt)).toMatchObject({ x: 1, y: 2 }); // exact last frame is present
    expect(sampleTrack(track, 3.01, dt)).toBeNull();
    expect(sampleTrack({ t0: 0, xy: [] }, 0, dt)).toBeNull();
  });
  it("interpolates linearly between frames and reports segment speed", () => {
    const s = sampleTrack(track, 2.25, dt)!; // halfway frame 4 → 5
    expect(s.x).toBeCloseTo(0.5);
    expect(s.y).toBeCloseTo(0);
    expect(s.speed).toBeCloseTo(2); // 1 m in 0.5 s
    const s2 = sampleTrack(track, 2.75, dt)!; // halfway 5 → 6
    expect(s2).toMatchObject({ x: 1 });
    expect(s2.y).toBeCloseTo(1);
  });
  it("frame/time helpers", () => {
    expect(trackLength(track)).toBe(3);
    expect(frameAt(2.25, dt)).toBeCloseTo(4.5);
    expect(frameAt(-1, dt)).toBe(0);
    expect(trajectoryDuration({ dt: 0.5, frames: 601 })).toBe(300);
    expect(countPresent({ dt, agents: [track, { id: 2, t0: 0, xy: [0, 0] }] }, 0)).toBe(1);
    expect(countPresent({ dt, agents: [track] }, 2.5)).toBe(1);
  });
});

describe("mock trajectories", () => {
  it("is deterministic and matches the mock SimResult ids", () => {
    const req = simRequest();
    const a = mockTrajectories(req);
    expect(mockTrajectories(structuredClone(req))).toEqual(a);
    const sim = mockSimulate(req);
    expect(a.run_id).toBe(sim.run_id);
    expect(a.layout_id).toBe(sim.layout_id);
    expect(a.dt).toBe(0.5);
    expect(a.frames).toBe(601);
    expect(mockTrajectories(simRequest(7))).not.toEqual(a);
  });

  it("keeps every track inside the recording, in the hall and out of booths and obstacles", () => {
    const req = simRequest(42, 300);
    const t = mockTrajectories(req);
    const p = project();
    const solids = [...req.layout.booths.map(boothRect), ...p.venue.obstacles.map((o) => polygonBBox(o.polygon))];
    expect(t.agents.length).toBeGreaterThan(250);
    const inside = (x: number, y: number) => solids.some((r) => rectContainsPoint(r, { x, y }));
    let checked = 0;
    for (const a of t.agents) {
      const n = trackLength(a);
      expect(a.t0 + n).toBeLessThanOrEqual(t.frames);
      for (let i = 0; i < n; i++) {
        const x = a.xy[2 * i];
        const y = a.xy[2 * i + 1];
        expect(x >= 0 && y >= 0 && x <= p.venue.width && y <= p.venue.height).toBe(true);
        expect(inside(x, y)).toBe(false);
        if (i > 0) {
          const px = a.xy[2 * i - 2];
          const py = a.xy[2 * i - 1];
          // what the renderer interpolates between samples must not cut through a booth either
          for (const s of [0.25, 0.5, 0.75]) expect(inside(px + (x - px) * s, py + (y - py) * s)).toBe(false);
          expect(Math.hypot(x - px, y - py)).toBeLessThan(1.2); // <= ~2.2 m/s at dt 0.5
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10_000);
  });

  it("agents enter at an entrance and most leave before the end", () => {
    const t = mockTrajectories(simRequest());
    const first = t.agents.map((a) => ({ x: a.xy[0], y: a.xy[1] }));
    // sample hall entrance D-main: y = 0, x 18..22
    expect(first.every((p) => p.y < 1.5 && p.x > 17.5 && p.x < 22.5)).toBe(true);
    const finished = t.agents.filter((a) => a.t0 + trackLength(a) < t.frames).length;
    expect(finished / t.agents.length).toBeGreaterThan(0.8);
  });
});
