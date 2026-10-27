/**
 * Report assembly. The LLM writes only the prose ("Summary"); every number —
 * the before/after table, iteration history, applied changes, scenario — is
 * rendered here from tool results, so the report cannot contain invented metrics.
 */
import type { Scenario, Venue } from "@/lib/engine/contract";
import { round } from "@/lib/geometry";
import type { AnalysisInfo, BriefInfo, Decision, Metrics, RevisionInfo, Targets } from "./events";

export const DISCLAIMER =
  "This is a planning draft produced by an AI agent from simulation output. It is not a permit, fire-code or crowd-safety certification; a qualified reviewer must confirm it against the venue's actual conditions and applicable regulations.";

type Row = { iteration: number; metrics: Metrics; valid: boolean };

const fmt = {
  density: (m: Metrics) => `${round(m.max_density, 2)} p/m²`,
  p90: (m: Metrics) => `${round(m.p90_travel_time_s, 1)} s`,
  mean: (m: Metrics) => `${round(m.mean_travel_time_s, 1)} s`,
  completed: (m: Metrics) => `${round(m.completed_fraction * 100, 1)}%`,
};

function change(a: number, b: number, unit = "", digits = 2, pct = true): string {
  const d = round(b - a, digits);
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  const rel = pct && a !== 0 ? ` (${sign}${Math.abs(round(((b - a) / a) * 100, 1))}%)` : "";
  return `${sign}${Math.abs(d)}${unit}${rel}`;
}

export function metricsTable(baseline: Row, final: Row): string {
  const b = baseline.metrics;
  const f = final.metrics;
  return [
    `| Metric | Baseline (iteration ${baseline.iteration}) | Final (iteration ${final.iteration}) | Change |`,
    "|---|---|---|---|",
    `| Max density | ${fmt.density(b)} | ${fmt.density(f)} | ${change(b.max_density, f.max_density, " p/m²")} |`,
    `| p90 travel time | ${fmt.p90(b)} | ${fmt.p90(f)} | ${change(b.p90_travel_time_s, f.p90_travel_time_s, " s", 1)} |`,
    `| Mean travel time | ${fmt.mean(b)} | ${fmt.mean(f)} | ${change(b.mean_travel_time_s, f.mean_travel_time_s, " s", 1)} |`,
    `| Completed fraction | ${fmt.completed(b)} | ${fmt.completed(f)} | ${change(b.completed_fraction * 100, f.completed_fraction * 100, " pt", 1, false)} |`,
    `| Hotspots | ${b.hotspots} | ${f.hotspots} | ${change(b.hotspots, f.hotspots, "", 0, false)} |`,
    `| Validation errors | ${b.violations} | ${f.violations} | ${change(b.violations, f.violations, "", 0, false)} |`,
  ].join("\n");
}

export function historyTable(rows: Row[]): string {
  return [
    "| Iteration | Max density (p/m²) | p90 travel (s) | Completed | Errors | Comparable |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.iteration} | ${round(r.metrics.max_density, 2)} | ${round(r.metrics.p90_travel_time_s, 1)} | ${fmt.completed(r.metrics)} | ${r.metrics.violations} | ${r.valid ? "yes" : r.metrics.truncated ? "no (truncated)" : "no"} |`,
    ),
  ].join("\n");
}

export type ReportParts = {
  venue: Venue;
  scenario: Scenario;
  gridCell: number;
  fingerprint: string;
  targets: Targets;
  engineKind: "mock" | "http";
  llmName: string;
  stopReason: Decision | "error";
  stopDetail: string;
  rows: Row[];
  baselineIteration: number;
  finalIteration: number;
  revisions: RevisionInfo[];
  analyses: AnalysisInfo[];
  brief?: BriefInfo | null;
  remainingWarnings: string[];
};

/** Header (before the LLM narrative). */
export function reportHeader(p: ReportParts): string {
  return `# Layout revision report — ${p.venue.name}\n\n> ${DISCLAIMER}\n\n## Summary\n\n`;
}

