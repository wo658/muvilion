"use client";

/**
 * Main stage: the site in 2D (plan) or 3D (model) for the selected iteration, and the
 * "empty site → placed layout" animation driven by the solver's improving solutions.
 */
import { useEffect, useRef, useState } from "react";
import type { BoothMove, RunInfo } from "@/lib/agent/events";
import type { BoothSpec, LayoutConstraints, Venue } from "@/lib/engine/contract";
import { simulateRequestFor } from "@/lib/trajectory/request";
import { PLACEMENT_MS, placementFrame, type AnimatedBooth, type PlacementFrame } from "@/lib/ui/placement";
import type { IterationView } from "@/lib/ui/run-state";
import { Hall3DPanel, type ViewSpec } from "./hall-3d";
import { HallLegend, HallView } from "./hall-view";
import { Button } from "./ui";

/** Plays once per `key` (run + baseline layout); replayable and skippable. */
export function usePlacement(key: string | null) {
  const [anim, setAnim] = useState<{ key: string | null; start: number; now: number }>({ key: null, start: 0, now: 0 });
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!key || started.current === key) return;
    const id = requestAnimationFrame((t) => {
      started.current = key;
      setAnim({ key, start: t, now: t });
    });
    return () => cancelAnimationFrame(id);
  }, [key]);
  const running = key !== null && anim.key === key && anim.now - anim.start < PLACEMENT_MS;
  useEffect(() => {
    if (!running) return;
    let id = requestAnimationFrame(function tick(t) {
      setAnim((a) => ({ ...a, now: t }));
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);
  return {
    available: key !== null,
    running,
    /** The animation for `key` has played (or was skipped). */
    finished: key !== null && anim.key === key && !running,
    t: running ? anim.now - anim.start : PLACEMENT_MS,
    replay: () => requestAnimationFrame((t) => setAnim({ key, start: t, now: t })),
    skip: () => setAnim((a) => ({ ...a, now: a.start + PLACEMENT_MS })),
  };
}

/** 3D inputs for one iteration; trajectories are fetched only once it has been simulated. */
export function viewFor(
  run: RunInfo | undefined,
  venue: Venue,
  specs: BoothSpec[],
  it: IterationView | undefined,
  opts: { showHeatmap: boolean; moves?: BoothMove[]; title?: string; booths?: AnimatedBooth[] },
): ViewSpec {
  const layout = it?.layout?.response.layout;
  return {
    title: opts.title,
    durationS: run?.scenario.duration_s,
    scene: {
      venue,
      specs,
      booths: opts.booths ?? layout?.booths.map((b) => ({ ...b, alpha: 1 })),
      grid: it?.sim?.result.grid,
      hotspots: it?.sim?.result.hotspots,
      moves: opts.moves ?? it?.layout?.moves,
      fixed: it?.layout?.constraints.fixed,
      showHeatmap: opts.showHeatmap,
    },
    source: run && layout && it?.sim ? { runId: it.sim.result.run_id, mode: run.mode, request: simulateRequestFor(run, layout, it.sim) } : undefined,
  };
}

function phaseText(f: PlacementFrame): string {
  if (f.phase === "empty") return "Empty site · constraints from the design brief";
  if (f.phase === "appearing") return "OR-Tools · first feasible arrangement";
  return `OR-Tools · improving solution ${f.step + 1} of ${f.steps}`;
}

/** Key of the baseline placement animation for a run (null when the solver reported no steps). */
export function placementKey(run: RunInfo | undefined, baseline: IterationView | undefined): string | null {
  const l = baseline?.layout;
  return run && l && l.iteration === 0 && l.attempt === 0 && l.response.steps.length > 0 ? `${run.runId}:${l.response.layout.id}` : null;
}

export function Stage({
  run,
  venue,
  specs,
  current,
  constraints,
  mode,
  showHeat,
  waiting,
  onPlacementEnd,
}: {
  run?: RunInfo;
  venue: Venue;
  specs: BoothSpec[];
  current?: IterationView;
  constraints?: LayoutConstraints;
  mode: "2d" | "3d";
  showHeat: boolean;
  /** A run is streaming but no layout exists yet (the brief is being written). */
  waiting: boolean;
  /** Called with the animation key once the placement animation has played or been skipped. */
  onPlacementEnd?: (key: string) => void;
}) {
  const layoutInfo = current?.layout;
  const steps = layoutInfo?.response.steps ?? [];
  const animKey = placementKey(run, current);
  const anim = usePlacement(animKey);
  useEffect(() => {
    if (animKey && anim.finished) onPlacementEnd?.(animKey);
  }, [animKey, anim.finished, onPlacementEnd]);
  const frame = anim.running && layoutInfo ? placementFrame(steps, layoutInfo.response.layout.booths, anim.t) : null;
  const booths: AnimatedBooth[] | undefined = frame?.booths ?? layoutInfo?.response.layout.booths.map((b) => ({ ...b, alpha: 1 }));
  const heat = showHeat && !frame;
  const keepOut = constraints?.keep_out;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {mode === "3d" ? (
          <Hall3DPanel
            animating={Boolean(frame)}
            view={viewFor(run, venue, specs, current, { showHeatmap: heat, booths, moves: frame ? [] : undefined })}
          />
        ) : (
          <div className="overflow-hidden rounded-[6px] border border-hairline bg-[var(--bg)] p-2 sm:p-3">
            <HallView
              venue={venue}
              specs={specs}
              booths={booths}
              grid={frame ? undefined : current?.sim?.result.grid}
              hotspots={frame ? [] : current?.sim?.result.hotspots}
              moves={frame ? [] : current?.layout?.moves}
              keepOut={keepOut}
              fixed={constraints?.fixed}
              doorClearance={constraints?.door_clearance}
              showHeatmap={heat}
            />
          </div>
        )}
        <div className="pointer-events-none absolute right-2.5 top-2.5 flex max-w-[calc(100%-1.25rem)] flex-wrap items-center justify-end gap-1.5">
          {frame && (
            <>
              <span className="num rounded-[4px] border border-hairline bg-surface/95 px-2 py-1 text-[11px] text-ink-soft" role="status">
                {phaseText(frame)}
              </span>
              <span className="pointer-events-auto">
                <Button variant="secondary" className="!h-7 !px-2 text-[11.5px]" onClick={anim.skip}>
                  Skip
                </Button>
              </span>
            </>
          )}
          {!frame && waiting && (
            <span className="rounded-[4px] border border-accent/30 bg-surface/95 px-2 py-1 text-[11px] text-accent" role="status">
              Empty site · Muse is reading the site and writing the brief…
            </span>
          )}
          {!frame && !run && (
            <span className="rounded-[4px] border border-hairline bg-surface/95 px-2 py-1 text-[11px] text-muted">Empty site · start a run to place the booths</span>
          )}
        </div>
        {frame && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 h-[3px] overflow-hidden rounded-full bg-hairline/70">
            <div className="h-full bg-accent" style={{ width: `${frame.progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === "2d" ? <HallLegend outdoor={venue.setting === "outdoor"} /> : <span />}
        {anim.available && !frame && (
          <Button variant="ghost" className="!h-7 !px-2 text-[11.5px]" onClick={anim.replay}>
            ↺ Replay placement
          </Button>
        )}
      </div>
    </div>
  );
}
