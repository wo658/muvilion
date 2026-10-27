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
import { usePalette } from "./palette";
import { HallScene, type HallSceneProps } from "./scene";
import { useTrajectories, type TrajectorySource, type TrajectoryState } from "./use-trajectories";

export type CameraPreset = "overview" | "top" | "entrance";
const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "top", label: "Top-down" },
  { id: "entrance", label: "Entrance" },
];

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
  if (preset === "top") return { pos: new THREE.Vector3(c.x, S * 1.15, c.z + 0.01), target: c };
  if (preset === "entrance") {
    const d = venue.doors.find((x) => x.kind === "entrance") ?? venue.doors[0];
    const m = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
    // inward normal of the boundary the door sits on
    const dist = [m.y, H - m.y, m.x, W - m.x];
    const n = [
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
    ][dist.indexOf(Math.min(...dist))];
    return {
      pos: new THREE.Vector3(...toWorld(m.x - n.x * 6, m.y - n.y * 6, 11)),
      target: new THREE.Vector3(...toWorld(m.x + n.x * 10, m.y + n.y * 10, 0)),
    };
  }
  return { pos: new THREE.Vector3(c.x, S * 0.75, c.z + S * 0.85), target: c };
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

  useEffect(() => {
    const { pos, target } = presetPose(preset, venue);
    camera.position.copy(pos);
    controls.current?.target.copy(target);
    controls.current?.update();
    camera.lookAt(target);
    invalidate();
  }, [preset, presetNonce, venue, camera, invalidate]);

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
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={3}
      maxDistance={Math.max(venue.width, venue.height) * 2.5}
      onStart={() => (interacting.current = true)}
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

function Viewport({
  view,
  state,
  clock,
  playing,
  preset,
  presetNonce,
  link,
}: {
  view: ViewSpec;
  state: TrajectoryState;
  clock: Clock;
  playing: boolean;
  preset: CameraPreset;
  presetNonce: number;
  link?: CameraLink;
}) {
  const palette = usePalette();
  const counter = useRef<HTMLSpanElement>(null);
  const { venue } = view.scene;
  const initial = useMemo(() => presetPose(preset, venue), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-[var(--border)]" style={{ background: palette.background }}>
      <Canvas
        frameloop={playing ? "always" : "demand"}
        dpr={[1, 2]}
        camera={{ fov: 45, near: 0.1, far: 500, position: initial.pos.toArray() }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[palette.background]} />
        <hemisphereLight args={["#ffffff", "#8a8f99", 1.6]} />
        <directionalLight position={[venue.width * 0.3, 40, 20]} intensity={1.6} />
        <HallScene {...view.scene} palette={palette} />
        {state.status === "ready" && <Agents key={state.data.run_id} traj={state.data} clock={clock} counterRef={counter} />}
        <CameraRig preset={preset} presetNonce={presetNonce} venue={venue} link={link} />
        <ClockInvalidator clock={clock} />
      </Canvas>
      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {view.title && <span className="rounded bg-black/60 px-1.5 py-0.5 font-semibold text-white">{view.title}</span>}
        {state.status === "ready" && (
          <span className="rounded bg-black/50 px-1.5 py-0.5 text-white">
            <span ref={counter}>0</span> in hall · {state.data.agents.length} tracks
          </span>
        )}
      </div>
      {state.status !== "ready" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-2">
          <span
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded px-2 py-1 text-xs ${state.status === "error" ? "bg-rose-600 text-white" : "bg-black/60 text-white"}`}
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
      )}
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
  const btn = "rounded px-2 py-0.5 text-xs font-medium";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => clock.set({ playing: !v.playing, t: !v.playing && v.t >= v.duration ? 0 : v.t })}
          className="w-16 rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white"
          aria-label={v.playing ? "Pause" : "Play"}
        >
          {v.playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <input
          type="range"
          min={0}
          max={v.duration}
          step={0.1}
          value={v.t}
          onChange={(e) => clock.set({ t: Number(e.target.value) })}
          className="min-w-0 flex-1 accent-[var(--accent)]"
          aria-label="Simulated time"
        />
        <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--muted)]">
          {fmt(v.t)} / {fmt(v.duration)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" onClick={() => clock.set({ speed: s })} aria-pressed={v.speed === s} className={`${btn} ${v.speed === s ? "bg-[var(--accent)] text-white" : "bg-[var(--hover)]"}`}>
              {s}×
            </button>
          ))}
        </span>
        <label className="flex items-center gap-1 text-[var(--muted)]">
          <input type="checkbox" checked={v.loop} onChange={(e) => clock.set({ loop: e.target.checked })} />
          Loop
        </label>
        <span className="flex items-center gap-1" role="group" aria-label="Camera">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => onPreset(p.id)} aria-pressed={preset === p.id} className={`${btn} ${preset === p.id ? "bg-[var(--accent)] text-white" : "bg-[var(--hover)]"}`}>
              {p.label}
            </button>
          ))}
        </span>
        {extra}
      </div>
    </div>
  );
}

export function Legend3D() {
  const sw = (bg: string) => <span className="inline-block h-3 w-3 rounded-full" style={{ background: bg }} />;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5">
        {sw("rgb(38 140 242)")} Walking (≥ 1.2 m/s)
      </span>
      <span className="inline-flex items-center gap-1.5">
        {sw("rgb(245 158 10)")} Dwelling / queuing (&lt; 0.25 m/s)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-6 rounded-sm" style={{ background: "linear-gradient(90deg, rgb(245 158 10), rgb(38 140 242))" }} /> Agent color = local speed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-6 rounded-sm" style={{ background: "linear-gradient(90deg, hsl(55 95% 50% / .3), hsl(0 95% 50% / .8))" }} /> Floor = peak density 0→4 p/m²
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: "var(--move)" }} /> Moved booth (ghost = previous spot)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: "var(--hotspot)" }} /> Hotspot
      </span>
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

export function Hall3DPanel({ view }: { view: ViewSpec }) {
  const state = useTrajectories(view.source);
  const { clock, playing } = useClock([state], view.durationS ?? 300);
  const [preset, setPreset] = useState<CameraPreset>("overview");
  const [nonce, setNonce] = useState(0);
  const pick = (p: CameraPreset) => (setPreset(p), setNonce((n) => n + 1));
  return (
    <div className="flex flex-col gap-2">
      <Viewport view={view} state={state} clock={clock} playing={playing} preset={preset} presetNonce={nonce} />
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
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 md:grid-cols-2">
        <Viewport view={before} state={a} clock={clock} playing={playing} preset={preset} presetNonce={nonce} link={link} />
        <Viewport view={after} state={b} clock={clock} playing={playing} preset={preset} presetNonce={nonce} link={link} />
      </div>
      <PlaybackBar
        clock={clock}
        preset={preset}
        onPreset={pick}
        extra={<span className="text-[var(--muted)]">Shared clock · cameras linked</span>}
      />
      <Legend3D />
    </div>
  );
}
