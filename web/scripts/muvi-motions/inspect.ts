import type { DesignerPose } from "./types";

type Beat = readonly [time: number, value: number];

function phrase(t: number, beats: readonly Beat[]) {
  for (let i = 1; i < beats.length; i++) {
    const [end, value] = beats[i];
    if (t <= end) {
      const [start, previous] = beats[i - 1];
      const u = Math.max(0, Math.min(1, (t - start) / (end - start)));
      const eased = u * u * u * (u * (u * 6 - 15) + 10);
      return previous + (value - previous) * eased;
    }
  }
  return beats[beats.length - 1][1];
}

/**
 * Five-second space survey: wind up low, spot left, whip attention right, lean
 * into a detail, spring back and present the space with both arms. Large poses
 * read from any camera; attention is expressed in the local work direction.
 *
 * Reference: Animation Mentor / Chris Hurtt, “Anticipation: The 12 Basic
 * Principles of Animation”: opposing wind-up and compression make the fast
 * ensuing action legible. The stretch follows the spring rather than leading it.
 * https://www.animationmentor.com/blog/anticipation-the-12-basic-principles-of-animation/
 */
export function inspectPose(t: number): DesignerPose {
  const time = Math.max(0, Math.min(1, t));
  const crouch = phrase(time, [[0, 0], [0.035, 0], [0.12, 1], [0.18, 0], [1, 0]]);
  const gaze = phrase(time, [[0, 0], [0.09, 0], [0.14, -1], [0.29, -1], [0.35, 1], [0.68, 1], [0.77, 0], [1, 0]]);
  const turn = phrase(time, [[0, 0], [0.09, 0.16], [0.19, -1], [0.29, -1], [0.40, 1], [0.65, 1], [0.76, -0.16], [0.88, 0], [1, 0]]);
  const pointLeft = phrase(time, [[0, 0], [0.13, 0], [0.23, 1], [0.28, 1], [0.39, 0], [1, 0]]);
  const pointRight = phrase(time, [[0, 0], [0.32, 0], [0.44, 1], [0.65, 1], [0.74, 0], [1, 0]]);
  const lean = phrase(time, [[0, 0], [0.44, 0], [0.56, 1], [0.64, 1], [0.73, 0], [1, 0]]);
  const spring = phrase(time, [[0, 0], [0.67, 0], [0.75, 1], [0.78, 1], [0.85, 0], [1, 0]]);
  const present = phrase(time, [[0, 0], [0.72, 0], [0.82, 1], [0.88, 1], [0.98, 0], [1, 0]]);
  const settle = phrase(time, [[0, 0], [0.81, 0], [0.87, 1], [0.92, 0], [1, 0]]);
  const tapLeft = phrase(time, [[0, 0], [0.17, 0], [0.22, 1], [0.27, 0], [1, 0]]);
  const tapRight = phrase(time, [[0, 0], [0.38, 0], [0.43, 1], [0.48, 0], [1, 0]]);
  const squash = 0.10 * crouch + 0.055 * settle - 0.09 * spring;
  const eyeHeight = 1 - 0.35 * crouch - 0.18 * lean + 0.18 * spring;

  return {
    Body: {
      position: [0.08 * turn, 0.045 * spring, 0.12 * lean - 0.055 * spring],
      rotation: [0.14 * crouch + 0.32 * lean - 0.21 * spring + 0.055 * settle, 0.64 * turn, -0.09 * turn - 0.08 * spring],
      scale: [1 + 0.55 * squash, 1 - squash, 1 + 0.35 * squash],
    },
    ArmL: {
      position: [0, 0.025 * present, 0.07 * pointLeft],
      rotation: [-0.75 * pointLeft - 0.42 * present + 0.18 * crouch, -0.10 * pointLeft, -1.05 * pointLeft - 1.35 * present],
      scale: [1, 1 + 0.12 * pointLeft, 1],
    },
    ArmR: {
      position: [0.035 * pointRight, 0.025 * present, 0.08 * pointRight],
      rotation: [-1.30 * pointRight - 0.42 * present + 0.18 * crouch, 0.10 * pointRight, 0.70 * pointRight + 1.35 * present],
      scale: [1, 1 + 0.15 * pointRight, 1],
    },
    FootL: { position: [0, 0.055 * tapLeft, 0], rotation: [-0.20 * tapLeft, 0, 0] },
    FootR: { position: [0, 0.055 * tapRight, 0], rotation: [-0.20 * tapRight, 0, 0] },
    EyeL: {
      position: [0.026 * gaze, -0.022 * lean + 0.008 * spring, 0.004 * lean],
      rotation: [0.065 * lean, 0.045 * gaze, 0],
      scale: [1 + 0.05 * spring, eyeHeight, 1],
    },
    EyeR: {
      position: [0.026 * gaze, -0.022 * lean + 0.008 * spring, 0.004 * lean],
      rotation: [0.065 * lean, 0.045 * gaze, 0],
      scale: [1 + 0.05 * spring, eyeHeight, 1],
    },
  };
}
