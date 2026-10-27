"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { diffLayouts } from "@/lib/agent/analysis";
import type { AgentUIMessage, BoothMove, RunInfo } from "@/lib/agent/events";
import type { BoothSpec, ProjectInput, Venue } from "@/lib/engine/contract";
import { simulateRequestFor } from "@/lib/trajectory/request";
import { deriveRunState, type IterationView } from "@/lib/ui/run-state";
import { Hall3DCompare, Hall3DPanel, type ViewSpec } from "./hall-3d";
import { HallLegend, HallView } from "./hall-view";
import { Card, Comparison, MetricCards, Report, Timeline } from "./panels";

type Status = { live: boolean; engine: string; llm: string; maxIterations: number };

const iterLabel = (n: number) => (n === 0 ? "Baseline" : `Iter ${n}`);

/** 3D view inputs for one iteration; trajectories are fetched only once it has been simulated. */
function viewFor(
  run: RunInfo | undefined,
  venue: Venue,
  specs: BoothSpec[],
  it: IterationView | undefined,
  opts: { showHeatmap: boolean; moves?: BoothMove[]; title?: string },
): ViewSpec {
  const layout = it?.layout?.response.layout;
  return {
    title: opts.title,
    durationS: run?.scenario.duration_s,
    scene: {
      venue,
      specs,
      layout,
      grid: it?.sim?.result.grid,
      hotspots: it?.sim?.result.hotspots,
      moves: opts.moves ?? it?.layout?.moves,
      popularThreshold: it?.layout?.constraints.popular_threshold,
      showHeatmap: opts.showHeatmap,
    },
    source:
      run && layout && it?.sim
        ? { runId: it.sim.result.run_id, mode: run.mode, request: simulateRequestFor(run, layout, it.sim) }
        : undefined,
  };
}

