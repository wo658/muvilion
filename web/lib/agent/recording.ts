/**
 * Produces the replay recording: the real loop against the mock engine with the
 * stub LLM and default config (env ignored), with a fixed clock so the output is
 * byte-for-byte reproducible. Used by scripts/record-replay.ts and by a test
 * that checks the committed fixture is still genuine loop output.
 */
import sample from "@/fixtures/sample_hall.json";
import { ProjectInput } from "@/lib/engine/contract";
import { createMockEngine } from "@/lib/engine/mock";
import { loadAgentConfig } from "./config";
import type { AgentEvent } from "./events";
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
