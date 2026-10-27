"use client";

/**
 * 3D hall replay. Client-only (loaded through ./index.tsx with next/dynamic, ssr: false).
 *
 * - <Hall3DPanel>: one iteration, its own clock and playback bar.
 * - <Hall3DCompare>: baseline and another iteration side by side; one shared clock (same simulated
 *   moment in both) and linked cameras (orbiting one moves the other).
 *
 * Canvases render continuously only while playing (frameloop "always"); when paused they render on
 * demand (seek, camera move, data change).
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import * as THREE from "three";
import type { Venue } from "@/lib/engine/contract";
import { hallCenter, toWorld } from "@/lib/trajectory/coords";
import { trajectoryDuration } from "@/lib/trajectory/playback";
import { Agents } from "./agents";
import { createClock, SPEEDS, useClockView, usePlaybackLoop, type Clock } from "./clock";
import { inwardNormal } from "@/lib/ui/site";
import { CROWD_AMBER, CROWD_GRADIENT, CROWD_RED, CROWD_THRESHOLD, HEAT_GRADIENT, HEAT_MAX, THRESHOLD_AT } from "@/lib/ui/heat";
import { Segmented, Swatch, ThresholdBar } from "../ui";
import { PALETTE } from "./palette";
import { HallScene, type HallSceneProps } from "./scene";
import { useTrajectories, type TrajectorySource, type TrajectoryState } from "./use-trajectories";

export type CameraPreset = "overview" | "top" | "entrance";
const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "overview", label: "Model" },
  { id: "top", label: "Plan" },
  { id: "entrance", label: "Entrance" },
];
const TWEEN_MS = 750;

export type ViewSpec = {
  title?: string;
  scene: HallSceneProps;
  /** Undefined until the iteration has been simulated. */
  source?: TrajectorySource;
  /** Simulated duration to show before trajectories load. */
  durationS?: number;
};

// ---------- camera ----------

function presetPose(preset: CameraPreset, venue: Venue): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const W = venue.width;
  const H = venue.height;
  const S = Math.max(W, H);
  const c = new THREE.Vector3(...hallCenter(W, H));
  if (preset === "top") return { pos: new THREE.Vector3(c.x, S * 1.55, c.z + 0.01), target: c };
  if (preset === "entrance") {
    const d = venue.doors.find((x) => x.kind === "entrance") ?? venue.doors[0];
    const m = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
    const n = inwardNormal(d, venue);
    return {
      pos: new THREE.Vector3(...toWorld(m.x - n.x * 7, m.y - n.y * 7, 9)),
      target: new THREE.Vector3(...toWorld(m.x + n.x * 12, m.y + n.y * 12, 0)),
    };
  }
  // isometric-ish model view: from the front-left, ~38° above the floor
  const az = -0.62;
  const el = 0.66;
  const r = S * 1.3;
  return {
    pos: new THREE.Vector3(c.x + r * Math.sin(az) * Math.cos(el), r * Math.sin(el), c.z + r * Math.cos(az) * Math.cos(el)),
    target: c.clone().add(new THREE.Vector3(0, 0, S * 0.03)),
  };
}

/** Shared camera pose for linked canvases. */
export type CameraLink = { pos: THREE.Vector3; target: THREE.Vector3; version: number; source: number; invalidators: Set<() => void> };
function createCameraLink(): CameraLink {
  return { pos: new THREE.Vector3(), target: new THREE.Vector3(), version: 0, source: -1, invalidators: new Set() };
}

let nextViewId = 1;

/** Write this canvas's pose into the link and wake the other canvases; returns the new version. */
function publishCamera(link: CameraLink, source: number, pos: THREE.Vector3, target: THREE.Vector3, self: () => void): number {
  link.pos.copy(pos);
  link.target.copy(target);
  link.source = source;
  link.version++;
  for (const inv of link.invalidators) if (inv !== self) inv();
  return link.version;
}

function CameraRig({ preset, presetNonce, venue, link }: { preset: CameraPreset; presetNonce: number; venue: Venue; link?: CameraLink }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, invalidate } = useThree();
  const id = useMemo(() => nextViewId++, []);
  const seen = useRef(0);
  const interacting = useRef(false);
  const lastVenue = useRef<Venue | null>(null);
  const tween = useRef<{ p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; start: number } | null>(null);

  useEffect(() => {
    const { pos, target } = presetPose(preset, venue);
    const ctl = controls.current;
    if (lastVenue.current !== venue || !ctl) {
      // first frame or a different site: snap
      lastVenue.current = venue;
      camera.position.copy(pos);
      ctl?.target.copy(target);
      ctl?.update();
      camera.lookAt(target);
      tween.current = null;
    } else {
      tween.current = { p0: camera.position.clone(), t0: ctl.target.clone(), p1: pos, t1: target, start: performance.now() };
    }
    invalidate();
  }, [preset, presetNonce, venue, camera, invalidate]);

  useFrame(() => {
    const tw = tween.current;
    const ctl = controls.current;
    if (!tw || !ctl) return;
    const k = Math.min(1, (performance.now() - tw.start) / TWEEN_MS);
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    camera.position.lerpVectors(tw.p0, tw.p1, e);
    ctl.target.lerpVectors(tw.t0, tw.t1, e);
    ctl.update();
    if (k < 1) invalidate();
    else tween.current = null;
  });

  useEffect(() => {
    if (!link) return;
    link.invalidators.add(invalidate);
    return () => void link.invalidators.delete(invalidate);
  }, [link, invalidate]);

  useFrame(() => {
    if (!link || interacting.current || link.version === seen.current || link.source === id) return;
    seen.current = link.version;
    camera.position.copy(link.pos);
    controls.current?.target.copy(link.target);
    controls.current?.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      maxPolarAngle={Math.PI / 2 - 0.08}
      minDistance={3}
      maxDistance={Math.max(venue.width, venue.height) * 2.5}
      onStart={() => {
        interacting.current = true;
        tween.current = null;
      }}
      onEnd={() => (interacting.current = false)}
      onChange={() => {
        if (!link || !interacting.current || !controls.current) return;
        seen.current = publishCamera(link, id, camera.position, controls.current.target, invalidate);
      }}
    />
  );
}

