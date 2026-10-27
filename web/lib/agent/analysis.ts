/**
 * Deterministic, code-side analysis helpers: metrics extraction, the compact
 * summaries the LLM reads (never raw grids), layout diffs, agent-side checks and
 * the stop/continue decision. Every number the LLM or the report sees comes from here.
 */
import type {
  BoothSpec,
  Layout,
  LayoutConstraints,
  LayoutResponse,
  SimResult,
  ValidateResponse,
  Venue,
  Violation,
} from "@/lib/engine/contract";
import { boothRect, center, distanceToNearestEntrance, inPopularZone, round } from "@/lib/geometry";
import type { BoothMove, Decision, Metrics, Targets } from "./events";

export function countViolations(v: Violation[]) {
  return {
    errors: v.filter((x) => x.severity === "error").length,
    warnings: v.filter((x) => x.severity === "warning").length,
  };
}

export function metricsOf(sim: SimResult, violations: Violation[]): Metrics {
  const { errors, warnings } = countViolations(violations);
  return {
    max_density: sim.max_density,
    p90_travel_time_s: sim.p90_travel_time_s,
    mean_travel_time_s: sim.mean_travel_time_s,
    completed_fraction: sim.completed_fraction,
    violations: errors,
    warnings,
    hotspots: sim.hotspots.length,
    truncated: sim.truncated,
  };
}

/**
 * Agent-side rules that /validate cannot check because ValidateRequest carries no
 * booth specs: popular booths vs. `popular_door_distance`, missing booths, and an
 * infeasible solve. (Agent-side rule ids are not engine rule ids; source "agent:*".)
 */
export function agentChecks(
  venue: Venue,
  res: LayoutResponse,
  specs: BoothSpec[],
  c: LayoutConstraints,
): Violation[] {
  const out: Violation[] = [];
  if (res.status === "infeasible") {
    out.push({
      rule_id: "layout_infeasible",
      severity: "error",
      message: "Layout solver reported the constraints as infeasible",
      booth_ids: [],
      location: null,
      source: "agent:layout-status",
    });
  }
  const placed = new Set(res.layout.booths.map((b) => b.id));
  const missing = specs.filter((s) => !placed.has(s.id)).map((s) => s.id);
  if (missing.length > 0) {
    out.push({
      rule_id: "booth_missing",
      severity: "error",
      message: `${missing.length} booth(s) not placed: ${missing.join(", ")}`,
      booth_ids: missing,
      location: null,
      source: "agent:completeness",
    });
  }
  if (c.popular_door_distance > 0) {
    const pop = new Map(specs.map((s) => [s.id, s.popularity]));
    for (const b of res.layout.booths) {
      if ((pop.get(b.id) ?? 0) < c.popular_threshold) continue;
      // Same semantics as the engine solver: a square zone of half-width d around each entrance segment.
      if (inPopularZone(boothRect(b), venue, c.popular_door_distance)) {
        out.push({
          rule_id: "popular_door_distance",
          severity: "error",
          message: `Popular booth ${b.id} is inside the ${c.popular_door_distance} m zone around an entrance`,
          booth_ids: [b.id],
          location: center(boothRect(b)),
          source: "agent:constraints",
        });
      }
    }
  }
  return out;
}

export function mergeValidation(engine: ValidateResponse, extra: Violation[]): ValidateResponse {
  const violations = [...engine.violations, ...extra];
  return { ok: violations.every((v) => v.severity !== "error"), violations };
}

export function diffLayouts(prev: Layout | null, next: Layout): BoothMove[] {
  if (!prev) return [];
  const before = new Map(prev.booths.map((b) => [b.id, b]));
  const moves: BoothMove[] = [];
  for (const b of next.booths) {
    const p = before.get(b.id);
    if (p && (Math.abs(p.x - b.x) > 1e-3 || Math.abs(p.y - b.y) > 1e-3)) {
      moves.push({ booth_id: b.id, from: { x: p.x, y: p.y }, to: { x: b.x, y: b.y } });
    }
  }
  return moves;
}

