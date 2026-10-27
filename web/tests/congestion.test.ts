import { describe, expect, it } from "vitest";
import { bestIteration, decide, type IterationOutcome } from "@/lib/agent/analysis";
import { applyVenueOverrides, loadAgentConfig } from "@/lib/agent/config";
import type { Metrics, Targets } from "@/lib/agent/events";
import { LayoutRequest } from "@/lib/engine/contract";
import { mockLayout, mockSimulate } from "@/lib/engine/mock";
import { venueById } from "@/lib/venues";
import { project } from "./helpers";

const targets: Targets = { crowded_s_per_visitor: 10, min_improvement: 0.1, max_completion_drop: 0.05 };

function m(crowded: number, over: Partial<Metrics> = {}): Metrics {
  return {
    crowded_s_per_visitor: crowded,
    crowded_person_s: crowded * 200,
    peak_crowded_area_m2: 20,
    worst_hotspot_mean_density: 1.5,
    crowd_threshold: 2,
    max_density: 3,
    p90_travel_time_s: 200,
    mean_travel_time_s: 150,
    completed_fraction: 0.75,
    violations: 0,
    warnings: 0,
    hotspots: 2,
    truncated: false,
    ...over,
  };
}
const o = (iteration: number, metrics: Metrics, valid = true): IterationOutcome => ({ iteration, metrics, valid });

describe("decide on crowded seconds per visitor", () => {
  it("stops with target_met when crowded s/visitor ≤ target and there are no errors", () => {
    const d = decide([o(0, m(16.8)), o(1, m(9.9))], targets, 3);
    expect(d.decision).toBe("target_met");
    expect(d.best).toBe(1);
    expect(d.reason).toMatch(/9\.9 s\/visitor .*≤ target 10 s/);
    expect(d.reason).toContain("1980 person-s");
  });

  it("never meets the target with validation errors or a truncated run", () => {
    expect(decide([o(0, m(5, { violations: 1 }), false)], targets, 3).decision).toBe("continue");
    const t = decide([o(0, m(5, { truncated: true }), false)], targets, 3);
    expect(t.decision).toBe("continue");
    expect(t.reason).toMatch(/truncated/);
  });

  it("continues on a ≥ 10% relative reduction and stops with no_improvement below it", () => {
    expect(decide([o(0, m(16.8)), o(1, m(15.1))], targets, 3).decision).toBe("continue"); // −10.1%
    const d = decide([o(0, m(16.8)), o(1, m(15.2))], targets, 3); // −9.5%
    expect(d.decision).toBe("no_improvement");
    expect(d.reason).toMatch(/best so far 16\.8 s\/visitor \(9\.5% reduction < 10% required\)/);
    // compared with the best so far, not the previous iteration
    expect(decide([o(0, m(16.8)), o(1, m(13)), o(2, m(14))], targets, 3).decision).toBe("no_improvement");
  });

  it("does not count lower crowding as better when completion drops > 0.05 vs baseline", () => {
    const h = [o(0, m(16.8, { completed_fraction: 0.77 })), o(1, m(8, { completed_fraction: 0.71 }))];
    const d = decide(h, targets, 3);
    expect(d.decision).toBe("no_improvement");
    expect(d.completionOk).toBe(false);
    expect(d.reason).toMatch(/completion fell to 71% vs baseline 77%/);
    expect(d.best).toBe(0);
    expect(bestIteration(h)).toBe(0);
    // a drop of exactly 0.05 is still fine
    expect(decide([o(0, m(16.8, { completed_fraction: 0.77 })), o(1, m(8, { completed_fraction: 0.72 }))], targets, 3).decision).toBe("target_met");
  });

  it("stops at max iterations", () => {
    expect(decide([o(0, m(16.8)), o(1, m(12))], targets, 1).decision).toBe("max_iterations");
  });
});

describe("config and venue targets", () => {
  it("reads the target and improvement threshold from env", () => {
    expect(loadAgentConfig({}).targets).toEqual({ crowded_s_per_visitor: 10, min_improvement: 0.1, max_completion_drop: 0.05 });
    expect(loadAgentConfig({}).crowdThreshold).toBe(2);
    const c = loadAgentConfig({ AGENT_TARGET_CROWDED_S_PER_VISITOR: "7.5", AGENT_MIN_IMPROVEMENT: "0.2", AGENT_CROWD_THRESHOLD: "1.5" });
    expect(c.targets.crowded_s_per_visitor).toBe(7.5);
    expect(c.targets.min_improvement).toBe(0.2);
    expect(c.crowdThreshold).toBe(1.5);
  });

  it("applies the venue's scenario and target overrides on top of env", () => {
    const env = loadAgentConfig({ AGENT_TARGET_CROWDED_S_PER_VISITOR: "4", AGENT_MIN_IMPROVEMENT: "0.3" });
    const outdoor = venueById("riverside-plaza")!;
    const c = applyVenueOverrides(env, outdoor);
    expect(c.targets).toEqual({ ...env.targets, ...outdoor.targets });
    expect(c.targets.min_improvement).toBe(0.3);
    expect(c.scenario).toMatchObject(outdoor.scenario!);
    // a venue without overrides keeps the env config
    expect(applyVenueOverrides(env, venueById("sample-hall"))).toEqual(env);
  });
});

describe("mock engine congestion", () => {
  const p = project();
  const layout = mockLayout(LayoutRequest.parse({ venue: p.venue, booths: p.booths })).layout;
  const req = { venue: p.venue, layout, booths: p.booths, scenario: { kind: "entry" as const, agents: 200, duration_s: 300, seed: 42 } };

  it("is deterministic and consistent with the density field", () => {
    const a = mockSimulate(req);
    expect(mockSimulate(structuredClone(req)).congestion).toEqual(a.congestion);
    const c = a.congestion;
    expect(c.threshold).toBe(2);
    expect(c.crowded_person_s).toBeGreaterThan(0);
    expect(c.crowded_s_per_visitor).toBeCloseTo(c.crowded_person_s / 200, 2);
    expect(c.worst_hotspot_mean_density).toBe(Math.max(...a.hotspots.map((h) => h.mean_density)));
    // no crowding where no cell reaches the threshold
    const calm = mockSimulate({ ...req, crowd_threshold: a.max_density + 0.1 }).congestion;
    expect(calm.crowded_person_s).toBe(0);
    expect(calm.peak_crowded_area_m2).toBe(0);
  });

  it("a lower threshold counts more crowding and changes the run id", () => {
    const a = mockSimulate(req);
    const b = mockSimulate({ ...req, crowd_threshold: 1.5 });
    expect(b.congestion.crowded_person_s).toBeGreaterThan(a.congestion.crowded_person_s);
    expect(b.run_id).not.toBe(a.run_id);
  });
});
