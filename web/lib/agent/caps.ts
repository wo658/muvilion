/**
 * Best-effort, per-server-instance spend caps for live runs. They reset when the
 * process restarts and are not shared across serverless instances; LIVE_AGENT=off
 * is the real kill switch.
 */
import type { Env } from "@/lib/env";

let day = "";
let runsToday = 0;
let active = 0;

export type CapDecision = { ok: true; release: () => void } | { ok: false; reason: string };

export function acquireLiveRun(env: Env = process.env, now = new Date()): CapDecision {
  const dailyCap = Number(env.AGENT_DAILY_RUN_CAP ?? 50);
  const concurrentCap = Number(env.AGENT_MAX_CONCURRENT_RUNS ?? 2);
  const today = now.toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    runsToday = 0;
  }
  if (runsToday >= dailyCap) return { ok: false, reason: `daily live-run cap reached (AGENT_DAILY_RUN_CAP=${dailyCap})` };
  if (active >= concurrentCap)
    return { ok: false, reason: `too many concurrent live runs (AGENT_MAX_CONCURRENT_RUNS=${concurrentCap})` };
  runsToday++;
  active++;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (!released) {
        released = true;
        active--;
      }
    },
  };
}

export function capStatus() {
  return { day, runsToday, active };
}
