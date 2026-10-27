import { describe, expect, it } from "vitest";
import { loadAgentConfig } from "@/lib/agent/config";
import type { AgentEvent } from "@/lib/agent/events";
import { withCallCap } from "@/lib/agent/llm";
import { createStubLLM } from "@/lib/agent/llm-stub";
import { runAgentLoop } from "@/lib/agent/loop";
import type { Engine } from "@/lib/engine/client";
import { defaultConstraints, type SimulateRequest } from "@/lib/engine/contract";
import { createMockEngine } from "@/lib/engine/mock";
import { project } from "./helpers";

function recordingEngine() {
  const inner = createMockEngine();
  const sims: SimulateRequest[] = [];
  const engine: Engine = { ...inner, simulate: async (r) => (sims.push(structuredClone(r)), inner.simulate(r)) };
  return { engine, sims };
}

async function run(env: Record<string, string> = {}, engine?: Engine) {
  const events: AgentEvent[] = [];
  const rec = recordingEngine();
  const result = await runAgentLoop({
    project: project(),
    engine: engine ?? rec.engine,
    llm: createStubLLM(),
    config: loadAgentConfig(env),
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
    expect(done.final!.max_density).toBeLessThan(done.baseline!.max_density);
    expect(done.final!.max_density).toBeLessThanOrEqual(2.0);
    expect(done.final!.violations).toBe(0);

    // identical scenario for every simulation
    expect(sims.length).toBe(done.iterations);
    for (const s of sims) {
      expect(s.scenario).toEqual(sims[0].scenario);
      expect(s.grid_cell).toBe(sims[0].grid_cell);
      expect(s.booths).toEqual(sims[0].booths);
    }

    // revisions carry `previous` and the layout actually changes
    const layouts = events.filter((e) => e.type === "layout");
    expect(layouts[0].data.hasPrevious).toBe(false);
    expect(layouts.slice(1).every((l) => l.data.hasPrevious)).toBe(true);
    expect(layouts.slice(1).some((l) => l.data.moves.length > 0)).toBe(true);

    // event order: run first, done last; one report with the disclaimer and unknowns
    expect(events[0].type).toBe("run");
    expect(events[events.length - 1].type).toBe("done");
    const report = events.find((e) => e.type === "report");
    expect(report?.data.markdown).toContain("not a permit");
    expect(report?.data.markdown).toContain("Ceiling height not shown on plan");
    // streamed report text == final markdown
    const streamed = events.flatMap((e) => (e.type === "report-delta" ? [e.delta] : [])).join("");
    expect(streamed.replace(/\s+/g, " ").trim()).toBe(report!.data.markdown.replace(/\s+/g, " ").trim());
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
    const { result } = await run({ AGENT_MAX_ITERATIONS: "1", AGENT_TARGET_MAX_DENSITY: "0.1" });
    expect(result.done.stopReason).toBe("max_iterations");
    expect(result.done.iterations).toBe(2);
  });

  it("aborts with an error if the engine runs a different scenario", async () => {
    const inner = createMockEngine();
    const cheating: Engine = {
      ...inner,
      simulate: async (r) => inner.simulate({ ...r, scenario: { ...r.scenario, seed: r.scenario.seed + 1 } }),
    };
    const { result, events } = await run({}, cheating);
    expect(result.done.status).toBe("error");
    expect(events.some((e) => e.type === "error" && /different scenario/.test(e.data.message))).toBe(true);
  });

  it("repairs validation errors through proposeFixes", async () => {
    const p = project();
    // A keep-out covering most of the hall makes the first layout infeasible.
    p.constraints = { ...defaultConstraints(), keep_out: [{ x: 0, y: 0, w: 40, h: 15 }] };
    const events: AgentEvent[] = [];
    await runAgentLoop({ project: p, engine: createMockEngine(), llm: createStubLLM(), config: loadAgentConfig({}), runId: "fix", emit: (e) => events.push(e) });
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
      config: loadAgentConfig({}),
      runId: "cap",
      emit: (e) => events.push(e),
    });
    expect(r.done.status).toBe("error");
    expect(events.some((e) => e.type === "error" && /call cap/.test(e.data.message))).toBe(true);
  });
});
