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
  crowded: (m: Metrics) => `${round(m.crowded_s_per_visitor, 2)} s`,
  personS: (m: Metrics) => `${round(m.crowded_person_s, 0)} person-s`,
  area: (m: Metrics) => `${round(m.peak_crowded_area_m2, 1)} m²`,
  hotspotMean: (m: Metrics) => `${round(m.worst_hotspot_mean_density, 2)} p/m²`,
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

/** "Crowded" in plain words, with the threshold the run locked. */
export const crowdedLabel = (threshold: number) => `Time the average visitor spent in crowded areas (≥ ${threshold} p/m²)`;

export function metricsTable(baseline: Row, final: Row): string {
  const b = baseline.metrics;
  const f = final.metrics;
  return [
    `| Metric | Baseline (iteration ${baseline.iteration}) | Final (iteration ${final.iteration}) | Change |`,
    "|---|---|---|---|",
    `| **${crowdedLabel(b.crowd_threshold)}** | **${fmt.crowded(b)}** | **${fmt.crowded(f)}** | **${change(b.crowded_s_per_visitor, f.crowded_s_per_visitor, " s")}** |`,
    `| Crowded person-seconds (all visitors) | ${fmt.personS(b)} | ${fmt.personS(f)} | ${change(b.crowded_person_s, f.crowded_person_s, "", 0)} |`,
    `| Peak crowded area (at one moment) | ${fmt.area(b)} | ${fmt.area(f)} | ${change(b.peak_crowded_area_m2, f.peak_crowded_area_m2, " m²", 1)} |`,
    `| Worst hotspot, mean density over the run | ${fmt.hotspotMean(b)} | ${fmt.hotspotMean(f)} | ${change(b.worst_hotspot_mean_density, f.worst_hotspot_mean_density, " p/m²")} |`,
    `| p90 travel time | ${fmt.p90(b)} | ${fmt.p90(f)} | ${change(b.p90_travel_time_s, f.p90_travel_time_s, " s", 1)} |`,
    `| Completed fraction | ${fmt.completed(b)} | ${fmt.completed(f)} | ${change(b.completed_fraction * 100, f.completed_fraction * 100, " pt", 1, false)} |`,
    `| Mean travel time | ${fmt.mean(b)} | ${fmt.mean(f)} | ${change(b.mean_travel_time_s, f.mean_travel_time_s, " s", 1)} |`,
    `| Hotspots | ${b.hotspots} | ${f.hotspots} | ${change(b.hotspots, f.hotspots, "", 0, false)} |`,
    `| Validation errors | ${b.violations} | ${f.violations} | ${change(b.violations, f.violations, "", 0, false)} |`,
    `| Max density¹ | ${fmt.density(b)} | ${fmt.density(f)} | ${change(b.max_density, f.max_density, " p/m²")} |`,
    "",
    "¹ Highest density any single grid cell reached at any instant; a momentary peak, shown for reference only. The agent compares and stops on the crowded time per visitor above.",
  ].join("\n");
}

export function historyTable(rows: Row[], maxCompletionDrop = 0.05): string {
  const base = rows[0];
  const comparableLabel = (r: Row) => {
    if (!r.valid) return r.metrics.truncated ? "no (truncated)" : "no";
    if (base && r.metrics.completed_fraction < base.metrics.completed_fraction - maxCompletionDrop - 1e-9) return "no (completion dropped)";
    return "yes";
  };
  return [
    "| Iteration | Crowded s/visitor | Crowded person-s | Peak crowded area (m²) | p90 travel (s) | Completed | Max density (p/m²) | Errors | Comparable |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.iteration} | ${round(r.metrics.crowded_s_per_visitor, 2)} | ${round(r.metrics.crowded_person_s, 0)} | ${round(r.metrics.peak_crowded_area_m2, 1)} | ${round(r.metrics.p90_travel_time_s, 1)} | ${fmt.completed(r.metrics)} | ${round(r.metrics.max_density, 2)} | ${r.metrics.violations} | ${comparableLabel(r)} |`,
    ),
  ].join("\n");
}

export type ReportParts = {
  venue: Venue;
  scenario: Scenario;
  gridCell: number;
  crowdThreshold: number;
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
  const pctChange = (a: number, b: number) => (a > 0 ? ` (${b <= a ? "−" : "+"}${Math.abs(round(((b - a) / a) * 100, 1))}%)` : "");
  const bm = baseline.metrics;
  const fm = final.metrics;
  lines.push(
    `**${crowdedLabel(p.crowdThreshold)}: ${round(bm.crowded_s_per_visitor, 2)} s → ${round(fm.crowded_s_per_visitor, 2)} s${pctChange(bm.crowded_s_per_visitor, fm.crowded_s_per_visitor)}**; crowded person-seconds ${round(bm.crowded_person_s, 0)} → ${round(fm.crowded_person_s, 0)}.`,
    "",
  );
  lines.push(metricsTable(baseline, final), "");
  lines.push(
    `Target: ≤ ${p.targets.crowded_s_per_visitor} s per visitor in crowded areas with no validation errors. An iteration counts as better only if it cuts that by at least ${round(p.targets.min_improvement * 100, 1)}% vs the best so far and its completion stays within ${round(p.targets.max_completion_drop * 100, 1)} pt of the baseline.`,
    "",
    `Identical conditions for every iteration: scenario \`${s.kind}\`, ${s.agents} agents, ${s.duration_s} s, seed ${s.seed}, density grid ${p.gridCell} m, crowded = ≥ ${p.crowdThreshold} p/m² (fingerprint \`${p.fingerprint}\`).`,
    "",
  );
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

  lines.push("## Iteration history", "", historyTable(p.rows, p.targets.max_completion_drop), "");

  lines.push("## Assumptions", "");
  lines.push(
    `- Pedestrian metrics come from the ${p.engineKind === "mock" ? "**mock engine** (synthetic density field for demo purposes, not a pedestrian simulation)" : "engine's JuPedSim simulation"}; one scenario and seed per run, so results are a single sample, not a distribution.`,
    "- Booth popularity values are planning estimates of relative attraction, taken as given.",
    `- A ${p.gridCell} m grid cell counts as crowded while its density is at or above ${p.crowdThreshold} p/m²; crowded person-seconds add up the people standing in crowded cells, sampled once per second, and per visitor divides that by the visitors who entered. Max density is the single highest cell value at any instant; hotspot thresholds are the engine's. Travel times count finished agents only.`,
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
