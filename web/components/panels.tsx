"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metrics, StepInfo } from "@/lib/agent/events";
import type { IterationView } from "@/lib/ui/run-state";

const n = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

export function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const STATUS_DOT: Record<StepInfo["status"], string> = {
  running: "bg-sky-500 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-rose-500",
  skipped: "bg-zinc-400",
};

/** Latest status per step id, in first-seen order, grouped by iteration. */
export function Timeline({ steps }: { steps: StepInfo[] }) {
  const latest = new Map<string, StepInfo>();
  for (const s of steps) latest.set(s.id, s);
  const groups = new Map<number, StepInfo[]>();
  for (const s of latest.values()) {
    if (!groups.has(s.iteration)) groups.set(s.iteration, []);
    groups.get(s.iteration)!.push(s);
  }
  if (latest.size === 0) return <p className="text-sm text-[var(--muted)]">No run yet. Start a live run or watch the sample run.</p>;
  return (
    <ol className="space-y-3">
      {[...groups.entries()].map(([it, list]) => (
        <li key={it}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {list.every((s) => s.step === "report") ? "Report" : it === 0 ? "Iteration 0 · baseline" : `Iteration ${it}`}
          </div>
          <ul className="space-y-1">
            {list.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`} />
                <span className="min-w-0">
                  <span className="font-medium">{s.title}</span>
                  {s.detail && <span className="block break-words text-xs text-[var(--muted)]">{s.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function MetricCards({
  iterations,
  selected,
  onSelect,
  target,
}: {
  iterations: IterationView[];
  selected: number;
  onSelect: (i: number) => void;
  target?: number;
}) {
  const withSim = iterations.filter((i) => i.sim);
  if (withSim.length === 0) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
      {withSim.map((it) => {
        const m = it.sim!.metrics;
        const ok = it.comparison?.valid;
        const active = it.iteration === selected;
        return (
          <button
            key={it.iteration}
            type="button"
            onClick={() => onSelect(it.iteration)}
            aria-pressed={active}
            className={`rounded-md border p-2 text-left text-xs transition-colors ${
              active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--hover)]"
            }`}
          >
            <div className="mb-1 flex items-center justify-between font-semibold">
              <span>{it.iteration === 0 ? "Baseline" : `Iter ${it.iteration}`}</span>
              <span className={ok ? "text-emerald-600" : "text-rose-600"}>{ok ? "valid" : m.truncated ? "truncated" : "invalid"}</span>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
              <dt className="text-[var(--muted)]">Max density</dt>
              <dd className={`text-right font-mono ${target !== undefined && m.max_density <= target ? "text-emerald-600" : ""}`}>{n(m.max_density)}</dd>
              <dt className="text-[var(--muted)]">p90 travel</dt>
              <dd className="text-right font-mono">{n(m.p90_travel_time_s, 0)}s</dd>
              <dt className="text-[var(--muted)]">Completed</dt>
              <dd className="text-right font-mono">{n(m.completed_fraction * 100, 1)}%</dd>
              <dt className="text-[var(--muted)]">Errors</dt>
              <dd className="text-right font-mono">{m.violations}</dd>
            </dl>
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
  return (
    <span className={zero ? "text-[var(--muted)]" : good ? "text-emerald-600" : "text-rose-600"}>
      {zero ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}${unit}`}
    </span>
  );
}

export function Comparison({ baseline, final, finalIteration }: { baseline: Metrics; final: Metrics; finalIteration: number }) {
  const rows: { label: string; a: number; b: number; fmt: (v: number) => string; lower?: boolean; digits?: number; unit?: string }[] = [
    { label: "Max density (p/m²)", a: baseline.max_density, b: final.max_density, fmt: (v) => n(v) },
    { label: "p90 travel time", a: baseline.p90_travel_time_s, b: final.p90_travel_time_s, fmt: (v) => `${n(v, 1)} s`, digits: 1, unit: " s" },
    { label: "Completed", a: baseline.completed_fraction * 100, b: final.completed_fraction * 100, fmt: (v) => `${n(v, 1)}%`, lower: false, digits: 1, unit: " pt" },
    { label: "Violations (errors)", a: baseline.violations, b: final.violations, fmt: (v) => String(v), digits: 0 },
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-[var(--muted)]">
          <th className="py-1 font-medium">Metric</th>
          <th className="py-1 text-right font-medium">Baseline</th>
          <th className="py-1 text-right font-medium">Final (iter {finalIteration})</th>
          <th className="py-1 text-right font-medium">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-[var(--border)]">
            <td className="py-1.5">{r.label}</td>
            <td className="py-1.5 text-right font-mono">{r.fmt(r.a)}</td>
            <td className="py-1.5 text-right font-mono">{r.fmt(r.b)}</td>
            <td className="py-1.5 text-right font-mono">
              <Delta a={r.a} b={r.b} lowerIsBetter={r.lower ?? true} digits={r.digits ?? 2} unit={r.unit} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Report({ markdown }: { markdown: string }) {
  return (
    <div className="report text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
