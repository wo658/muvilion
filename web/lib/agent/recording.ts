/**
 * Produces the replay recording: the real loop against the mock engine with the
 * stub LLM and default config (env ignored), with a fixed clock so the output is
 * byte-for-byte reproducible. Used by scripts/record-replay.ts and by a test
 * that checks the committed fixture is still genuine loop output.
 */
import sample from "@/fixtures/sample_hall.json";
import type { Engine } from "@/lib/engine/client";
import { ProjectInput, type Layout, type Trajectories } from "@/lib/engine/contract";
import { createMockEngine } from "@/lib/engine/mock";
import { loadAgentConfig } from "./config";
import { simulateRequestFor } from "@/lib/trajectory/request";
import type { AgentEvent, RunInfo } from "./events";
import { createStubLLM } from "./llm-stub";
import { runAgentLoop } from "./loop";
import type { Recording } from "./stream";

export const RECORDING_CLOCK = "2026-10-27T00:00:00.000Z";

export async function recordSampleRun(): Promise<Recording> {
  const events: AgentEvent[] = [];
  const engine = createMockEngine();
  const llm = createStubLLM();
  await runAgentLoop({
    project: ProjectInput.parse(sample),
    engine,
    llm,
    config: loadAgentConfig({}),
    runId: "sample-run",
    mode: "live",
    emit: (e) => events.push(e),
    now: () => new Date(RECORDING_CLOCK),
  });
  return {
    version: 1,
    generator: "web/scripts/record-replay.ts (mock engine + stub LLM, default config)",
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
