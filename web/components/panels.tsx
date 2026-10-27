"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BriefInfo, Metrics, RunInfo, StepInfo } from "@/lib/agent/events";
import { ACTOR_ORDER, ACTORS, STEP_ACTORS, STEP_ROLE, type ActorId } from "@/lib/ui/actors";
import type { IterationView } from "@/lib/ui/run-state";
import { ActorTag, Badge } from "./ui";

export { Card } from "./ui";

const n = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

const STATUS_DOT: Record<StepInfo["status"], string> = {
  running: "bg-accent animate-pulse",
  done: "bg-ink-soft",
  error: "bg-bad",
  skipped: "bg-faint",
};

function latestSteps(steps: StepInfo[]): StepInfo[] {
  const latest = new Map<string, StepInfo>();
  for (const s of steps) latest.set(s.id, s);
  return [...latest.values()];
}

/** Which actors are working right now (running steps). */
export function activeActors(steps: StepInfo[]): Set<ActorId> {
  const out = new Set<ActorId>();
  for (const s of latestSteps(steps)) if (s.status === "running") for (const a of STEP_ACTORS[s.step]) out.add(a);
  return out;
}

/** The roster: every component, its role, and whether it is working now. */
export function Roles({ steps, run }: { steps: StepInfo[]; run?: RunInfo }) {
  const active = activeActors(steps);
  const used = new Set(latestSteps(steps).flatMap((s) => STEP_ACTORS[s.step]));
  return (
    <ul className="divide-y divide-hairline">
      {ACTOR_ORDER.map((id) => {
        const a = ACTORS[id];
        const idle = id === "simpy";
        const stub = id === "muse" && run?.llm === "stub";
        const mock = run?.engine === "mock" && (id === "ortools" || id === "shapely" || id === "jupedsim");
        return (
          <li key={id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <span className="flex w-[4.6rem] shrink-0 items-center gap-1.5 pt-px">
              <ActorTag id={id} dim={idle} />
            </span>
            <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-soft">
              <span className={idle ? "text-muted" : ""}>{a.role}</span>
              {(stub || mock || idle) && (
                <span className="mt-0.5 block text-[11px] text-faint">
                  {idle ? "Idle — available, not used in this loop." : stub ? "This run: rule-based stub stands in for Muse." : "This run: deterministic mock engine stands in (synthetic results)."}
                </span>
              )}
            </span>
            <span className="w-12 shrink-0 pt-0.5 text-right text-[10.5px] font-medium">
              {active.has(id) ? <span className="text-accent">working</span> : used.has(id) ? <span className="text-faint">done</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Latest status per step id, in first-seen order, grouped: design brief, iterations, report. */
export function Pipeline({ steps }: { steps: StepInfo[] }) {
  const list = latestSteps(steps);
  if (list.length === 0)
    return <p className="text-[12.5px] text-muted">No run yet. Watch the recorded run, or start a live run, to see each step and who performs it.</p>;
  const groups: { key: string; label: string; items: StepInfo[] }[] = [];
  for (const s of list) {
    const key = s.step === "brief" ? "brief" : s.step === "report" ? "report" : `it-${s.iteration}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: s.step === "brief" ? "Design brief" : s.step === "report" ? "Report" : s.iteration === 0 ? "Baseline · iteration 0" : `Iteration ${s.iteration}`, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }
  return (
    <ol className="space-y-4">
      {groups.map((g) => (
        <li key={g.key}>
          <div className="eyebrow mb-1.5">{g.label}</div>
          <ul className="relative space-y-2 border-l border-hairline pl-3.5">
            {g.items.map((s) => (
              <li key={s.id} className="relative" title={STEP_ROLE[s.step]}>
                <span className={`absolute -left-[18.5px] top-[5px] h-[7px] w-[7px] rounded-full ring-2 ring-surface ${STATUS_DOT[s.status]}`} />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-[12.5px] font-medium ${s.status === "error" ? "text-bad" : "text-ink"}`}>{s.title}</span>
                  <span className="ml-auto flex gap-1">
                    {STEP_ACTORS[s.step].map((a) => (
                      <ActorTag key={a} id={a} />
                    ))}
                  </span>
                </div>
                {s.status === "running" ? (
                  <span className="block text-[11.5px] text-accent">{STEP_ROLE[s.step]}</span>
                ) : (
                  s.detail && <span className="num block break-words text-[11px] text-muted">{s.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function BriefPanel({ brief }: { brief: BriefInfo }) {
  return (
    <div className="space-y-3 text-[12.5px]">
      <p className="leading-relaxed text-ink-soft">{brief.rationale}</p>
      <div>
        <div className="eyebrow mb-1.5">Constraints code derived from it</div>
        {brief.applied.length === 0 ? (
          <p className="text-muted">Standard constraints kept.</p>
        ) : (
          <ul className="space-y-1">
            {brief.applied.map((a, i) => (
              <li key={i} className="num flex gap-2 text-[11.5px] text-ink-soft">
                <span className="mt-[7px] h-px w-2 shrink-0 bg-accent" />
                {a.effect}
              </li>
            ))}
          </ul>
        )}
        {brief.rejected.map((r, i) => (
          <p key={i} className="mt-1 text-[11.5px] text-bad">
            rejected: {r.reason}
          </p>
        ))}
      </div>
      <p className="text-[11px] text-faint">Muse chose the constraint values; OR-Tools computes every coordinate. By {brief.by}.</p>
    </div>
  );
}

const pctChange = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : b > 0 ? Infinity : 0);

export function MetricCards({
  iterations,
  selected,
  onSelect,
  target,
  finalIteration,
}: {
  iterations: IterationView[];
  selected: number;
  onSelect: (i: number) => void;
  /** Target crowded seconds per visitor. */
  target?: number;
  finalIteration?: number;
}) {
  const withSim = iterations.filter((i) => i.sim);
  if (withSim.length === 0) return null;
  const base = withSim.find((i) => i.iteration === 0)?.sim?.metrics;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.4rem,1fr))] gap-2">
      {withSim.map((it) => {
        const m = it.sim!.metrics;
        const ok = it.comparison?.valid;
        const guard = it.comparison && !it.comparison.completionOk;
        const active = it.iteration === selected;
        const met = target !== undefined && m.crowded_s_per_visitor <= target;
        const ch = base && it.iteration !== 0 ? pctChange(base.crowded_s_per_visitor, m.crowded_s_per_visitor) : null;
        return (
          <button
            key={it.iteration}
            type="button"
            onClick={() => onSelect(it.iteration)}
            aria-pressed={active}
            className={`rounded-[5px] border p-2.5 text-left transition-colors ${active ? "border-accent bg-accent-soft/60" : "border-hairline hover:border-hairline-strong"}`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="text-[11.5px] font-semibold text-ink">
                {it.iteration === 0 ? "Baseline" : `Iter ${it.iteration}`}
                {finalIteration === it.iteration && it.iteration !== 0 ? <span className="ml-1 text-accent">final</span> : null}
              </span>
              <span className={`text-[10.5px] ${ok && !guard ? "text-ok" : "text-bad"}`}>
                {!ok ? (m.truncated ? "truncated" : "invalid") : guard ? "completion ↓" : "valid"}
              </span>
            </div>
            <div className="num text-[21px] font-medium leading-none text-ink">
              {n(m.crowded_s_per_visitor, 1)}
              <span className="ml-1 font-sans text-[10.5px] font-normal text-muted">s crowded</span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1 text-[10.5px] text-muted">
              <span>per visitor</span>
              {ch !== null && Number.isFinite(ch) && (
                <span className={`num ${ch < 0 ? "text-ok" : ch > 0 ? "text-bad" : "text-faint"}`}>
                  {ch > 0 ? "+" : ch < 0 ? "−" : "±"}
                  {Math.abs(ch).toFixed(0)}%
                </span>
              )}
            </div>
            {target !== undefined && (
              <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-sunken" title={`target ≤ ${target} s per visitor`}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (m.crowded_s_per_visitor / (target * 1.8)) * 100)}%`, background: met ? "var(--ok)" : "var(--heat-2)" }} />
              </div>
            )}
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-[11px]">
              <dt className="text-muted">Person-s</dt>
              <dd className="num text-right text-ink-soft">{n(m.crowded_person_s, 0)}</dd>
              <dt className="text-muted">Crowded area</dt>
              <dd className="num text-right text-ink-soft">{n(m.peak_crowded_area_m2, 0)} m²</dd>
              <dt className="text-muted">Hotspot mean</dt>
              <dd className="num text-right text-ink-soft">{n(m.worst_hotspot_mean_density)}</dd>
              <dt className="text-muted">p90 travel</dt>
              <dd className="num text-right text-ink-soft">{n(m.p90_travel_time_s, 0)} s</dd>
              <dt className="text-muted">Completed</dt>
              <dd className="num text-right text-ink-soft">{n(m.completed_fraction * 100, 0)}%</dd>
              <dt className="text-muted">Errors</dt>
              <dd className="num text-right text-ink-soft">{m.violations}</dd>
            </dl>
            <div className="num mt-1.5 border-t border-hairline pt-1 text-[10px] text-faint">max {n(m.max_density)} p/m²</div>
          </button>
        );
      })}
    </div>
  );
}

function Delta({ a, b, lowerIsBetter = true, digits = 2, unit = "" }: { a: number; b: number; lowerIsBetter?: boolean; digits?: number; unit?: string }) {
  const d = b - a;
  const good = lowerIsBetter ? d < 0 : d > 0;
  const zero = Math.abs(d) < 10 ** -digits / 2;
  return <span className={zero ? "text-faint" : good ? "text-ok" : "text-bad"}>{zero ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}${unit}`}</span>;
}

export function Comparison({ baseline, final, finalIteration, target }: { baseline: Metrics; final: Metrics; finalIteration: number; target?: number }) {
  const ch = pctChange(baseline.crowded_s_per_visitor, final.crowded_s_per_visitor);
  const rows: { label: string; unit?: string; a: number; b: number; fmt: (v: number) => string; lower?: boolean; digits?: number; dunit?: string }[] = [
    { label: "Crowded person-seconds", a: baseline.crowded_person_s, b: final.crowded_person_s, fmt: (v) => n(v, 0), digits: 0 },
    { label: "Peak crowded area", unit: "m²", a: baseline.peak_crowded_area_m2, b: final.peak_crowded_area_m2, fmt: (v) => n(v, 1), digits: 1 },
    { label: "Worst hotspot mean", unit: "p/m²", a: baseline.worst_hotspot_mean_density, b: final.worst_hotspot_mean_density, fmt: (v) => n(v) },
    { label: "p90 travel time", a: baseline.p90_travel_time_s, b: final.p90_travel_time_s, fmt: (v) => `${n(v, 1)} s`, digits: 1, dunit: " s" },
    { label: "Completed", a: baseline.completed_fraction * 100, b: final.completed_fraction * 100, fmt: (v) => `${n(v, 1)}%`, lower: false, digits: 1, dunit: " pt" },
    { label: "Validation errors", a: baseline.violations, b: final.violations, fmt: (v) => String(v), digits: 0 },
  ];
  return (
    <div>
      <div className="text-[11.5px] text-muted">Time the average visitor spent in crowded areas</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="num text-[15px] text-muted">{n(baseline.crowded_s_per_visitor, 1)} s</span>
        <span className="text-faint">→</span>
        <span className="num text-[28px] font-medium leading-none text-ink">{n(final.crowded_s_per_visitor, 1)} s</span>
        {Number.isFinite(ch) && (
          <span className={`num text-[13px] font-medium ${ch < 0 ? "text-ok" : ch > 0 ? "text-bad" : "text-faint"}`}>
            {ch > 0 ? "+" : ch < 0 ? "−" : "±"}
            {Math.abs(ch).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-faint">
        crowded = ≥ {final.crowd_threshold} p/m²{target !== undefined && ` · target ≤ ${target} s per visitor`} · iter {finalIteration} vs baseline
      </div>
      <table className="mt-3 w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-[0.06em] text-muted">
            <th className="pb-1.5 font-medium">Metric</th>
            <th className="pb-1.5 text-right font-medium">Baseline</th>
            <th className="pb-1.5 text-right font-medium">Iter {finalIteration}</th>
            <th className="pb-1.5 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-hairline">
              <td className="py-1.5 text-ink-soft">
                {r.label}
                {r.unit && <span className="text-faint"> {r.unit}</span>}
              </td>
              <td className="num py-1.5 text-right text-muted">{r.fmt(r.a)}</td>
              <td className="num py-1.5 text-right text-ink">{r.fmt(r.b)}</td>
              <td className="num py-1.5 text-right">
                <Delta a={r.a} b={r.b} lowerIsBetter={r.lower ?? true} digits={r.digits ?? 2} unit={r.dunit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="num mt-2 text-[11px] text-faint">
        Max density (single-instant peak): {n(baseline.max_density)} → {n(final.max_density)} p/m²
      </p>
    </div>
  );
}

export function Conditions({ run }: { run: RunInfo }) {
  const s = run.scenario;
  const item = (k: string, v: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-hairline py-1.5 first:border-t-0 first:pt-0">
      <dt className="text-muted">{k}</dt>
      <dd className="num text-right text-ink-soft">{v}</dd>
    </div>
  );
  return (
    <div className="text-[12px]">
      <dl>
        {item("Scenario", `${s.kind} · ${s.agents} agents · ${s.duration_s} s`)}
        {item("Seed · grid", `${s.seed} · ${run.gridCell} m`)}
        {item("Crowded", `≥ ${run.crowdThreshold ?? 2} p/m² (grid cell)`)}
        {item("Target", `≤ ${run.targets.crowded_s_per_visitor} s crowded per visitor`)}
        {item("Better if", `−${Math.round(run.targets.min_improvement * 100)}% vs best · completion ≥ baseline −${Math.round(run.targets.max_completion_drop * 100)} pt`)}
        {item("Revisions", `up to ${run.maxIterations}`)}
        {item("Fingerprint", run.scenarioFingerprint)}
      </dl>
      <p className="mt-2 text-[11px] text-faint">Locked by code for every iteration, so before/after differ only in the layout.</p>
    </div>
  );
}

export function Report({ markdown }: { markdown: string }) {
  return (
    <div className="report text-[13px] leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

export { Badge };
