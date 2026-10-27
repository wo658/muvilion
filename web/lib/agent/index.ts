/** Server-side wiring: env → engine + LLM for a run. */
import type { Env } from "@/lib/env";
import { getEngine } from "@/lib/engine";
import { loadAgentConfig, type AgentConfig } from "./config";
import { withCallCap, withFallback, type AgentLLM } from "./llm";
import { createModelLLM } from "./llm-model";
import { createStubLLM } from "./llm-stub";
import { getModel } from "./model";

export { runAgentLoop } from "./loop";
export type { AgentConfig } from "./config";

export class AgentConfigError extends Error {}

/**
 * AGENT_LLM=stub → deterministic rule-based reviewer (no key needed).
 * Otherwise the configured model; unless AGENT_LLM_FALLBACK=off, a failing model
 * call falls back to the stub for that step (reported via `onFallback`).
 */
export function createAgentLLM(
  env: Env,
  config: AgentConfig,
  onFallback: (what: string, err: unknown) => void,
): AgentLLM {
  let llm: AgentLLM;
  if (env.AGENT_LLM === "stub") {
    llm = createStubLLM();
  } else {
    const m = getModel(env);
    if (!m.hasKey) {
      throw new AgentConfigError(
        `No API key for provider "${m.provider}" (set MODEL_API_KEY / BASETEN_API_KEY, or AGENT_LLM=stub).`,
      );
    }
    const primary = createModelLLM(m.model, `${m.provider}:${m.modelId}`);
    llm = env.AGENT_LLM_FALLBACK === "off" ? primary : withFallback(primary, createStubLLM(), onFallback);
  }
  return withCallCap(llm, config.maxLlmCalls);
}

export function createRunDeps(env: Env = process.env) {
  const config = loadAgentConfig(env);
  return { config, engine: getEngine(env) };
}
