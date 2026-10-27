/**
 * `buildRunDigest`: the streamed events of a run → the compact RunDigest that Ask Muse answers
 * from. Pure and client-safe: the UI calls it on the events it already holds (live or replay,
 * finished or still running) and sends the result with each question.
 */
import type { AgentEvent, RevisionInfo, RunInfo, SimInfo } from "@/lib/agent/events";
import { boothsPhrase, boothName, changePhrases, joinAnd, overriddenRequests, type ChangeContext } from "@/lib/agent/narrate";
import type { RunDigest } from "./contract";

const STOP_REASONS: Record<string, string> = {
  target_met: "The crowding goal was met.",
  no_improvement: "Muse stopped because the last change did not make crowding clearly better.",
  max_iterations: "Muse stopped after the maximum number of rounds of changes.",
  stopped: "The run was stopped.",
  error: "The run stopped because of a technical problem, so the result is incomplete.",
};

/** "Food Truck 3 (F3)" — plain name plus the id the canvas shows. */
function boothRef(id: string, run: RunInfo): string {
  const s = run.booths.find((b) => b.id === id);
  if (!s) return id;
  const name = boothName(s);
  return name === id ? id : `${name} (${id})`;
}

export function buildRunDigest(events: AgentEvent[]): RunDigest {
  const run = events.find((e) => e.type === "run")?.data as RunInfo | undefined;
  if (!run) throw new Error("buildRunDigest: no run event yet");

  const sims = new Map<number, SimInfo>();
  const layoutIterations = new Set<number>();
  const revisions: RevisionInfo[] = [];
  let briefText: string | null = null;
  let briefRationale: string | null = null;
  let stopReason: string | null = null;
  let baselineIteration: number | null = null;
  let finalIteration: number | null = null;
  for (const e of events) {
    if (e.type === "sim") sims.set(e.data.iteration, e.data);
    else if (e.type === "layout") layoutIterations.add(e.data.iteration);
    else if (e.type === "revision") revisions.push(e.data);
    else if (e.type === "brief") briefRationale = e.data.rationale;
    else if (e.type === "say" && e.data.moment === "brief") briefText = e.data.text;
    else if (e.type === "done") {
      stopReason = STOP_REASONS[e.data.stopReason] ?? e.data.stopReason;
      baselineIteration = e.data.baselineIteration;
      finalIteration = e.data.finalIteration;
    }
  }

  const ctxFor = (iteration: number): ChangeContext => ({
    venue: run.venue,
    specs: run.booths,
    organizerFixed: run.initialConstraints.fixed,
    hotspots: sims.get(iteration)?.result.hotspots ?? [],
    withIds: true,
  });
  // Changes that produced iteration k: the improvement after k-1, then any validation fixes within k.
  const changeFor = (k: number) => {
    const phrases = revisions
      .filter((r) => (r.purpose === "improve" ? r.iteration === k - 1 : r.iteration === k))
      .flatMap((r) => changePhrases(r.applied, ctxFor(r.iteration)));
    const s = joinAnd(phrases);
    return s ? `${s[0].toUpperCase()}${s.slice(1)}.` : "";
  };

  const iterations = [...new Set([...layoutIterations, ...sims.keys()])]
    .sort((a, b) => a - b)
    .map((k) => {
      const s = sims.get(k);
      const top = s?.result.hotspots[0];
      return {
        iteration: k,
        crowded_s_per_visitor: s ? s.metrics.crowded_s_per_visitor : null,
        completed_fraction: s ? s.metrics.completed_fraction : null,
        p90_travel_time_s: s ? s.metrics.p90_travel_time_s : null,
        change: k === 0 ? "" : changeFor(k),
        crowded_near: top ? top.nearby_booth_ids.map((id) => boothRef(id, run)) : [],
      };
    });

  // Organizer requests given up by the changes that shaped the result (all changes while running).
  const upTo = finalIteration ?? Infinity;
  const approvals = revisions
    .filter((r) => (r.purpose === "improve" ? r.iteration < upTo : r.iteration <= upTo))
    .flatMap((r) => {
      const ids = overriddenRequests(r.applied, run.initialConstraints.fixed);
      return ids.length
        ? [`Moving ${boothsPhrase(ids, run.booths)} (${ids.join(", ")}) away from the spots the organizer asked for.`]
        : [];
    });

  return {
    venue: { id: run.venue.id, name: run.venue.name, setting: run.venue.setting },
    scenario: { kind: run.scenario.kind, agents: run.scenario.agents, duration_s: run.scenario.duration_s },
    crowd_threshold: run.crowdThreshold,
    target_crowded_s_per_visitor: run.targets.crowded_s_per_visitor,
    brief: briefText ?? briefRationale,
    iterations,
    stop_reason: stopReason,
    baseline_iteration: baselineIteration,
    final_iteration: finalIteration,
    approvals: [...new Set(approvals)],
    unknowns: [...run.venue.unknowns],
  };
}
