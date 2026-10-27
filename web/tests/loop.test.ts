import { describe, expect, it } from "vitest";
import { loadAgentConfig } from "@/lib/agent/config";
import type { AgentEvent } from "@/lib/agent/events";
import { withCallCap } from "@/lib/agent/llm";
import { createStubLLM } from "@/lib/agent/llm-stub";
import { runAgentLoop } from "@/lib/agent/loop";
import type { Engine } from "@/lib/engine/client";
import { SimulateRequest, defaultConstraints } from "@/lib/engine/contract";
import { createMockEngine } from "@/lib/engine/mock";
import { project } from "./helpers";

function recordingEngine() {
  const inner = createMockEngine();
  const sims: SimulateRequest[] = [];
  const engine: Engine = { ...inner, simulate: async (r) => (sims.push(SimulateRequest.parse(structuredClone(r))), inner.simulate(r)) };
  return { engine, sims };
}

// The mock engine's crowding model is tuned for the entry scenario; pin it so these tests
// don't follow the demo defaults in lib/agent/config.ts.
const MOCK_ENV = { AGENT_SCENARIO_KIND: "entry", AGENT_TARGET_CROWDED_S_PER_VISITOR: "3" };

async function run(env: Record<string, string> = {}, engine?: Engine) {
  const events: AgentEvent[] = [];
  const rec = recordingEngine();
  const result = await runAgentLoop({
    project: project(),
    engine: engine ?? rec.engine,
    llm: createStubLLM(),
    config: loadAgentConfig({ ...MOCK_ENV, ...env }),
    runId: "test",
    emit: (e) => events.push(e),
    now: () => new Date(0),
  });
  return { events, result, sims: rec.sims };
}

