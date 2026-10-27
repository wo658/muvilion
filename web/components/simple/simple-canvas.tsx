"use client";

/**
 * The simple view's canvas: the 3D model of the iteration on screen, with the "empty site →
 * placed layout" animation for the first layout, pedestrians auto-playing, and booths a Muse
 * message points at outlined while the camera eases toward them.
 */
import { useEffect, useMemo, type ReactNode } from "react";
import type { BoothMove, RunInfo } from "@/lib/agent/events";
import type { BoothSpec, Venue } from "@/lib/engine/contract";
import { boothRect, center } from "@/lib/geometry";
import { placementFrame } from "@/lib/ui/placement";
import type { IterationView } from "@/lib/ui/run-state";
import { Hall3DStage, type StageFocus } from "../hall-3d";
import { placementKey, usePlacement, viewFor } from "../stage";

export function SimpleCanvas({
  run,
  venue,
  specs,
  it,
  moves,
  highlight,
  focusKey,
  onPlacementEnd,
  overlay,
  className,
}: {
  run?: RunInfo;
  venue: Venue;
  specs: BoothSpec[];
  it?: IterationView;
  moves?: BoothMove[];
  highlight?: string[];
  /** Changes whenever the user picks a message, so the camera re-focuses. */
  focusKey?: string;
  onPlacementEnd?: (key: string) => void;
  overlay?: ReactNode;
  className?: string;
}) {
  const layoutInfo = it?.layout;
  const animKey = placementKey(run, it);
  const anim = usePlacement(animKey);
  useEffect(() => {
    if (animKey && anim.finished) onPlacementEnd?.(animKey);
  }, [animKey, anim.finished, onPlacementEnd]);
  const frame = anim.running && layoutInfo ? placementFrame(layoutInfo.response.steps, layoutInfo.response.layout.booths, anim.t) : null;
  const booths = frame?.booths ?? layoutInfo?.response.layout.booths.map((b) => ({ ...b, alpha: 1 }));

  const view = viewFor(run, venue, specs, it, { showHeatmap: !frame, booths, moves: frame ? [] : moves });
  view.scene.highlight = frame ? undefined : highlight;
  view.scene.hotspots = []; // the crowding shows on the floor; numbered rings are a Details thing

  const hiKey = (highlight ?? []).join(",");
  const focus: StageFocus = useMemo(() => {
    const placed = layoutInfo?.response.layout.booths ?? [];
    const pts = placed.filter((b) => hiKey.split(",").includes(b.id)).map((b) => center(boothRect(b)));
    if (!pts.length) return null;
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x, y, key: `${focusKey ?? ""}|${hiKey}|${it?.iteration ?? ""}` };
  }, [layoutInfo, hiKey, focusKey, it?.iteration]);

  return <Hall3DStage view={view} animating={Boolean(frame)} focus={focus} className={className} overlay={overlay} />;
}