/** Everything after the LLM narrative. */
export function reportBody(p: ReportParts): string {
  const byIter = new Map(p.rows.map((r) => [r.iteration, r]));
  const baseline = byIter.get(p.baselineIteration)!;
  const final = byIter.get(p.finalIteration)!;
  const s = p.scenario;
  const lines: string[] = [];
  lines.push("", "## Before / after", "");
  lines.push(
    `Identical conditions for every iteration: scenario \`${s.kind}\`, ${s.agents} agents, ${s.duration_s} s, seed ${s.seed}, density grid ${p.gridCell} m (fingerprint \`${p.fingerprint}\`). Target: max density ≤ ${p.targets.max_density} p/m² with no validation errors.`,
    "",
  );
  lines.push(metricsTable(baseline, final), "");
  lines.push(`Stop reason: **${p.stopReason.replace(/_/g, " ")}** — ${p.stopDetail}.`, "");

  if (p.brief) {
    lines.push("## Design brief (initial constraints)", "");
    lines.push(`${p.brief.rationale}`, "");
    if (p.brief.applied.length === 0) lines.push("- Default constraints kept.");
    for (const a of p.brief.applied) lines.push(`- ${a.effect}`);
    for (const x of p.brief.rejected) lines.push(`- _rejected:_ ${x.reason}`);
    lines.push("", "Booth coordinates were then computed by the layout solver under these constraints.", "");
  }

  lines.push("## What changed and why", "");
  // Improvements after iteration N shape iteration N+1; validation fixes act within iteration N.
  const changes = p.revisions.filter(
    (r) =>
      r.applied.length > 0 &&
      (r.purpose === "improve" ? r.iteration < p.finalIteration : r.iteration <= p.finalIteration),
  );
  if (changes.length === 0) lines.push("No changes were applied to the baseline layout.", "");
  for (const r of changes) {
    const label =
      r.purpose === "fix_validation"
        ? `Validation fix in iteration ${r.iteration}`
        : `Revision after iteration ${r.iteration} → ${r.iteration + 1}`;
    lines.push(`**${label}.** ${r.rationale}`, "");
    for (const a of r.applied) lines.push(`- ${a.effect}`);
    for (const x of r.rejected) lines.push(`- _rejected:_ ${x.reason}`);
    lines.push("");
  }

  lines.push("## Iteration history", "", historyTable(p.rows), "");

  lines.push("## Assumptions", "");
  lines.push(
    `- Pedestrian metrics come from the ${p.engineKind === "mock" ? "**mock engine** (synthetic density field for demo purposes, not a pedestrian simulation)" : "engine's JuPedSim simulation"}; one scenario and seed per run, so results are a single sample, not a distribution.`,
    "- Booth popularity values are planning estimates of relative attraction, taken as given.",
    "- Densities are peak values per grid cell over the run; hotspot thresholds are the engine's. Travel times count finished agents only.",
    "- Geometric checks cover booth/obstacle/door-clearance/aisle rules only; egress capacity, fire code and accessibility were not assessed.",
    `- Analysis and revision proposals by \`${p.llmName}\`; all metrics and coordinates in this report are computed by tools.`,
    "",
  );

  lines.push("## Unconfirmed items", "");
  const unk = [...p.venue.unknowns.map((u) => `${u} (from floor plan)`), ...p.remainingWarnings];
  if (final.metrics.violations > 0) unk.push(`${final.metrics.violations} validation error(s) remain in the final layout`);
  if (p.engineKind === "mock") unk.push("Results not yet re-run on the real engine (OR-Tools layout, Shapely validation, JuPedSim)");
  lines.push(...(unk.length ? unk.map((u) => `- ${u}`) : ["- None reported."]), "");

  lines.push("---", "", `_${DISCLAIMER}_`, "");
  return lines.join("\n");
}
