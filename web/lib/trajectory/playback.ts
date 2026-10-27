/**
 * Pure playback math for engine Trajectories (no three.js, safe on the server and in tests).
 *
 * Time model: frame k is sampled at t = k * dt (seconds of simulated time), k = 0 .. frames-1.
 * A track starts at frame `t0` and has `xy.length / 2` consecutive samples; the agent exists
 * from t0 * dt to (t0 + n - 1) * dt inclusive and is hidden outside that window. Between two
 * samples the position is linearly interpolated.
 */
import type { AgentTrack, Trajectories } from "@/lib/engine/contract";

/** Number of samples in a track. */
export function trackLength(track: Pick<AgentTrack, "xy">): number {
  return track.xy.length >> 1;
}

/** Simulated seconds covered by the recording (last frame time). */
export function trajectoryDuration(traj: Pick<Trajectories, "dt" | "frames">): number {
  return Math.max(0, (traj.frames - 1) * traj.dt);
}

/** Fractional frame index for a simulated time (clamped to >= 0). */
export function frameAt(t: number, dt: number): number {
  return Math.max(0, t / dt);
}

export type Sample = { x: number; y: number; /** m/s between the bracketing samples */ speed: number };

/**
 * Position of a track at time `t` (seconds), or null when the agent is not in the hall
 * (before its first sample or after its last). Writes into `out` when given (no allocation).
 */
export function sampleTrack(
  track: Pick<AgentTrack, "t0" | "xy">,
  t: number,
  dt: number,
  out: Sample = { x: 0, y: 0, speed: 0 },
): Sample | null {
  const n = track.xy.length >> 1;
  if (n === 0) return null;
  const local = t / dt - track.t0;
  // small epsilon so the exact last-frame time still counts as present
  if (local < -1e-9 || local > n - 1 + 1e-9) return null;
  const xy = track.xy;
  if (n === 1) {
    out.x = xy[0];
    out.y = xy[1];
    out.speed = 0;
    return out;
  }
  const i = Math.min(n - 2, Math.max(0, Math.floor(local)));
  const a = Math.min(1, Math.max(0, local - i));
  const x0 = xy[2 * i];
  const y0 = xy[2 * i + 1];
  const x1 = xy[2 * i + 2];
  const y1 = xy[2 * i + 3];
  out.x = x0 + (x1 - x0) * a;
  out.y = y0 + (y1 - y0) * a;
  out.speed = Math.hypot(x1 - x0, y1 - y0) / dt;
  return out;
}

/** Agents present at time t. */
export function countPresent(traj: Pick<Trajectories, "dt" | "agents">, t: number): number {
  let c = 0;
  for (const a of traj.agents) {
    const n = a.xy.length >> 1;
    const local = t / traj.dt - a.t0;
    if (n > 0 && local >= -1e-9 && local <= n - 1 + 1e-9) c++;
  }
  return c;
}

/** Below this speed (m/s) an agent counts as dwelling. */
export const DWELL_SPEED = 0.25;
/** Speed (m/s) mapped to the full "moving" color. */
export const MOVE_SPEED = 1.2;

/**
 * Agent color by local speed: dwelling = amber, walking = blue. Returns linear-ish sRGB 0..1.
 * (Legend in components/hall-3d/legend.)
 */
export function speedColor(speed: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const t = Math.min(1, Math.max(0, (speed - DWELL_SPEED) / (MOVE_SPEED - DWELL_SPEED)));
  // amber (0.96, 0.62, 0.04) → sky blue (0.15, 0.55, 0.95)
  out[0] = 0.96 + (0.15 - 0.96) * t;
  out[1] = 0.62 + (0.55 - 0.62) * t;
  out[2] = 0.04 + (0.95 - 0.04) * t;
  return out;
}
