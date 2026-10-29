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
 * A five-second survey: notice one area, compare another, then lean toward a detail.
 * Eyes lead the torso and the hand follows attention, never the viewing camera.
 * The open indicating hand stays ahead of the shoulder rather than intersecting
 * Muvi's broad face. No prop, surface contact or successful result is implied.
 */
export function inspectPose(t: number): DesignerPose {
  const time = Math.max(0, Math.min(1, t));
  const gaze = phrase(time, [[0, 0], [0.12, -1], [0.24, -1], [0.37, 1], [0.79, 1], [0.94, 0], [1, 0]]);
  const turn = phrase(time, [[0, 0], [0.05, 0], [0.2, -1], [0.28, -1], [0.46, 1], [0.82, 1], [1, 0]]);
  const lookDown = phrase(time, [[0, 0], [0.39, 0], [0.53, 1], [0.7, 1], [0.83, 0], [1, 0]]);
  const lean = phrase(time, [[0, 0], [0.44, 0], [0.6, 1], [0.7, 1], [0.88, 0], [1, 0]]);
  const indicate = phrase(time, [[0, 0], [0.46, 0], [0.64, 1], [0.73, 1], [0.92, 0], [1, 0]]);
  const release = phrase(time, [[0, 0], [0.74, 0], [0.83, 1], [0.95, 0], [1, 0]]);

  return {
    Body: {
      position: [0.012 * turn, -0.012 * lean, 0.018 * lean],
      rotation: [0.11 * lean - 0.018 * release, 0.29 * turn, -0.025 * lean],
    },
    ArmL: {
      rotation: [0.08 * lean, 0, -0.04 * lean],
    },
    ArmR: {
      position: [-0.018 * indicate, 0.012 * indicate, 0.025 * indicate],
      rotation: [-1.12 * indicate + 0.06 * release, -0.06 * indicate, 0.25 * indicate],
    },
    FootL: { position: [0, 0, 0], rotation: [0, 0, 0] },
    FootR: { position: [0, 0, 0], rotation: [0, 0, 0] },
    EyeL: {
      position: [0.019 * gaze, -0.018 * lookDown, 0],
      rotation: [0.045 * lookDown, 0.035 * gaze, 0],
    },
    EyeR: {
      position: [0.019 * gaze, -0.018 * lookDown, 0],
      rotation: [0.045 * lookDown, 0.035 * gaze, 0],
    },
  };
}
