/** Agent configuration from environment variables (server-only). */
import type { Env } from "@/lib/env";
import { Scenario } from "@/lib/engine/contract";
import type { Targets } from "./events";

export type AgentConfig = {
  /** Revision iterations after the baseline (iteration 0). */
  maxIterations: number;
  /** generate→validate retries per iteration when validation fails. */
  maxFixAttempts: number;
  maxLlmCalls: number;
  /** Model calls for `say` wording per run (separate budget; beyond it the stub wording is used). */
  maxNarrationCalls: number;
  /** Per narration call; a slower answer uses the stub wording for those messages. */
  narrationTimeoutMs: number;
  targets: Targets;
  scenario: Scenario;
  gridCell: number;
  /** SimulateRequest.crowd_threshold (p/m²): a cell is crowded at or above this; locked per run. */
  crowdThreshold: number;
  /** Engine compute cap per simulation (SimulateRequest.max_wall_time_s); locked per run. */
  simMaxWallTimeS: number;
  layoutSeed: number;
  layoutTimeLimitS: number;
};

function num(v: string | undefined, d: number): number {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

export function loadAgentConfig(env: Env = process.env): AgentConfig {
  return {
    maxIterations: Math.max(0, Math.floor(num(env.AGENT_MAX_ITERATIONS, 3))),
    maxFixAttempts: Math.max(0, Math.floor(num(env.AGENT_MAX_FIX_ATTEMPTS, 2))),
    maxLlmCalls: Math.max(1, Math.floor(num(env.AGENT_MAX_LLM_CALLS, 20))),
    maxNarrationCalls: Math.max(0, Math.floor(num(env.AGENT_MAX_NARRATION_CALLS, 12))),
    narrationTimeoutMs: Math.max(1000, num(env.AGENT_NARRATION_TIMEOUT_MS, 15_000)),
    targets: {
      crowded_s_per_visitor: num(env.AGENT_TARGET_CROWDED_S_PER_VISITOR, 10),
      min_improvement: num(env.AGENT_MIN_IMPROVEMENT, 0.1),
      max_completion_drop: num(env.AGENT_MAX_COMPLETION_DROP, 0.05),
    },
    scenario: Scenario.parse({
      kind: env.AGENT_SCENARIO_KIND ?? "browse",
      agents: Math.floor(num(env.AGENT_SCENARIO_AGENTS, 200)),
      duration_s: num(env.AGENT_SCENARIO_DURATION_S, 300),
      seed: Math.floor(num(env.AGENT_SCENARIO_SEED, 42)),
    }),
    gridCell: num(env.AGENT_GRID_CELL, 2),
    crowdThreshold: num(env.AGENT_CROWD_THRESHOLD, 2),
    simMaxWallTimeS: num(env.AGENT_SIM_MAX_WALL_TIME_S, 60),
    layoutSeed: Math.floor(num(env.AGENT_LAYOUT_SEED, 0)),
    layoutTimeLimitS: num(env.AGENT_LAYOUT_TIME_LIMIT_S, 10),
  };
}

/**
 * Per-venue scenario override (lib/venues): e.g. the outdoor plaza is demoed with an entry rush of
 * 400 visitors. Applied on top of the env config for live runs and real-engine recordings; the
 * scenario stays locked for the whole run either way (ScenarioGuard).
 */
export function applyScenarioOverride(config: AgentConfig, override?: Partial<Scenario>): AgentConfig {
  if (!override) return config;
  return { ...config, scenario: Scenario.parse({ ...config.scenario, ...override }) };
}

/** Per-venue target override (lib/venues), e.g. a lower crowded-time target for the open plaza. */
export function applyTargetsOverride(config: AgentConfig, override?: Partial<Targets>): AgentConfig {
  if (!override) return config;
  return { ...config, targets: { ...config.targets, ...override } };
}

/** Both per-venue overrides (scenario and targets); the venue wins over the env for the fields it sets. */
export function applyVenueOverrides(config: AgentConfig, venue?: { scenario?: Partial<Scenario>; targets?: Partial<Targets> }): AgentConfig {
  return applyTargetsOverride(applyScenarioOverride(config, venue?.scenario), venue?.targets);
}

export function liveAgentEnabled(env: Env = process.env): boolean {
  return env.LIVE_AGENT === "on";
}
