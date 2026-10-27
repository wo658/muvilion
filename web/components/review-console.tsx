"use client";

import { useChat, type Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { diffLayouts } from "@/lib/agent/analysis";
import type { AgentUIMessage } from "@/lib/agent/events";
import { latestRunMessage, runUserMessage } from "@/lib/chat/transport";
import { ACTORS, STEP_ACTORS } from "@/lib/ui/actors";
import { ruleLabel } from "@/lib/ui/rules";
import { deriveRunState } from "@/lib/ui/run-state";
import { DEFAULT_VENUE_ID, runRequestBody, venueById, VENUES } from "@/lib/venues";
import { Hall3DCompare } from "./hall-3d";
import { HowItWorks } from "./how-it-works";
import { BriefPanel, Comparison, Conditions, MetricCards, Pipeline, Report, Roles } from "./panels";
import { placementKey, Stage, viewFor } from "./stage";
import { ActorTag, Badge, Button, Kpi, PaneSection, Segmented, Tabs } from "./ui";

type Status = { live: boolean; engine: string; llm: string; maxIterations: number };

const iterLabel = (n: number) => (n === 0 ? "Baseline" : `Iter ${n}`);

export type ReviewConsoleProps = {
  /** Shared chat (the simple view's run), so Details shows the same run; omitted = its own. */
  chat?: Chat<AgentUIMessage>;
  /** Controlled venue (with onVenueChange); omitted = the console keeps its own. */
  venueId?: string;
  onVenueChange?: (id: string) => void;
  /** Shows a "Simple view" button that calls this. */
  onClose?: () => void;
};

export function ReviewConsole({ chat, venueId: venueProp, onVenueChange, onClose }: ReviewConsoleProps = {}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [ownVenueId, setOwnVenueId] = useState(venueProp ?? DEFAULT_VENUE_ID);
  const venueId = venueProp ?? ownVenueId;
  const setVenueId = onVenueChange ?? setOwnVenueId;
  const [selected, setSelected] = useState<number | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [mode, setMode] = useState<"live" | "replay" | null>(null);
  const [hallView, setHallView] = useState<"2d" | "3d">("2d");
  const [explainer, setExplainer] = useState(false);
  const [placedKey, setPlacedKey] = useState<string | null>(null);
  /** Iteration compared against the baseline in the before/after replay (null = closed). */
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const [tab, setTab] = useState<InspectorTab>("iteration");
  const [copied, setCopied] = useState(false);
  const wide = useWide();

  const transport = useMemo(() => new DefaultChatTransport<AgentUIMessage>({ api: "/api/agent" }), []);
  const { messages, sendMessage, setMessages, status: chatStatus, error, stop, clearError } = useChat<AgentUIMessage>(chat ? { chat } : { transport });

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
  // A shared chat also holds Muse's answers to questions: show its latest run.
  const runMessage = useMemo(() => latestRunMessage(messages), [messages]);
  const state = useMemo(() => deriveRunState(runMessage), [runMessage]);
  const option = venueById(venueId) ?? VENUES[0];

  const reset = () => {
    clearError();
    // The shared chat is the simple view's conversation (one per venue): keep it, add to it.
    if (!chat) setMessages([]);
    setSelected(null);
    setCompareWith(null);
  };
  const start = (m: "live" | "replay") => {
    reset();
    setMode(m);
    // The metadata drives /api/chat (shared chat); the body drives /api/agent (own chat).
    void sendMessage(runUserMessage(m, option.id), { body: runRequestBody(m, option.id) });
  };
  const pickVenue = (id: string) => {
    if (id === venueId || busy) return;
    reset();
    setMode(null);
    setVenueId(id);
  };

  const venue = state.run?.venue ?? option.project.venue;
  const specs = state.run?.booths ?? option.project.booths;
  const baselineIt = state.iterations.find((i) => i.iteration === 0);
  // While the baseline placement animation plays, keep the stage on the baseline.
  const animKey = placementKey(state.run, baselineIt);
  const holdBaseline = selected === null && animKey !== null && placedKey !== animKey;
  const latestWithLayout = [...state.iterations].reverse().find((i) => i.layout);
  const current = state.iterations.find((i) => i.iteration === (holdBaseline ? 0 : selected)) ?? latestWithLayout;
  const constraints = current?.layout?.constraints ?? state.brief?.constraints ?? state.run?.initialConstraints;
  const finalIt = state.done ? state.iterations.find((i) => i.iteration === state.done!.finalIteration) : undefined;
  const simulated = state.iterations.filter((i) => i.sim && i.layout);
  const compareIt = compareWith === null ? undefined : simulated.find((i) => i.iteration === compareWith);
  const canCompare = Boolean(simulated.find((i) => i.iteration === 0)) && simulated.length > 1;
  const openCompare = (n?: number) => {
    const pick = n ?? (current && current.iteration !== 0 && current.sim ? current.iteration : (finalIt?.iteration ?? simulated[simulated.length - 1]?.iteration));
    if (pick !== undefined && pick !== 0) setCompareWith(pick);
  };
  const onPlacementEnd = useCallback((k: string) => setPlacedKey(k), []);

  const running = [...new Map(state.steps.map((s) => [s.id, s])).values()].filter((s) => s.status === "running").pop();
  const statusLine = running
    ? `${ACTORS[STEP_ACTORS[running.step][0]].tag} · ${running.title}`
    : state.done
      ? `Completed · ${state.done.stopReason.replace(/_/g, " ")}`
      : busy
        ? state.steps.length
          ? "Streaming…"
          : "Starting…"
        : "Ready";
  const waiting = busy && !state.iterations.some((i) => i.layout);
  const outdoor = venue.setting === "outdoor";
  const selectIteration = (i: number) => {
    setCompareWith(null);
    setSelected(i);
    if (animKey) setPlacedKey(animKey);
  };

  // KPI strip: the iteration on screen (the "after" side while comparing), against the baseline
  const kpiIt = compareIt ?? current;
  const m = kpiIt?.sim?.metrics;
  const b = kpiIt && kpiIt.iteration !== 0 ? baselineIt?.sim?.metrics : undefined;
  const target = state.run?.targets.crowded_s_per_visitor;
  const reportMd = state.report?.markdown ?? state.reportText;
  const copyReport = () => {
    void navigator.clipboard?.writeText(reportMd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const runRail = (
    <>
      <PaneSection title="Run" right={state.run && <Badge tone={state.run.mode === "live" ? "accent" : "neutral"}>{state.run.mode === "replay" ? "Recorded" : "Live"}</Badge>}>
        {state.run ? (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-muted">Engine</dt>
            <dd className="num truncate text-right text-ink-soft">{state.run.engine}</dd>
            <dt className="text-muted">LLM</dt>
            <dd className="num truncate text-right text-ink-soft">{state.run.llm}</dd>
            <dt className="text-muted">Booths</dt>
            <dd className="num text-right text-ink-soft">{specs.length}</dd>
          </dl>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted">
            No run yet.{status && !status.live && " Live runs are off on this server; the recorded run streams the same loop for this venue."}
          </p>
        )}
      </PaneSection>
      <PaneSection title="Steps" right={busy ? <span className="text-[11px] font-medium text-accent">streaming…</span> : undefined}>
        <Pipeline steps={state.steps} />
      </PaneSection>
      {state.run && (
        <PaneSection title="Identical conditions">
          <Conditions run={state.run} />
        </PaneSection>
      )}
    </>
  );

  const tabs: { id: InspectorTab; label: string; count?: number; dot?: boolean }[] = [
    { id: "iteration", label: "Iteration" },
    { id: "results", label: "Results", count: simulated.length || undefined },
    { id: "agents", label: "Agents", dot: busy },
    ...(wide ? [] : [{ id: "steps" as const, label: "Steps" }]),
  ];
  const activeTab = !wide || tab !== "steps" ? tab : "iteration";

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0">
      {/* app bar */}
      <header className="z-30 flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-surface px-3 py-2 lg:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <span className="text-[13.5px] font-semibold tracking-tight text-ink max-sm:hidden">muvilion</span>
          <span className="text-hairline-strong max-sm:hidden">/</span>
          <Segmented
            label="Venue"
            value={venueId}
            onChange={pickVenue}
            options={VENUES.map((v) => ({ id: v.id, label: v.label, disabled: busy && v.id !== venueId, title: v.project.venue.name }))}
          />
        </div>
        <span
          className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-bg px-2.5 text-[11.5px] text-muted max-md:hidden"
          role="status"
          aria-live="polite"
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${busy ? "animate-pulse bg-accent" : state.done ? "bg-ok" : "bg-faint"}`} />
          <span className="max-w-[22rem] truncate">{statusLine}</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              ← Simple view
            </Button>
          )}
          <Button variant="ghost" onClick={() => setExplainer(true)} className="max-sm:hidden">
            How it works
          </Button>
          <Button onClick={() => start("replay")} disabled={busy}>
            Watch recorded run
          </Button>
          {busy ? (
            <Button variant="danger" onClick={() => void stop()}>
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => start("live")}
              disabled={!status?.live}
              title={status && !status.live ? "Live runs are disabled on this server (LIVE_AGENT is not on)" : undefined}
            >
              Run live
            </Button>
          )}
        </div>
      </header>

      {/* KPI strip */}
      <div className={`shrink-0 border-b border-hairline bg-surface ${state.run ? "" : "max-lg:hidden"}`}>
        <div className="grid grid-cols-3 px-4 lg:grid-cols-[minmax(9rem,auto)_repeat(4,minmax(0,1fr))] lg:divide-x lg:divide-hairline lg:px-0">
          <div className="min-w-0 py-2 pr-3 lg:px-4 lg:py-2.5">
            <div className="text-[11px] font-medium text-muted">Showing</div>
            <div className="mt-0.5 text-[15px] font-semibold leading-5 text-ink">
              {kpiIt ? (kpiIt.iteration === 0 ? "Baseline" : `Iteration ${kpiIt.iteration}`) : "—"}
              {kpiIt && state.done?.finalIteration === kpiIt.iteration && kpiIt.iteration !== 0 && <span className="ml-1.5 text-[11px] font-medium text-accent">final</span>}
            </div>
            <div className="mt-1 h-4 truncate text-[11px] text-faint">
              {state.done ? `stop: ${state.done.stopReason.replace(/_/g, " ")}` : state.run ? `up to ${state.run.maxIterations} revisions` : "no run yet"}
            </div>
          </div>
          <Kpi
            label={`Crowded time per visitor (≥ ${m?.crowd_threshold ?? state.run?.crowdThreshold ?? 2} p/m²)`}
            value={m ? m.crowded_s_per_visitor.toFixed(1) : "—"}
            unit="s"
            tone={m && target !== undefined ? (m.crowded_s_per_visitor <= target ? "ok" : "bad") : undefined}
            foot={b && m ? <Delta a={b.crowded_s_per_visitor} b={m.crowded_s_per_visitor} digits={1} unit=" s" /> : target !== undefined ? `target ≤ ${target} s` : undefined}
          />
          <Kpi
            label="p90 travel time"
            value={m ? m.p90_travel_time_s.toFixed(0) : "—"}
            unit="s"
            foot={b && m ? <Delta a={b.p90_travel_time_s} b={m.p90_travel_time_s} digits={0} unit=" s" /> : undefined}
          />
          <Kpi
            label="Completed"
            value={m ? (m.completed_fraction * 100).toFixed(0) : "—"}
            unit="%"
            foot={b && m ? <Delta a={b.completed_fraction * 100} b={m.completed_fraction * 100} digits={1} unit=" pt" lowerIsBetter={false} /> : undefined}
          />
          <Kpi
            label="Validation errors"
            value={m ? m.violations : "—"}
            tone={m ? (m.violations === 0 ? "ok" : "bad") : undefined}
            foot={kpiIt?.sim ? `${kpiIt.sim.result.hotspots.length} hotspot(s)` : undefined}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[288px_minmax(0,1fr)_380px]">
        {/* left rail: run timeline (xl and up; below that it is the Steps tab) */}
        <aside aria-label="Run timeline" className="hidden min-h-0 overflow-y-auto border-r border-hairline bg-surface xl:block">
          {runRail}
        </aside>

        {/* center: canvas and report */}
        <main className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] px-4 py-2 backdrop-blur">
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
              <h1 className="min-w-0 truncate text-[14px] font-semibold tracking-tight text-ink">{venue.name}</h1>
              <Badge>{outdoor ? "Outdoor" : "Indoor"}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {compareIt ? (
                <Segmented
                  label="Baseline compared with"
                  value={compareIt.iteration}
                  onChange={setCompareWith}
                  options={simulated
                    .filter((i) => i.iteration !== 0)
                    .map((i) => ({ id: i.iteration, label: `vs ${iterLabel(i.iteration)}${state.done?.finalIteration === i.iteration ? " · final" : ""}` }))}
                />
              ) : (
                state.iterations.some((i) => i.layout) && (
                  <Segmented
                    label="Iteration"
                    value={current?.iteration ?? 0}
                    onChange={selectIteration}
                    options={state.iterations
                      .filter((i) => i.layout)
                      .map((i) => ({ id: i.iteration, label: `${iterLabel(i.iteration)}${state.done?.finalIteration === i.iteration && state.iterations.length > 1 ? " · final" : ""}` }))}
                  />
                )
              )}
              <Segmented
                label="View"
                value={compareIt ? "compare" : hallView}
                onChange={(v) => {
                  if (v === "compare") return openCompare();
                  setCompareWith(null);
                  setHallView(v);
                }}
                options={[
                  { id: "2d", label: "Plan" },
                  { id: "3d", label: "Model" },
                  { id: "compare", label: "Before / after", disabled: !canCompare, title: canCompare ? "Baseline and a revision side by side in 3D" : "Available once a revision has been simulated" },
                ]}
              />
              <label className="flex h-6 items-center gap-1.5 text-[11.5px] text-muted">
                <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
                Crowding
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {error && (
              <p role="alert" className="rounded-[6px] border border-bad/30 bg-surface px-3 py-2 text-[12.5px] text-bad">
                {mode === "live" ? "Live run failed: " : ""}
                {error.message}
                {mode === "live" && (
                  <button type="button" className="ml-2 underline" onClick={() => start("replay")}>
                    Watch the recorded run instead
                  </button>
                )}
              </p>
            )}
            {state.errors.map((e, i) => (
              <p key={i} className={`rounded-[6px] border bg-surface px-3 py-2 text-[12px] ${e.recoverable ? "border-hairline text-muted" : "border-bad/30 text-bad"}`}>
                {e.recoverable ? "Note: " : "Error: "}
                {e.message}
              </p>
            ))}

            {compareIt && baselineIt ? (
              <div>
                <Hall3DCompare
                  before={viewFor(state.run, venue, specs, baselineIt, { showHeatmap: showHeat, moves: [], title: `Baseline · ${baselineIt.sim!.metrics.crowded_s_per_visitor.toFixed(1)} s crowded per visitor` })}
                  after={viewFor(state.run, venue, specs, compareIt, {
                    showHeatmap: showHeat,
                    moves: diffLayouts(baselineIt.layout!.response.layout, compareIt.layout!.response.layout),
                    title: `${iterLabel(compareIt.iteration)} · ${compareIt.sim!.metrics.crowded_s_per_visitor.toFixed(1)} s crowded per visitor`,
                  })}
                />
                <p className="mt-3 text-[11.5px] text-muted">
                  Same agents, scenario and seed; only the layout differs. Booths outlined in blue were moved by the agent relative to the baseline.
                  {state.run?.engine === "mock" && " Mock engine: trajectories are synthetic aisle-following walkers, not a pedestrian model."}
                </p>
              </div>
            ) : (
              <Stage
                run={state.run}
                venue={venue}
                specs={specs}
                current={current}
                constraints={constraints}
                mode={hallView}
                showHeat={showHeat}
                waiting={waiting}
                onPlacementEnd={onPlacementEnd}
                empty={
                  <div className="w-full max-w-sm rounded-[10px] border border-hairline bg-surface p-5 text-center shadow-[0_16px_40px_-16px_rgb(30_30_28/0.3)]">
                    <div className="eyebrow">Empty site</div>
                    <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-ink">
                      Place {specs.length} booths on {venue.name}
                    </h2>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                      The agent writes a design brief, solves the layout, simulates the crowd and revises until peak density is under target.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button variant="primary" onClick={() => start(status?.live ? "live" : "replay")} disabled={busy}>
                        {status?.live ? "Run live" : "Watch recorded run"}
                      </Button>
                      <Button variant="ghost" onClick={() => setExplainer(true)}>
                        How it works
                      </Button>
                    </div>
                    {status && !status.live && <p className="mt-3 text-[11px] text-faint">Live runs are off on this server; the recording streams the same loop.</p>}
                  </div>
                }
              />
            )}

            {reportMd && (
              <section className="mt-2 rounded-[8px] border border-hairline bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-2.5">
                  <h2 className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
                    Reviewer report <ActorTag id="muse" /> <span className="text-[11px] font-normal text-faint">prose ·</span> <ActorTag id="code" />{" "}
                    <span className="text-[11px] font-normal text-faint">tables</span>
                  </h2>
                  <Button variant="ghost" className="!h-7 !px-2 text-[11.5px]" onClick={copyReport} disabled={!state.report}>
                    {copied ? "Copied" : "Copy markdown"}
                  </Button>
                </div>
                <div className="px-5 py-4">
                  <div className="mx-auto max-w-[820px]">
                    <Report markdown={reportMd} />
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>

        {/* right: inspector */}
        <aside aria-label="Inspector" className="min-w-0 border-t border-hairline bg-surface lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="sticky top-0 z-10 bg-surface">
            <Tabs label="Inspector" tabs={tabs} value={activeTab} onChange={setTab} />
          </div>
          {activeTab === "iteration" &&
            (current || state.brief ? (
              <>
                {current && (
                  <PaneSection title={`What the agent saw and did · ${current.iteration === 0 ? "baseline" : `iteration ${current.iteration}`}`}>
                    <IterationNotes it={current} />
                  </PaneSection>
                )}
                {state.brief && (
                  <PaneSection
                    title={
                      <span className="inline-flex items-center gap-2">
                        Design brief <ActorTag id="muse" /> <span className="text-faint">→</span> <ActorTag id="code" />
                      </span>
                    }
                  >
                    <BriefPanel brief={state.brief} />
                  </PaneSection>
                )}
              </>
            ) : (
              <EmptyPane>Start a run to see, for each iteration, what the solver placed, what the checks found, what the simulation measured and what the agent changed.</EmptyPane>
            ))}
          {activeTab === "results" &&
            (simulated.length ? (
              <>
                <PaneSection title="Iterations" right={target !== undefined && <span className="num text-[11px] text-faint">target ≤ {target} s crowded (≥ {state.run?.crowdThreshold ?? 2} p/m²)</span>}>
                  <MetricCards
                    iterations={state.iterations}
                    selected={current?.iteration ?? -1}
                    onSelect={selectIteration}
                    target={target}
                    finalIteration={state.done?.finalIteration}
                  />
                </PaneSection>
                {state.done?.baseline && state.done.final && (
                  <PaneSection title="Before / after">
                    <Comparison baseline={state.done.baseline} final={state.done.final} finalIteration={state.done.finalIteration} target={target} />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canCompare && (
                        <Button variant="primary" className="!h-7 text-[11.5px]" onClick={() => openCompare(state.done!.finalIteration)}>
                          Replay before / after in 3D
                        </Button>
                      )}
                      {finalIt && (finalIt.iteration !== current?.iteration || compareIt) && (
                        <Button variant="ghost" className="!h-7 text-[11.5px]" onClick={() => selectIteration(finalIt.iteration)}>
                          Show final layout
                        </Button>
                      )}
                    </div>
                  </PaneSection>
                )}
              </>
            ) : (
              <EmptyPane>Metrics appear here once the baseline has been simulated: peak density, p90 travel time, completion and validation errors per iteration.</EmptyPane>
            ))}
          {activeTab === "agents" && (
            <PaneSection title="Who does what">
              <Roles steps={state.steps} run={state.run} />
            </PaneSection>
          )}
          {activeTab === "steps" && runRail}
        </aside>
      </div>
      <HowItWorks open={explainer} onClose={() => setExplainer(false)} />
    </div>
  );
}

type InspectorTab = "iteration" | "results" | "agents" | "steps";

const WIDE = "(min-width: 1280px)";
/** True at the `xl` breakpoint, where the run timeline gets its own rail. */
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia(WIDE);
      q.addEventListener("change", cb);
      return () => q.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

function Logo() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-accent text-white" aria-hidden>
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <rect x={2} y={2} width={12} height={12} rx={1.5} />
        <rect x={4.5} y={4.5} width={3} height={3} fill="currentColor" stroke="none" />
        <rect x={8.5} y={4.5} width={3} height={3} fill="currentColor" stroke="none" opacity={0.55} />
        <rect x={4.5} y={8.5} width={3} height={3} fill="currentColor" stroke="none" opacity={0.55} />
        <rect x={8.5} y={8.5} width={3} height={3} fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

function EmptyPane({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-[12.5px] leading-relaxed text-muted">{children}</p>;
}

/** Change from baseline `a` to `b`, colored by whether it is an improvement. */
function Delta({ a, b, lowerIsBetter = true, digits = 2, unit = "" }: { a: number; b: number; lowerIsBetter?: boolean; digits?: number; unit?: string }) {
  const d = b - a;
  const zero = Math.abs(d) < 10 ** -digits / 2;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <span className="num">
      <span className={zero ? "text-faint" : good ? "text-ok" : "text-bad"}>{zero ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}${unit}`}</span>
      <span className="font-sans text-faint"> vs baseline</span>
    </span>
  );
}

function IterationNotes({ it }: { it: NonNullable<ReturnType<typeof deriveRunState>["iterations"][number]> }) {
  const row = (label: React.ReactNode, body: React.ReactNode, key?: React.Key) => (
    <div key={key} className="grid gap-1 border-t border-hairline py-2.5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-muted">{label}</div>
      <div className="min-w-0 text-[12.5px] leading-relaxed text-ink-soft">{body}</div>
    </div>
  );
  return (
    <div>
      {it.layout &&
        row(
          <>
            <ActorTag id="ortools" /> Layout
          </>,
          <>
            {it.layout.response.status}, {it.layout.response.layout.booths.length} booths
            {it.layout.response.steps.length > 1 && `, ${it.layout.response.steps.length} improving solutions`}
            {it.layout.moves.length > 0 && (
              <>
                {" "}
                · moved <span className="font-medium text-accent">{it.layout.moves.map((m) => m.booth_id).join(", ")}</span>
              </>
            )}
          </>,
        )}
      {it.validation &&
        row(
          <>
            <ActorTag id="shapely" /> Checks
          </>,
          <>
            {it.validation.errors === 0 ? "No errors" : `${it.validation.errors} error(s)`}
            {it.validation.warnings > 0 && `, ${it.validation.warnings} warning(s)`}
            {it.validation.result.violations.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted">
                {it.validation.result.violations.slice(0, 8).map((v, i) => (
                  <li key={i}>
                    <span className={v.severity === "error" ? "text-bad" : "text-ink-soft"} title={`${v.rule_id} · ${v.source}`}>
                      {ruleLabel(v.rule_id)}
                    </span>{" "}
                    — {v.message}
                  </li>
                ))}
              </ul>
            )}
          </>,
        )}
      {it.fixes.map((f, k) =>
        row(
          <>
            <ActorTag id="muse" /> Fix
          </>,
          <>
            {f.rationale}
            <ul className="num mt-1 text-[11.5px] text-muted">
              {f.applied.map((a, j) => (
                <li key={j}>{a.effect}</li>
              ))}
            </ul>
          </>,
          k,
        ),
      )}
      {it.sim &&
        row(
          <>
            <ActorTag id="jupedsim" /> Simulation
          </>,
          <span className="num">
            {it.sim.metrics.crowded_s_per_visitor.toFixed(1)} s crowded per visitor (≥ {it.sim.metrics.crowd_threshold} p/m²) · {it.sim.metrics.crowded_person_s.toFixed(0)} person-s · peak crowded area {it.sim.metrics.peak_crowded_area_m2.toFixed(0)} m² · p90 {it.sim.metrics.p90_travel_time_s.toFixed(0)} s · {(it.sim.metrics.completed_fraction * 100).toFixed(0)}% completed · {it.sim.result.hotspots.length} hotspot(s)
            <span className="text-faint"> · max {it.sim.metrics.max_density.toFixed(2)} p/m²</span>
          </span>,
        )}
      {it.comparison &&
        row(
          <>
            <ActorTag id="code" /> Decision
          </>,
          <>
            <span className="font-medium text-ink">{it.comparison.decision.replace(/_/g, " ")}</span> — {it.comparison.reason}
          </>,
        )}
      {it.analysis &&
        row(
          <>
            <ActorTag id="muse" /> Analysis
          </>,
          <>
            {it.analysis.summary}
            {it.analysis.causes.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted">
                {it.analysis.causes.map((c, i) => (
                  <li key={i}>
                    Hotspot #{c.hotspot_index}: {c.cause}
                  </li>
                ))}
              </ul>
            )}
          </>,
        )}
      {it.revision &&
        row(
          <>
            <ActorTag id="muse" /> Revision
          </>,
          <>
            {it.revision.rationale}
            <ul className="num mt-1 text-[11.5px] text-muted">
              {it.revision.applied.map((a, i) => (
                <li key={i}>→ {a.effect}</li>
              ))}
              {it.revision.rejected.map((r, i) => (
                <li key={`r${i}`} className="text-bad">
                  rejected: {r.reason}
                </li>
              ))}
            </ul>
          </>,
        )}
    </div>
  );
}