export function ReviewConsole({ project }: { project: ProjectInput }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [mode, setMode] = useState<"live" | "replay" | null>(null);
  const [hallView, setHallView] = useState<"2d" | "3d">("2d");
  /** Iteration compared against the baseline in the before/after replay (null = closed). */
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport<AgentUIMessage>({ api: "/api/agent" }), []);
  const { messages, sendMessage, setMessages, status: chatStatus, error, stop, clearError } = useChat<AgentUIMessage>({
    transport,
  });

  useEffect(() => {
    let alive = true;
    fetch("/api/agent")
      .then((r) => r.json())
      .then((s: Status) => alive && setStatus(s))
      .catch(() => alive && setStatus({ live: false, engine: "unknown", llm: "unknown", maxIterations: 0 }));
    return () => {
      alive = false;
    };
  }, []);

  const busy = chatStatus === "submitted" || chatStatus === "streaming";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const state = useMemo(() => deriveRunState(lastAssistant), [lastAssistant]);

  const start = (m: "live" | "replay") => {
    clearError();
    setMessages([]);
    setSelected(null);
    setCompareWith(null);
    setMode(m);
    void sendMessage({ text: m === "live" ? "Start live run" : "Replay sample run" }, { body: { mode: m } });
  };

  const venue = state.run?.venue ?? project.venue;
  const specs = state.run?.booths ?? project.booths;
  const latestWithLayout = [...state.iterations].reverse().find((i) => i.layout);
  const current = state.iterations.find((i) => i.iteration === selected) ?? latestWithLayout;
  const constraints = current?.layout?.constraints ?? state.run?.initialConstraints;
  const finalIt = state.done ? state.iterations.find((i) => i.iteration === state.done!.finalIteration) : undefined;
  const simulated = state.iterations.filter((i) => i.sim && i.layout);
  const baselineIt = simulated.find((i) => i.iteration === 0);
  const compareIt = compareWith === null ? undefined : simulated.find((i) => i.iteration === compareWith);
  const canCompare = Boolean(baselineIt) && simulated.length > 1;
  const openCompare = (n?: number) => {
    const pick = n ?? (current && current.iteration !== 0 && current.sim ? current.iteration : (finalIt?.iteration ?? simulated[simulated.length - 1]?.iteration));
    if (pick !== undefined && pick !== 0) setCompareWith(pick);
  };
  useEffect(() => {
    if (compareWith !== null) compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [compareWith]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Autonomous Event Layout Engineer</h1>
          <p className="text-sm text-[var(--muted)]">
            {venue.name} · {specs.length} booths · review console
            {state.run && (
              <>
                {" "}
                · <span className="font-medium">{state.run.mode === "replay" ? "replay of recorded run" : "live run"}</span> · engine {state.run.engine} · LLM {state.run.llm}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => start("live")}
            disabled={busy || !status?.live}
            title={status && !status.live ? "Live runs are disabled on this server (LIVE_AGENT is not on)" : undefined}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start live run
          </button>
          <button
            type="button"
            onClick={() => start("replay")}
            disabled={busy}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--hover)] disabled:opacity-40"
          >
            Watch sample run
          </button>
          {busy && (
            <button type="button" onClick={() => void stop()} className="rounded-md px-3 py-1.5 text-sm text-rose-600 hover:bg-[var(--hover)]">
              Stop
            </button>
          )}
        </div>
      </header>

      {status && !status.live && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
          Live agent is switched off on this server; “Watch sample run” streams a recorded run of the same loop (mock engine, rule-based reviewer).
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {mode === "live" ? "Live run failed: " : ""}
          {error.message}
          {mode === "live" && (
            <button type="button" className="ml-2 underline" onClick={() => start("replay")}>
              Watch the sample run instead
            </button>
          )}
        </p>
      )}
      {state.errors.map((e, i) => (
        <p key={i} className={`rounded-md px-3 py-2 text-xs ${e.recoverable ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
          {e.recoverable ? "Note: " : "Error: "}
          {e.message}
        </p>
      ))}

      {compareIt && baselineIt && (
        <div ref={compareRef} className="scroll-mt-4">
          <Card
            title={`Before / after replay · Baseline vs ${iterLabel(compareIt.iteration)}`}
            right={
              <div className="flex flex-wrap items-center gap-1">
                {simulated
                  .filter((i) => i.iteration !== 0)
                  .map((i) => (
                    <button
                      key={i.iteration}
                      type="button"
                      aria-pressed={i.iteration === compareIt.iteration}
                      onClick={() => setCompareWith(i.iteration)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${i.iteration === compareIt.iteration ? "bg-[var(--accent)] text-white" : "bg-[var(--hover)]"}`}
                    >
                      {iterLabel(i.iteration)}
                      {state.done?.finalIteration === i.iteration ? " ★" : ""}
                    </button>
                  ))}
                <button type="button" onClick={() => setCompareWith(null)} className="ml-1 rounded px-2 py-0.5 text-xs hover:bg-[var(--hover)]" aria-label="Close before/after replay">
                  ✕
                </button>
              </div>
            }
          >
            <Hall3DCompare
              before={viewFor(state.run, venue, specs, baselineIt, {
                showHeatmap: showHeat,
                moves: [],
                title: `Baseline · max ${baselineIt.sim!.metrics.max_density.toFixed(2)} p/m²`,
              })}
              after={viewFor(state.run, venue, specs, compareIt, {
                showHeatmap: showHeat,
                moves: diffLayouts(baselineIt.layout!.response.layout, compareIt.layout!.response.layout),
                title: `${iterLabel(compareIt.iteration)} · max ${compareIt.sim!.metrics.max_density.toFixed(2)} p/m²`,
              })}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Same agents, same scenario and seed; only the layout differs. Purple booths moved relative to the baseline.
              {state.run?.engine === "mock" && " Mock engine: trajectories are synthetic aisle-following walkers, not a pedestrian model."}
            </p>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* left: hall */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title={current ? (current.iteration === 0 ? "Hall · baseline layout" : `Hall · iteration ${current.iteration}`) : "Hall · venue"}
            right={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
                  Density heatmap
                </label>
                <span className="flex overflow-hidden rounded-md border border-[var(--border)] text-xs" role="group" aria-label="Hall view">
                  {(["2d", "3d"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={hallView === v}
                      onClick={() => setHallView(v)}
                      className={`px-2 py-0.5 font-medium ${hallView === v ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--hover)]"}`}
                    >
                      {v.toUpperCase()}
                    </button>
                  ))}
                </span>
                {canCompare && (
                  <button type="button" onClick={() => openCompare()} className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs font-medium hover:bg-[var(--hover)]">
                    Before / after 3D
                  </button>
                )}
              </div>
            }
          >
            {state.iterations.some((i) => i.layout) && (
              <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Iteration">
                {state.iterations
                  .filter((i) => i.layout)
                  .map((i) => (
                    <button
                      key={i.iteration}
                      role="tab"
                      type="button"
                      aria-selected={current?.iteration === i.iteration}
                      onClick={() => setSelected(i.iteration)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        current?.iteration === i.iteration ? "bg-[var(--accent)] text-white" : "bg-[var(--hover)]"
                      }`}
                    >
                      {i.iteration === 0 ? "Baseline" : `Iter ${i.iteration}`}
                      {state.done?.finalIteration === i.iteration && state.iterations.length > 1 ? " ★" : ""}
                    </button>
                  ))}
              </div>
            )}
            {hallView === "3d" ? (
              <Hall3DPanel view={viewFor(state.run, venue, specs, current, { showHeatmap: showHeat })} />
            ) : (
              <>
                <HallView
                  venue={venue}
                  specs={specs}
                  layout={current?.layout?.response.layout}
                  grid={current?.sim?.result.grid}
                  hotspots={current?.sim?.result.hotspots}
                  moves={current?.layout?.moves}
                  keepOut={constraints?.keep_out}
                  popularThreshold={constraints?.popular_threshold}
                  doorClearance={constraints?.door_clearance}
                  showHeatmap={showHeat}
                />
                <div className="mt-2">
                  <HallLegend />
                </div>
              </>
            )}
          </Card>

          {current && (
            <Card title={`What the agent saw and did · ${current.iteration === 0 ? "baseline" : `iteration ${current.iteration}`}`}>
              <div className="space-y-3 text-sm">
                {current.layout && current.layout.moves.length > 0 && (
                  <p>
                    <span className="font-medium">Moved vs previous iteration:</span>{" "}
                    {current.layout.moves.map((m) => m.booth_id).join(", ")}
                  </p>
                )}
                {current.validation && (
                  <div>
                    <span className="font-medium">Validation:</span>{" "}
                    {current.validation.errors === 0 ? "no errors" : `${current.validation.errors} error(s)`}
                    {current.validation.warnings > 0 && `, ${current.validation.warnings} warning(s)`}
                    {current.validation.result.violations.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs text-[var(--muted)]">
                        {current.validation.result.violations.slice(0, 8).map((v, i) => (
                          <li key={i}>
                            <span className={v.severity === "error" ? "text-rose-600" : "text-amber-600"}>{v.rule_id}</span>: {v.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {current.fixes.map((f, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium">Validation fix:</span> {f.rationale}
                    <ul className="list-disc pl-5 text-[var(--muted)]">
                      {f.applied.map((a, j) => (
                        <li key={j}>{a.effect}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {current.comparison && (
                  <p>
                    <span className="font-medium">Decision:</span> {current.comparison.decision.replace(/_/g, " ")} — {current.comparison.reason}
                  </p>
                )}
                {current.analysis && (
                  <div>
                    <span className="font-medium">Analysis ({current.analysis.by}):</span> {current.analysis.summary}
                    {current.analysis.causes.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs text-[var(--muted)]">
                        {current.analysis.causes.map((c, i) => (
                          <li key={i}>
                            Hotspot #{c.hotspot_index}: {c.cause}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {current.revision && (
                  <div>
                    <span className="font-medium">Revision → iteration {current.iteration + 1}:</span> {current.revision.rationale}
                    <ul className="mt-1 list-disc pl-5 text-xs text-[var(--muted)]">
                      {current.revision.applied.map((a, i) => (
                        <li key={i}>{a.effect}</li>
                      ))}
                      {current.revision.rejected.map((r, i) => (
                        <li key={`r${i}`} className="text-rose-600">
                          rejected: {r.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* right: timeline, metrics, comparison, report */}
        <div className="flex min-w-0 flex-col gap-4">
          {state.run && (
            <Card title="Identical conditions">
              <p className="text-xs text-[var(--muted)]">
                Scenario <span className="font-mono">{state.run.scenario.kind}</span>, {state.run.scenario.agents} agents, {state.run.scenario.duration_s} s, seed{" "}
                {state.run.scenario.seed}, grid {state.run.gridCell} m — locked for every iteration (fingerprint{" "}
                <span className="font-mono">{state.run.scenarioFingerprint}</span>). Target: max density ≤ {state.run.targets.max_density} p/m², up to{" "}
                {state.run.maxIterations} revisions.
              </p>
            </Card>
          )}
          {state.iterations.some((i) => i.sim) && (
            <Card title="Iterations">
              <MetricCards iterations={state.iterations} selected={current?.iteration ?? -1} onSelect={setSelected} target={state.run?.targets.max_density} />
            </Card>
          )}
          {state.done?.baseline && state.done.final && (
            <Card title="Before / after" right={<span className="text-xs text-[var(--muted)]">stop: {state.done.stopReason.replace(/_/g, " ")}</span>}>
              <Comparison baseline={state.done.baseline} final={state.done.final} finalIteration={state.done.finalIteration} />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {canCompare && (
                  <button
                    type="button"
                    className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white"
                    onClick={() => openCompare(state.done!.finalIteration)}
                  >
                    ▶ Replay before / after in 3D
                  </button>
                )}
                {finalIt && finalIt.iteration !== current?.iteration && (
                  <button type="button" className="text-xs text-[var(--accent)] underline" onClick={() => setSelected(finalIt.iteration)}>
                    Show final layout
                  </button>
                )}
              </div>
            </Card>
          )}
          <Card title="Run timeline" right={busy ? <span className="text-xs text-sky-600">streaming…</span> : undefined}>
            <div className="max-h-[28rem] overflow-y-auto pr-1">
              <Timeline steps={state.steps} />
            </div>
          </Card>
          {(state.report || state.reportText) && (
            <Card title="Report for reviewer">
              <Report markdown={state.report?.markdown ?? state.reportText} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
