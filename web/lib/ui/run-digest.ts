/**
 * LOCAL ADAPTER — temporary stand-in for `buildRunDigest` from `lib/ask/digest.ts`, which the Ask
 * endpoint work adds on another branch. Same signature (`(events: AgentEvent[]) => RunDigest`), so
 * after that merge the simple view switches its import to `@/lib/ask/digest` and this file goes.
 */
import type { AgentEvent, RevisionInfo, RunInfo } from "@/lib/agent/events";
import type { RunDigest } from "@/lib/ask/contract";
import { describeRevision, releasedOrganizerPins } from "./fallback-say";
import { boothNames, nameList, venueShortName } from "./plain";

export function buildRunDigest(events: AgentEvent[]): RunDigest {
  const run = events.find((e) => e.type === "run")?.data as RunInfo | undefined;
  if (!run) throw new Error("buildRunDigest: the stream has no run event yet");
  const brief = events.find((e) => e.type === "brief");
  const done = events.find((e) => e.type === "done");
  const revisions = events.flatMap((e) => (e.type === "revision" ? [e.data] : []));
  const iters = new Map<number, RunDigest["iterations"][number]>();
  const iter = (n: number) => {
    let v = iters.get(n);
    if (!v) {
      v = { iteration: n, crowded_s_per_visitor: null, completed_fraction: null, p90_travel_time_s: null, change: "", crowded_near: [] };
      iters.set(n, v);
    }
    return v;
  };
  const changeTo = (n: number) => {
    const rs: RevisionInfo[] = revisions.filter((r) => (r.purpose === "improve" ? r.iteration === n - 1 : r.iteration === n));
    return rs.map((r) => describeRevision(r, run)).filter(Boolean).join("; then ");
  };
  for (const e of events) {
    if (e.type === "layout") iter(e.data.iteration);
    if (e.type === "sim") {
      const v = iter(e.data.iteration);
      v.crowded_s_per_visitor = e.data.metrics.crowded_s_per_visitor;
      v.completed_fraction = e.data.metrics.completed_fraction;
      v.p90_travel_time_s = e.data.metrics.p90_travel_time_s;
    }
    if (e.type === "analysis") {
      const ids = [...new Set(e.data.causes.flatMap((c) => c.booth_ids))];
      iter(e.data.iteration).crowded_near = boothNames(ids, run.booths);
    }
  }
  for (const v of iters.values()) v.change = v.iteration === 0 ? "" : changeTo(v.iteration);
  const approvals = revisions.flatMap((r) => {
    const ids = releasedOrganizerPins(r, run);
    return ids.length ? [`Let ${nameList(boothNames(ids, run.booths))} move away from the spots the organizer asked for.`] : [];
  });
  const finalSim = done?.data.final;
  const unknowns: string[] = [];
  if (finalSim && finalSim.warnings > 0) unknowns.push(`${finalSim.warnings} layout warning(s) in the final check`);
  if (finalSim?.truncated) unknowns.push("The final test was cut short, so its numbers are partial");
  return {
    venue: { id: run.venue.id, name: venueShortName(run.venue.name), setting: run.venue.setting },
    scenario: { kind: run.scenario.kind, agents: run.scenario.agents, duration_s: run.scenario.duration_s },
    crowd_threshold: run.crowdThreshold,
    target_crowded_s_per_visitor: run.targets.crowded_s_per_visitor,
    brief: brief?.data.rationale ?? null,
    iterations: [...iters.values()].sort((a, b) => a.iteration - b.iteration),
    stop_reason: done?.data.stopReason ?? null,
    baseline_iteration: done?.data.baselineIteration ?? null,
    final_iteration: done?.data.finalIteration ?? null,
    approvals,
    unknowns,
  };
}
