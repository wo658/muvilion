"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { diffLayouts } from "@/lib/agent/analysis";
import type { AgentUIMessage } from "@/lib/agent/events";
import { ACTORS, STEP_ACTORS } from "@/lib/ui/actors";
import { ruleLabel } from "@/lib/ui/rules";
import { deriveRunState } from "@/lib/ui/run-state";
import { DEFAULT_VENUE_ID, runRequestBody, venueById, VENUES } from "@/lib/venues";
import { Hall3DCompare } from "./hall-3d";
import { HowItWorks } from "./how-it-works";
import { BriefPanel, Comparison, Conditions, MetricCards, Pipeline, Report, Roles } from "./panels";
import { placementKey, Stage, viewFor } from "./stage";
import { ActorTag, Badge, Button, Card, Segmented } from "./ui";

type Status = { live: boolean; engine: string; llm: string; maxIterations: number };

const iterLabel = (n: number) => (n === 0 ? "Baseline" : `Iter ${n}`);

export function ReviewConsole() {
  const [status, setStatus] = useState<Status | null>(null);
  const [venueId, setVenueId] = useState(DEFAULT_VENUE_ID);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [mode, setMode] = useState<"live" | "replay" | null>(null);
  const [hallView, setHallView] = useState<"2d" | "3d">("2d");
  const [explainer, setExplainer] = useState(false);
  const [placedKey, setPlacedKey] = useState<string | null>(null);
  /** Iteration compared against the baseline in the before/after replay (null = closed). */
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport<AgentUIMessage>({ api: "/api/agent" }), []);
  const { messages, sendMessage, setMessages, status: chatStatus, error, stop, clearError } = useChat<AgentUIMessage>({ transport });

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
  const option = venueById(venueId) ?? VENUES[0];

  const reset = () => {
    clearError();
    setMessages([]);
    setSelected(null);
    setCompareWith(null);
  };
  const start = (m: "live" | "replay") => {
    reset();
    setMode(m);
    void sendMessage({ text: m === "live" ? "Start live run" : "Replay recorded run" }, { body: runRequestBody(m, option.id) });
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
  useEffect(() => {
    if (compareWith !== null) compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [compareWith]);
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="z-30 border-b lg:sticky lg:top-0 border-hairline bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1560px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 lg:px-6">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Event layout · review console</div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-ink">{venue.name}</h1>
              <Badge>{outdoor ? "Outdoor" : "Indoor"}</Badge>
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-muted" role="status" aria-live="polite">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${busy ? "animate-pulse bg-accent" : state.done ? "bg-ok" : "bg-faint"}`} />
                <span className="truncate">{statusLine}</span>
              </span>
            </div>
            {state.run && (
              <div className="num mt-0.5 text-[11px] text-faint">
                {state.run.mode === "replay" ? "recorded run" : "live run"} · engine {state.run.engine} · LLM {state.run.llm} · {specs.length} booths
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="md"
              label="Venue"
              value={venueId}
              onChange={pickVenue}
              options={VENUES.map((v) => ({ id: v.id, label: v.label, disabled: busy && v.id !== venueId, title: v.project.venue.name }))}
            />
            <Button variant="ghost" onClick={() => setExplainer(true)}>
              How it works
            </Button>
            <Button onClick={() => start("replay")} disabled={busy}>
              Watch recorded run
            </Button>
            <Button
              variant="primary"
              onClick={() => start("live")}
              disabled={busy || !status?.live}
              title={status && !status.live ? "Live runs are disabled on this server (LIVE_AGENT is not on)" : undefined}
            >
              Run live
            </Button>
            {busy && (
              <Button variant="danger" onClick={() => void stop()}>
                Stop
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-5">
        {status && !status.live && (
          <p className="rounded-[6px] border border-hairline bg-surface px-3 py-2 text-[12px] text-muted">
            Live runs are switched off on this server. “Watch recorded run” streams a recorded run of the same loop for the selected venue.
          </p>
        )}
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

        {compareIt && baselineIt && (
          <div ref={compareRef} className="scroll-mt-24">
            <Card
              title={`Before / after · baseline vs ${iterLabel(compareIt.iteration)}`}
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    label="Compare with"
                    value={compareIt.iteration}
                    onChange={setCompareWith}
                    options={simulated.filter((i) => i.iteration !== 0).map((i) => ({ id: i.iteration, label: `${iterLabel(i.iteration)}${state.done?.finalIteration === i.iteration ? " · final" : ""}` }))}
                  />
                  <Button variant="ghost" className="!h-7 !px-2" onClick={() => setCompareWith(null)} aria-label="Close before/after replay">
                    Close
                  </Button>
                </div>
              }
            >
              <Hall3DCompare
                before={viewFor(state.run, venue, specs, baselineIt, { showHeatmap: showHeat, moves: [], title: `Baseline · max ${baselineIt.sim!.metrics.max_density.toFixed(2)} p/m²` })}
                after={viewFor(state.run, venue, specs, compareIt, {
                  showHeatmap: showHeat,
                  moves: diffLayouts(baselineIt.layout!.response.layout, compareIt.layout!.response.layout),
                  title: `${iterLabel(compareIt.iteration)} · max ${compareIt.sim!.metrics.max_density.toFixed(2)} p/m²`,
                })}
              />
              <p className="mt-3 text-[11.5px] text-muted">
                Same agents, scenario and seed; only the layout differs. Booths outlined in teal were moved by the agent relative to the baseline.
                {state.run?.engine === "mock" && " Mock engine: trajectories are synthetic aisle-following walkers, not a pedestrian model."}
              </p>
            </Card>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* main stage */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card
              title={current ? (current.iteration === 0 ? "Site · baseline layout" : `Site · iteration ${current.iteration}`) : "Site · empty"}
              right={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {state.iterations.some((i) => i.layout) && (
                    <Segmented
                      label="Iteration"
                      value={current?.iteration ?? 0}
                      onChange={(i) => {
                        setSelected(i);
                        if (animKey) setPlacedKey(animKey);
                      }}
                      options={state.iterations
                        .filter((i) => i.layout)
                        .map((i) => ({ id: i.iteration, label: `${iterLabel(i.iteration)}${state.done?.finalIteration === i.iteration && state.iterations.length > 1 ? " ·  final" : ""}` }))}
                    />
                  )}
                  <Segmented
                    label="View"
                    value={hallView}
                    onChange={setHallView}
                    options={[
                      { id: "2d", label: "Plan" },
                      { id: "3d", label: "Model" },
                    ]}
                  />
                  <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
                    <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
                    Crowding
                  </label>
                  {canCompare && (
                    <Button className="!h-7 !px-2.5 text-[11.5px]" onClick={() => openCompare()}>
                      Before / after 3D
                    </Button>
                  )}
                </div>
              }
            >
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
              />
            </Card>

            {state.brief && (
              <Card
                title={
                  <span className="inline-flex items-center gap-2">
                    Design brief <ActorTag id="muse" /> <span className="text-faint">→</span> <ActorTag id="code" />
                  </span>
                }
              >
                <BriefPanel brief={state.brief} />
              </Card>
            )}

            {current && (
              <Card title={`What the agent saw and did · ${current.iteration === 0 ? "baseline" : `iteration ${current.iteration}`}`}>
                <IterationNotes it={current} />
              </Card>
            )}
          </div>

          {/* right column */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Pipeline · who does what" right={busy ? <span className="text-[11px] font-medium text-accent">streaming…</span> : undefined}>
              <Roles steps={state.steps} run={state.run} />
            </Card>
            {state.iterations.some((i) => i.sim) && (
              <Card title="Iterations" right={state.run && <span className="num text-[11px] text-faint">target ≤ {state.run.targets.max_density} p/m²</span>}>
                <MetricCards
                  iterations={state.iterations}
                  selected={current?.iteration ?? -1}
                  onSelect={(i) => {
                    setSelected(i);
                    if (animKey) setPlacedKey(animKey);
                  }}
                  target={state.run?.targets.max_density}
                  finalIteration={state.done?.finalIteration}
                />
              </Card>
            )}
            {state.done?.baseline && state.done.final && (
              <Card title="Before / after" right={<span className="text-[11px] text-faint">stop: {state.done.stopReason.replace(/_/g, " ")}</span>}>
                <Comparison baseline={state.done.baseline} final={state.done.final} finalIteration={state.done.finalIteration} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canCompare && (
                    <Button variant="primary" className="!h-7 text-[11.5px]" onClick={() => openCompare(state.done!.finalIteration)}>
                      Replay before / after in 3D
                    </Button>
                  )}
                  {finalIt && finalIt.iteration !== current?.iteration && (
                    <Button variant="ghost" className="!h-7 text-[11.5px]" onClick={() => setSelected(finalIt.iteration)}>
                      Show final layout
                    </Button>
                  )}
                </div>
              </Card>
            )}
            <Card title="Run steps">
              <div className="max-h-[34rem] overflow-y-auto pr-1">
                <Pipeline steps={state.steps} />
              </div>
            </Card>
            {state.run && (
              <Card title="Identical conditions">
                <Conditions run={state.run} />
              </Card>
            )}
          </div>
        </div>

        {(state.report || state.reportText) && (
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                Report for reviewer <ActorTag id="muse" /> <span className="text-faint">prose ·</span> <ActorTag id="code" /> <span className="text-faint">tables</span>
              </span>
            }
          >
            <div className="mx-auto max-w-[880px]">
              <Report markdown={state.report?.markdown ?? state.reportText} />
            </div>
          </Card>
        )}
      </div>
      <HowItWorks open={explainer} onClose={() => setExplainer(false)} />
    </div>
  );
}

function IterationNotes({ it }: { it: NonNullable<ReturnType<typeof deriveRunState>["iterations"][number]> }) {
  const row = (label: React.ReactNode, body: React.ReactNode) => (
    <div className="grid gap-1 border-t border-hairline py-2.5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
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
      {it.fixes.map((f) =>
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
        ),
      )}
      {it.sim &&
        row(
          <>
            <ActorTag id="jupedsim" /> Simulation
          </>,
          <span className="num">
            max {it.sim.metrics.max_density.toFixed(2)} p/m² · p90 {it.sim.metrics.p90_travel_time_s.toFixed(0)} s · {it.sim.result.hotspots.length} hotspot(s)
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
