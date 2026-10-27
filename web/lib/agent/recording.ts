/**
 * Produces the replay recordings (one per venue): the real loop with the stub LLM and a fixed
 * clock. By default it runs against the mock engine with MOCK_RECORDING_ENV (env ignored), so the
 * output is byte-for-byte reproducible; scripts/record-replay.ts can pass the real engine
 * instead (also deterministic for the same engine version). A test checks that a
 * mock-engine fixture is still genuine loop output.
 */
import type { Engine } from "@/lib/engine/client";
import type { Layout, ProjectInput, Trajectories } from "@/lib/engine/contract";
import { createMockEngine } from "@/lib/engine/mock";
import { loadAgentConfig, type AgentConfig } from "./config";
import { simulateRequestFor } from "@/lib/trajectory/request";
import type { AgentEvent, RunInfo } from "./events";
import { createStubLLM } from "./llm-stub";
import { runAgentLoop } from "./loop";
import type { Recording } from "./stream";

export const RECORDING_CLOCK = "2026-10-27T00:00:00.000Z";

/**
 * The mock's synthetic crowding is tuned for the entry scenario; the loop's defaults (browse,
 * 10 crowded s/visitor) are tuned for the real engine. Mock recordings pin this so the replay
 * shows revisions.
 */
export const MOCK_RECORDING_ENV = { AGENT_SCENARIO_KIND: "entry", AGENT_TARGET_CROWDED_S_PER_VISITOR: "3" };

export async function recordRun(
  project: ProjectInput,
  engine: Engine = createMockEngine(),
  config: AgentConfig = loadAgentConfig(MOCK_RECORDING_ENV),
): Promise<Recording> {
  const events: AgentEvent[] = [];
  const llm = createStubLLM();
  await runAgentLoop({
    project: structuredClone(project),
    engine,
    llm,
    config,
    runId: `replay-${project.venue.id}`,
    mode: "live",
    emit: (e) => events.push(e),
    now: () => new Date(RECORDING_CLOCK),
  });
  return {
    version: 1,
    generator: `web/scripts/record-replay.ts (${engine.kind} engine + stub LLM)`,
    recordedAt: RECORDING_CLOCK,
    engine: engine.kind,
    llm: llm.name,
    events,
  };
}

/**
 * Trajectories for every simulated iteration of a recording, keyed by run_id. The request is
 * rebuilt from the recorded events exactly like the UI does (lib/trajectory/request.ts), so the
 * files match what /api/trajectories would return for the same run.
 */
export async function recordReplayTrajectories(
  rec: Pick<Recording, "events">,
  engine: Pick<Engine, "trajectories"> = createMockEngine(),
): Promise<Map<string, Trajectories>> {
  const out = new Map<string, Trajectories>();
  let run: RunInfo | undefined;
  const layouts = new Map<number, Layout>();
  for (const e of rec.events) {
    if (e.type === "run") run = e.data;
    else if (e.type === "layout") layouts.set(e.data.iteration, e.data.response.layout);
    else if (e.type === "sim" && run) {
      const layout = layouts.get(e.data.iteration);
      if (!layout) continue;
      const traj = await engine.trajectories(simulateRequestFor(run, layout, e.data));
      if (traj.run_id !== e.data.result.run_id) {
        throw new Error(`trajectories run_id ${traj.run_id} ≠ simulate run_id ${e.data.result.run_id}`);
      }
      out.set(traj.run_id, traj);
    }
  }
  return out;
}
