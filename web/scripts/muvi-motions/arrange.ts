import type { DesignerPose } from "./types";

type Beat = readonly [time: number, value: number];

function ease(from: number, to: number, t: number) {
  const u = Math.max(0, Math.min(1, (t - from) / (to - from)));
  return u * u * u * (u * (u * 6 - 15) + 10);
}
function phrase(t: number, beats: readonly Beat[]) {
  for (let i = 1; i < beats.length; i++) {
    const [end, value] = beats[i];
    if (t <= end) {
      const [start, previous] = beats[i - 1];
      return previous + (value - previous) * ease(start, end, t);
    }
  }
  return beats[beats.length - 1][1];
}

/** A brief graphic contact beat, useful for optional cartoon impact rays. */
export function hammerImpact(t: number) {
  return Math.max(...[0.275, 0.475, 0.735].map(hit =>
    ease(hit - 0.012, hit, t) * (1 - ease(hit, hit + 0.055, t))));
}

/**
 * Five seconds of playful "tap, tap ... THUNK". Each strike has a broad held
 * wind-up, a much faster downstroke, and a visible recoil. The toy hammer follows
 * ArmR; no wall, contact surface or successful construction result is assumed.
 */
export function arrangePose(t: number): DesignerPose {
  const time = Math.max(0, Math.min(1, t));
  const attention = ease(0.02, 0.14, time) * (1 - ease(0.84, 1, time));
  const swing = phrase(time, [
    [0, 0], [0.08, -0.6], [0.19, -2.55], [0.235, -2.65],
    [0.275, -0.92], [0.32, -1.35],
    [0.4, -2.6], [0.435, -2.7], [0.475, -0.92], [0.52, -1.4],
    [0.64, -2.75], [0.69, -2.85], [0.735, -0.88], [0.78, -1.3],
    [0.87, -0.7], [1, 0],
  ]);
  const windup = phrase(time, [
    [0, 0], [0.19, 0.9], [0.235, 1], [0.275, 0], [0.32, 0],
    [0.4, 0.95], [0.435, 1], [0.475, 0], [0.52, 0],
    [0.64, 1], [0.69, 1.1], [0.735, 0], [1, 0],
  ]);
  const impact = hammerImpact(time);
  const rebound = phrase(time, [
    [0, 0], [0.275, 0], [0.32, 1], [0.38, 0],
    [0.475, 0], [0.52, 1], [0.59, 0],
    [0.735, 0], [0.79, 1], [0.88, 0], [1, 0],
  ]);
  const squash = 0.075 * impact - 0.055 * windup;

  return {
    Body: {
      position: [0.025 * attention, 0, 0.015 * impact],
      rotation: [0.105 * impact - 0.065 * windup, 0.26 * attention, -0.055 * windup + 0.035 * impact],
      scale: [1 + squash * 0.65, 1 - squash, 1 + squash * 0.5],
    },
    ArmR: {
      position: [0, 0.025 * windup, 0],
      rotation: [swing, 0.04 * attention, 0.15 * attention + 0.07 * windup],
    },
    ArmL: {
      rotation: [-0.35 * attention - 0.23 * windup + 0.08 * impact, 0, -0.32 * attention - 0.12 * rebound],
    },
    FootL: { position: [0, 0, 0], rotation: [0, 0, 0] },
    FootR: { position: [0, 0, 0], rotation: [0, 0, 0] },
    EyeL: {
      position: [0.014 * attention, -0.014 * attention + 0.014 * windup, 0],
      scale: [1 + 0.045 * impact, 1 - 0.14 * impact, 1],
    },
    EyeR: {
      position: [0.014 * attention, -0.014 * attention + 0.014 * windup, 0],
      scale: [1 + 0.045 * impact, 1 - 0.14 * impact, 1],
    },
  };
}