/** Compact, LLM-facing view of one iteration: metrics, hotspots with nearby booth context, violations. */
export function summarizeIteration(args: {
  iteration: number;
  venue: Venue;
  specs: BoothSpec[];
  layout: Layout;
  constraints: LayoutConstraints;
  sim: SimResult | null;
  violations: Violation[];
}) {
  const spec = new Map(args.specs.map((s) => [s.id, s]));
  const pos = new Map(args.layout.booths.map((b) => [b.id, b]));
  const boothInfo = (id: string) => {
    const b = pos.get(id);
    const s = spec.get(id);
    return {
      id,
      label: s?.label ?? id,
      popularity: s?.popularity ?? null,
      pinned: Boolean(args.constraints.fixed[id]),
      position: b ? { x: b.x, y: b.y } : null,
      distance_to_entrance_m: b ? round(distanceToNearestEntrance(boothRect(b), args.venue), 1) : null,
    };
  };
  const popular = args.specs
    .filter((s) => s.popularity >= args.constraints.popular_threshold)
    .map((s) => boothInfo(s.id));
  return {
    iteration: args.iteration,
    hall: { width_m: args.venue.width, height_m: args.venue.height },
    doors: args.venue.doors.map((d) => ({ id: d.id, kind: d.kind, a: d.a, b: d.b })),
    constraints: args.constraints,
    metrics: args.sim
      ? {
          max_density_p_per_m2: args.sim.max_density,
          mean_travel_time_s: args.sim.mean_travel_time_s,
          p90_travel_time_s: args.sim.p90_travel_time_s,
          completed_fraction: args.sim.completed_fraction,
        }
      : null,
    hotspots: (args.sim?.hotspots ?? []).map((h, i) => ({
      index: i,
      zone: h.zone,
      peak_density: h.peak_density,
      mean_density: h.mean_density,
      distance_to_entrance_m: round(distanceToNearestEntrance(h.zone, args.venue), 1),
      nearby_booths: h.nearby_booth_ids.map(boothInfo),
    })),
    popular_booths: popular,
    violations: args.violations.map((v) => ({
      rule_id: v.rule_id,
      severity: v.severity,
      message: v.message,
      booth_ids: v.booth_ids,
    })),
  };
}
export type IterationSummary = ReturnType<typeof summarizeIteration>;

export type IterationOutcome = { iteration: number; metrics: Metrics; valid: boolean };

/** Lowest max density among valid iterations (earliest wins ties); falls back to the last. */
export function bestIteration(history: IterationOutcome[]): number {
  const valid = history.filter((h) => h.valid);
  if (valid.length === 0) return history[history.length - 1]?.iteration ?? 0;
  return valid.reduce((a, b) => (b.metrics.max_density < a.metrics.max_density - 1e-9 ? b : a)).iteration;
}

export function decide(
  history: IterationOutcome[],
  targets: Targets,
  maxIterations: number,
): { decision: Decision; reason: string; best: number } {
  const cur = history[history.length - 1];
  const best = bestIteration(history);
  const m = cur.metrics;
  if (cur.valid && m.max_density <= targets.max_density) {
    return {
      decision: "target_met",
      reason: `max density ${m.max_density} ≤ target ${targets.max_density} p/m² with no validation errors`,
      best,
    };
  }
  if (cur.iteration > 0 && cur.valid) {
    const prevValid = history.slice(0, -1).filter((h) => h.valid);
    if (prevValid.length > 0) {
      const bestPrev = Math.min(...prevValid.map((h) => h.metrics.max_density));
      const rel = (bestPrev - m.max_density) / bestPrev;
      if (rel < targets.min_improvement) {
        return {
          decision: "no_improvement",
          reason: `max density ${m.max_density} vs best so far ${bestPrev} (${round(rel * 100, 1)}% < ${round(targets.min_improvement * 100, 1)}% required)`,
          best,
        };
      }
    }
  }
  if (cur.iteration >= maxIterations) {
    return { decision: "max_iterations", reason: `reached AGENT_MAX_ITERATIONS=${maxIterations}`, best };
  }
  return {
    decision: "continue",
    reason: cur.valid
      ? `max density ${m.max_density} > target ${targets.max_density} p/m²`
      : m.truncated
        ? "simulation was truncated by the engine's wall-time cap; result not comparable"
        : `${m.violations} validation error(s) remain`,
    best,
  };
}
