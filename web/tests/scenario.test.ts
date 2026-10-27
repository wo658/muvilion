import { describe, expect, it } from "vitest";
import { mockLayout, mockSimulate } from "@/lib/engine/mock";
import { LayoutRequest } from "@/lib/engine/contract";
import { ScenarioGuard, ScenarioMismatchError } from "@/lib/agent/scenario";
import { project } from "./helpers";

const scenario = { kind: "entry" as const, agents: 200, duration_s: 300, seed: 42 };

describe("ScenarioGuard (identical conditions)", () => {
  const p = project();
  const layout = mockLayout(LayoutRequest.parse({ venue: p.venue, booths: p.booths })).layout;

  it("builds requests with the locked scenario for any layout", () => {
    const g = new ScenarioGuard(scenario, 2, p.venue, p.booths);
    const a = g.request(layout);
    const b = g.request({ ...layout, id: "other", booths: layout.booths.slice(1) });
    expect(a.scenario).toEqual(scenario);
    expect(b.scenario).toEqual(a.scenario);
    expect(b.grid_cell).toBe(2);
    expect(Object.isFrozen(g.scenario)).toBe(true);
  });

  it("is not affected by later mutation of the caller's objects", () => {
    const s = { ...scenario };
    const booths = structuredClone(p.booths);
    const g = new ScenarioGuard(s, 2, p.venue, booths);
    s.seed = 999;
    booths[0].popularity = 0;
    expect(g.request(layout).scenario.seed).toBe(42);
    expect(g.request(layout).booths[0].popularity).toBe(p.booths[0].popularity);
  });

  it("rejects requests whose seed, agents, duration, kind, grid, venue or demand differ", () => {
    const g = new ScenarioGuard(scenario, 2, p.venue, p.booths);
    const ok = g.request(layout);
    const bad = [
      { ...ok, scenario: { ...ok.scenario, seed: 1 } },
      { ...ok, scenario: { ...ok.scenario, agents: 201 } },
      { ...ok, scenario: { ...ok.scenario, duration_s: 299 } },
      { ...ok, scenario: { ...ok.scenario, kind: "exit" as const } },
      { ...ok, grid_cell: 1 },
      { ...ok, venue: { ...ok.venue, width: 41 } },
      { ...ok, booths: ok.booths.map((b) => (b.id === "B03" ? { ...b, popularity: 0.1 } : b)) },
    ];
    for (const r of bad) expect(() => g.assertRequest(r)).toThrow(ScenarioMismatchError);
    expect(() => g.assertRequest(ok)).not.toThrow();
  });

  it("rejects engine results that ran a different scenario", () => {
    const g = new ScenarioGuard(scenario, 2, p.venue, p.booths);
    const res = mockSimulate(g.request(layout));
    expect(() => g.assertResult(res)).not.toThrow();
    expect(() => g.assertResult({ ...res, scenario: { ...res.scenario, seed: 7 } })).toThrow(ScenarioMismatchError);
  });
});
