import type { DesignerPose } from "./types";

type Beat = readonly [time: number, value: number];

// Zero velocity at each contact/reversal: deliberate strokes, not a metronomic wave.
function phrase(t: number, beats: readonly Beat[]) {
  for (let i = 1; i < beats.length; i++) {
    const [end, value] = beats[i];
    if (t <= end) {
      const [start, previous] = beats[i - 1];
      const u = Math.max(0, Math.min(1, (t - start) / (end - start)));
      const ease = u * u * u * (u * (u * 6 - 15) + 10);
      return previous + (value - previous) * ease;
    }
  }
  return beats[beats.length - 1][1];
}

/**
 * Five-second cartoon brush phrase: a big opposing wind-up, three unequal swishes,
 * a proud high-brush finish, then overlapping settle. No wall/result is assumed.
 * Attention leads the action; body and free arm trail the brush, never the camera.
 */
export function paintPose(t: number): DesignerPose {
  const time = Math.max(0, Math.min(1, t));
  const attention = phrase(time, [[0, 0], [0.11, 1], [0.88, 1], [1, 0]]);
  const reach = phrase(time, [[0, 0], [0.12, 0], [0.21, 1], [0.85, 1], [0.98, 0], [1, 0]]);
  const anticipation = phrase(time, [[0, 0], [0.11, 1], [0.15, 1], [0.23, 0], [1, 0]]);
  // Held high poses give way to quick, long brush passes; the last pass flicks up.
  const stroke = phrase(time, [[0, 0], [0.14, 0], [0.24, 1], [0.29, 1], [0.38, -1], [0.48, 0.8], [0.52, 0.8], [0.59, -0.85], [0.67, 0.6], [0.74, -0.6], [0.82, 1], [0.86, 1], [0.98, 0], [1, 0]]);
  const gazeHeight = phrase(time, [[0, 0], [0.2, 1], [0.34, -1], [0.44, 0.8], [0.55, -0.85], [0.63, 0.6], [0.7, -0.6], [0.78, 1], [0.87, 1], [0.98, 0], [1, 0]]);
  // Delayed torso overshoots make the same hand action read as whole-body effort.
  const follow = phrase(time, [[0, 0], [0.13, -0.65], [0.27, 1], [0.41, -1], [0.51, 0.8], [0.62, -0.85], [0.7, 0.6], [0.77, -0.6], [0.85, 1], [0.92, -0.22], [1, 0]]);
  const compression = phrase(time, [[0, 0], [0.13, 1], [0.25, -1], [0.4, 0.85], [0.5, -0.8], [0.61, 0.7], [0.69, -0.6], [0.76, 0.65], [0.85, -1], [0.93, 0.3], [1, 0]]);
  const leftTap = phrase(time, [[0, 0], [0.16, 0], [0.23, 1], [0.31, 0], [0.74, 0], [0.83, 0.8], [0.91, 0], [1, 0]]);
  const rightTap = phrase(time, [[0, 0], [0.48, 0], [0.57, 1], [0.65, 0], [1, 0]]);

  return {
    Body: {
      position: [0.075 * follow, 0.015 * reach, 0.055 * reach - 0.035 * anticipation],
      rotation: [0.045 * reach - 0.12 * gazeHeight - 0.09 * anticipation, 0.36 * attention + 0.2 * follow, 0.23 * follow],
      scale: [1 + 0.055 * compression, 1 - 0.1 * compression, 1 + 0.04 * compression],
    },
    ArmR: {
      position: [0.015 * reach, 0.025 * reach, 0.03 * reach],
      rotation: [-1.7 * reach - 0.82 * stroke + 0.45 * anticipation, 0.12 * reach, 0.47 * reach + 0.16 * stroke + 0.25 * anticipation],
    },
    ArmL: {
      rotation: [-0.55 * reach + 0.3 * anticipation - 0.22 * follow, 0, -0.55 * reach + 0.28 * follow],
    },
    FootL: {
      position: [0, 0.1 * leftTap, 0.035 * leftTap],
      rotation: [0, 0.09 * attention, 0],
    },
    FootR: {
      position: [0, 0.085 * rightTap, 0.03 * rightTap],
      rotation: [0, 0.16 * attention, 0],
    },
    EyeL: {
      position: [0.025 * attention, 0.024 * gazeHeight, 0],
      rotation: [-0.07 * gazeHeight, 0.06 * attention, 0],
    },
    EyeR: {
      position: [0.025 * attention, 0.024 * gazeHeight, 0],
      rotation: [-0.07 * gazeHeight, 0.06 * attention, 0],
    },
  };
}