describe("agent loop (mock engine + stub LLM)", () => {
  it("improves the layout under identical conditions and stops at the target", async () => {
    const { events, result, sims } = await run();
    const { done } = result;
    expect(done.status).toBe("completed");
    expect(done.stopReason).toBe("target_met");
    expect(done.iterations).toBeGreaterThanOrEqual(2);
    expect(done.final!.crowded_s_per_visitor).toBeLessThan(done.baseline!.crowded_s_per_visitor);
    expect(done.final!.crowded_s_per_visitor).toBeLessThanOrEqual(3);
    expect(done.final!.completed_fraction).toBeGreaterThanOrEqual(done.baseline!.completed_fraction - 0.05);
    expect(done.final!.violations).toBe(0);

    // identical scenario for every simulation
    expect(sims.length).toBe(done.iterations);
    for (const s of sims) {
      expect(s.scenario).toEqual(sims[0].scenario);
      expect(s.grid_cell).toBe(sims[0].grid_cell);
      expect(s.booths).toEqual(sims[0].booths);
      expect(s.crowd_threshold).toBe(2);
    }

    // revisions carry `previous` and the layout actually changes
    const layouts = events.filter((e) => e.type === "layout");
    expect(layouts[0].data.hasPrevious).toBe(false);
    expect(layouts.slice(1).every((l) => l.data.hasPrevious)).toBe(true);
    expect(layouts.slice(1).some((l) => l.data.moves.length > 0)).toBe(true);

    // the design brief comes before the first layout and sets its constraints
    const briefAt = events.findIndex((e) => e.type === "brief");
    const firstLayout = events.findIndex((e) => e.type === "layout");
    expect(briefAt).toBe(events.findIndex((e) => e.type !== "run" && e.type !== "step" && e.type !== "say"));
    expect(briefAt).toBeLessThan(firstLayout);
    const brief = events[briefAt];
    expect(brief.type === "brief" && layouts[0].data.constraints).toEqual(brief.type === "brief" && brief.data.constraints);
    const firstStep = events.find((e) => e.type === "step");
    expect(firstStep?.type === "step" && firstStep.data.step).toBe("brief");

    // event order: run first, done last; one report with the disclaimer and unknowns
    expect(events[0].type).toBe("run");
    expect(events[events.length - 1].type).toBe("done");
    const report = events.find((e) => e.type === "report");
    expect(report?.data.markdown).toContain("not a permit");
    expect(report?.data.markdown).toContain("Time the average visitor spent in crowded areas (≥ 2 p/m²)");
    expect(report?.data.markdown).toContain("## Design brief");
    expect(report?.data.markdown).toContain("Ceiling height not shown on plan");
    // streamed report text == final markdown
    const streamed = events.flatMap((e) => (e.type === "report-delta" ? [e.delta] : [])).join("");
    expect(streamed).toBe(report!.data.markdown);
    // all steps finish
    const steps = new Map<string, string>();
    for (const e of events) if (e.type === "step") steps.set(e.data.id, e.data.status);
    expect([...steps.values()].every((s) => s === "done")).toBe(true);
  });

  it("is deterministic", async () => {
    const a = await run();
    const b = await run();
    expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events));
  });

  it("stops at AGENT_MAX_ITERATIONS", async () => {
    const { result } = await run({ AGENT_MAX_ITERATIONS: "1", AGENT_TARGET_CROWDED_S_PER_VISITOR: "0.01", AGENT_MIN_IMPROVEMENT: "-1" });
    expect(result.done.stopReason).toBe("max_iterations");
    expect(result.done.iterations).toBe(2);
  });

  it("aborts with an error if the engine runs a different scenario", async () => {
    const inner = createMockEngine();
    const cheating: Engine = {
      ...inner,
      simulate: async (r) => inner.simulate({ ...r, scenario: { ...r.scenario, seed: (r.scenario.seed ?? 0) + 1 } }),
    };
    const { result, events } = await run({}, cheating);
    expect(result.done.status).toBe("error");
    expect(events.some((e) => e.type === "error" && /different scenario/.test(e.data.message))).toBe(true);
  });

  it("aborts with an error if the engine used a different crowd threshold", async () => {
    const inner = createMockEngine();
    const cheating: Engine = { ...inner, simulate: async (r) => inner.simulate({ ...r, crowd_threshold: 1.5 }) };
    const { result, events } = await run({}, cheating);
    expect(result.done.status).toBe("error");
    expect(events.some((e) => e.type === "error" && /crowd threshold/.test(e.data.message))).toBe(true);
  });

  it("treats truncated simulations as not comparable (never target_met)", async () => {
    const inner = createMockEngine();
    const truncating: Engine = {
      ...inner,
      simulate: async (r) => ({ ...(await inner.simulate(r)), congestion: { ...(await inner.simulate(r)).congestion, crowded_s_per_visitor: 0 }, truncated: true }),
    };
    const { result, events } = await run({ AGENT_MAX_ITERATIONS: "1" }, truncating);
    expect(result.done.stopReason).toBe("max_iterations");
    const cmp = events.filter((e) => e.type === "comparison");
    expect(cmp.every((c) => !c.data.valid && c.data.metrics.truncated)).toBe(true);
  });

  it("repairs validation errors through proposeFixes", async () => {
    const p = project();
    // A keep-out covering most of the hall makes the first layout infeasible.
    p.constraints = { ...defaultConstraints(), keep_out: [{ x: 0, y: 0, w: 40, h: 15 }] };
    const events: AgentEvent[] = [];
    await runAgentLoop({ project: p, engine: createMockEngine(), llm: createStubLLM(), config: loadAgentConfig(MOCK_ENV), runId: "fix", emit: (e) => events.push(e) });
    const fixes = events.filter((e) => e.type === "revision" && e.data.purpose === "fix_validation");
    expect(fixes.length).toBeGreaterThan(0);
    const v = events.filter((e) => e.type === "validation");
    expect(v[0].data.errors).toBeGreaterThan(0);
    expect(v[1].data.errors).toBe(0);
  });

  it("enforces the per-run LLM call cap", async () => {
    const events: AgentEvent[] = [];
    const r = await runAgentLoop({
      project: project(),
      engine: createMockEngine(),
      llm: withCallCap(createStubLLM(), 1),
      config: loadAgentConfig(MOCK_ENV),
      runId: "cap",
      emit: (e) => events.push(e),
    });
    expect(r.done.status).toBe("error");
    expect(events.some((e) => e.type === "error" && /call cap/.test(e.data.message))).toBe(true);
  });
});