/** Re-render a demand-mode canvas whenever the clock changes (seek while paused). */
function ClockInvalidator({ clock }: { clock: Clock }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => clock.subscribe(() => invalidate()), [clock, invalidate]);
  return null;
}

// ---------- viewport ----------

function SceneLights({ venue }: { venue: Venue }) {
  const S = Math.max(venue.width, venue.height);
  const c = hallCenter(venue.width, venue.height);
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d3cdbf", 1.05]} />
      <ambientLight intensity={0.2} />
      <primitive object={target} position={c} />
      <directionalLight
        target={target}
        position={[c[0] - S * 0.45, S * 0.95, c[2] + S * 0.55]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={6}
        shadow-camera-left={-S * 0.8}
        shadow-camera-right={S * 0.8}
        shadow-camera-top={S * 0.8}
        shadow-camera-bottom={-S * 0.8}
        shadow-camera-near={1}
        shadow-camera-far={S * 3}
      />
    </>
  );
}

function Viewport({
  view,
  state,
  clock,
  playing,
  preset,
  presetNonce,
  link,
  animating = false,
}: {
  view: ViewSpec;
  state: TrajectoryState;
  clock: Clock;
  playing: boolean;
  preset: CameraPreset;
  presetNonce: number;
  link?: CameraLink;
  /** Booths are moving (placement animation): render every frame. */
  animating?: boolean;
}) {
  const counter = useRef<HTMLSpanElement>(null);
  const { venue } = view.scene;
  const S = Math.max(venue.width, venue.height);
  const initial = useMemo(() => presetPose(preset, venue), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] border border-hairline" style={{ background: PALETTE.background }}>
      <Canvas
        shadows="soft"
        frameloop={playing || animating ? "always" : "demand"}
        dpr={[1, 2]}
        camera={{ fov: 32, near: 0.5, far: S * 12, position: initial.pos.toArray() }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.02 }}
      >
        <color attach="background" args={[PALETTE.background]} />
        <fog attach="fog" args={[PALETTE.background, S * 1.9, S * 4.2]} />
        <SceneLights venue={venue} />
        <HallScene {...view.scene} />
        {state.status === "ready" && (
          <Agents key={state.data.run_id} traj={state.data} clock={clock} counterRef={counter} width={venue.width} height={venue.height} />
        )}
        <CameraRig preset={preset} presetNonce={presetNonce} venue={venue} link={link} />
        <ClockInvalidator clock={clock} />
      </Canvas>
      {/* soft vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgb(30 30 28 / 0.07) 100%)" }} />
      <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        {view.title && <span className="rounded-[4px] border border-hairline bg-surface/95 px-2 py-0.5 font-medium text-ink">{view.title}</span>}
        {state.status === "ready" && (
          <span className="num rounded-[4px] border border-hairline bg-surface/90 px-2 py-0.5 text-muted">
            <span ref={counter}>0</span> on site · {state.data.agents.length} tracks
          </span>
        )}
      </div>
      {state.status !== "ready" && !animating && (state.status !== "idle" || view.scene.booths?.length) ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-2.5">
          <span
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-[4px] border px-2 py-1 text-[11px] ${state.status === "error" ? "border-bad/40 bg-surface text-bad" : "border-hairline bg-surface/95 text-muted"}`}
          >
            {state.status === "idle" && "No simulation for this iteration yet — showing the layout only."}
            {state.status === "loading" && "Loading pedestrian trajectories…"}
            {state.status === "error" && (
              <>
                Trajectories failed: {state.error}{" "}
                <button type="button" className="pointer-events-auto underline" onClick={state.retry}>
                  Retry
                </button>
              </>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------- playback bar ----------

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PlaybackBar({
  clock,
  preset,
  onPreset,
  extra,
}: {
  clock: Clock;
  preset: CameraPreset;
  onPreset: (p: CameraPreset) => void;
  extra?: ReactNode;
}) {
  const v = useClockView(clock);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => clock.set({ playing: !v.playing, t: !v.playing && v.t >= v.duration ? 0 : v.t })}
          className="inline-flex h-7 w-[4.5rem] shrink-0 items-center justify-center gap-1.5 rounded-[5px] bg-accent text-[12px] font-medium text-white hover:bg-accent-hover"
          aria-label={v.playing ? "Pause" : "Play"}
        >
          {v.playing ? (
            <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden><rect width="3" height="10" fill="currentColor" /><rect x="6" width="3" height="10" fill="currentColor" /></svg>
          ) : (
            <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden><path d="M0 0 L9 5 L0 10 Z" fill="currentColor" /></svg>
          )}
          {v.playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={v.duration}
          step={0.1}
          value={v.t}
          onChange={(e) => clock.set({ t: Number(e.target.value) })}
          className="h-1 min-w-0 flex-1"
          aria-label="Simulated time"
        />
        <span className="num w-[5.5rem] shrink-0 text-right text-[11.5px] text-muted">
          {fmt(v.t)} / {fmt(v.duration)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px]">
        <Segmented label="Playback speed" options={SPEEDS.map((s) => ({ id: s, label: `${s}×` }))} value={v.speed} onChange={(s) => clock.set({ speed: s })} />
        <label className="flex items-center gap-1.5 text-muted">
          <input type="checkbox" checked={v.loop} onChange={(e) => clock.set({ loop: e.target.checked })} />
          Loop
        </label>
        <Segmented label="Camera" options={PRESETS} value={preset} onChange={onPreset} />
        {extra}
      </div>
    </div>
  );
}

export function Legend3D() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
      <Swatch label={`Pedestrian: grey, amber once local density ≥ ${CROWD_THRESHOLD} p/m² (crowded), red by ${CROWD_RED}`}>
        <ThresholdBar background={CROWD_GRADIENT} at={CROWD_AMBER / (CROWD_RED + 0.5)} />
      </Swatch>
      <Swatch label={`Floor = peak density 0 → ${HEAT_MAX} p/m², amber from ${CROWD_THRESHOLD}`}>
        <ThresholdBar background={HEAT_GRADIENT} at={THRESHOLD_AT} />
      </Swatch>
      <Swatch label="Moved by agent (ghost = previous spot)">
        <span className="inline-block h-2.5 w-3.5 rounded-[2px] border-[1.5px] border-accent bg-white" />
      </Swatch>
      <Swatch label="Hover a booth for its name">
        <span className="inline-block h-2.5 w-3.5 rounded-[2px] border border-hairline-strong bg-white" />
      </Swatch>
    </div>
  );
}

// ---------- panels ----------

function useClock(states: TrajectoryState[], fallbackDuration: number): { clock: Clock; playing: boolean } {
  const [clock] = useState(() => createClock({ duration: fallbackDuration }));
  usePlaybackLoop(clock);
  const v = useClockView(clock, 1e9);
  const durations = states.flatMap((s) => (s.status === "ready" ? [trajectoryDuration(s.data)] : []));
  const duration = durations.length ? Math.max(...durations) : fallbackDuration;
  useEffect(() => {
    if (Math.abs(clock.duration - duration) > 1e-9) clock.set({ duration });
  }, [clock, duration]);
  // pause when the panel unmounts so a stray RAF never keeps a canvas busy
  useEffect(() => () => clock.set({ playing: false }), [clock]);
  return { clock, playing: v.playing };
}

export function Hall3DPanel({ view, animating = false }: { view: ViewSpec; animating?: boolean }) {
  const state = useTrajectories(animating ? undefined : view.source);
  const { clock, playing } = useClock([state], view.durationS ?? 300);
  const [preset, setPreset] = useState<CameraPreset>("overview");
  const [nonce, setNonce] = useState(0);
  const pick = (p: CameraPreset) => (setPreset(p), setNonce((n) => n + 1));
  return (
    <div className="flex flex-col gap-3">
      <Viewport view={view} state={state} clock={clock} playing={playing} preset={preset} presetNonce={nonce} animating={animating} />
      <PlaybackBar clock={clock} preset={preset} onPreset={pick} />
      <Legend3D />
    </div>
  );
}

export function Hall3DCompare({ before, after }: { before: ViewSpec; after: ViewSpec }) {
  const a = useTrajectories(before.source);
  const b = useTrajectories(after.source);
  const { clock, playing } = useClock([a, b], Math.max(before.durationS ?? 300, after.durationS ?? 300));
  const [preset, setPreset] = useState<CameraPreset>("overview");
  const [nonce, setNonce] = useState(0);
  const [link] = useState(createCameraLink);
  const pick = (p: CameraPreset) => (setPreset(p), setNonce((n) => n + 1));
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Viewport view={before} state={a} clock={clock} playing={playing} preset={preset} presetNonce={nonce} link={link} />
        <Viewport view={after} state={b} clock={clock} playing={playing} preset={preset} presetNonce={nonce} link={link} />
      </div>
      <PlaybackBar clock={clock} preset={preset} onPreset={pick} extra={<span className="text-faint">Shared clock · linked cameras</span>} />
      <Legend3D />
    </div>
  );
}
