import type { DesignerPose } from "./types";

type Beat = readonly [time: number, value: number];
const hits = [0.275, 0.475, 0.735] as const;

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

/** Contact accents begin on contact, never during the downstroke. */
export function hammerImpact(t: number) {
  return Math.max(...hits.map(hit => t < hit ? 0 : 1 - ease(hit, hit + 0.055, t)));
}

/**
 * Local wrist X rotation, relative to the forward-held arm. A short wrist lever
 * supplies the hammer arc; the shoulder does not throw the whole tool overhead.
 */
export function hammerWristAngle(t: number) {
  return phrase(Math.max(0, Math.min(1, t)), [
    [0, 0], [0.13, 0],
    [0.205, -0.9], [0.235, -0.9], [0.275, 0], [0.3, -0.14], [0.33, -0.08],
    [0.405, -0.95], [0.435, -0.95], [0.475, 0], [0.5, -0.14], [0.54, -0.08],
    [0.65, -1], [0.69, -1], [0.735, 0], [0.76, -0.16], [0.8, -0.04],
    [0.85, 0], [1, 0],
  ]);
}

/**
 * Five-second phrase: hold the forearm toward one target, lift at the wrist,
 * tap, and recoil. All three strikes have exactly the same contact pose.
 * No surface or successful construction result is implied.
 */
export function arrangePose(t: number): DesignerPose {
  const time = Math.max(0, Math.min(1, t));
  const attention = ease(0.02, 0.14, time) * (1 - ease(0.86, 1, time));
  const hold = ease(0.05, 0.18, time) * (1 - ease(0.85, 1, time));
  const windup = phrase(time, [
    [0, 0], [0.13, 0], [0.205, 1], [0.235, 1], [0.275, 0], [0.33, 0],
    [0.405, 1], [0.435, 1], [0.475, 0], [0.54, 0],
    [0.65, 1], [0.69, 1], [0.735, 0], [1, 0],
  ]);
  // Delayed response: no shifting target or compression before a strike lands.
  const response = Math.max(...hits.map(hit =>
    ease(hit, hit + 0.015, time) * (1 - ease(hit + 0.015, hit + 0.07, time))));

  return {
    Body: {
      position: [0, -0.006 * response, 0],
      rotation: [0.025 * hold, 0.12 * attention, 0],
      scale: [1 + 0.004 * response, 1 - 0.008 * response, 1 + 0.004 * response],
    },
    ArmR: {
      position: [0, 0, 0],
      rotation: [-1.45 * hold - 0.08 * windup, 0, 0.15 * hold],
    },
    ArmL: {
      rotation: [-0.3 * hold, 0, -0.22 * hold],
    },
    FootL: { position: [0, 0, 0], rotation: [0, 0, 0] },
    FootR: { position: [0, 0, 0], rotation: [0, 0, 0] },
    EyeL: {
      position: [0.012 * attention, -0.016 * attention, 0],
      rotation: [0.025 * attention, 0.025 * attention, 0],
    },
    EyeR: {
      position: [0.012 * attention, -0.016 * attention, 0],
      rotation: [0.025 * attention, 0.025 * attention, 0],
    },
  };
}
