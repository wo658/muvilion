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
 * Five-second cartoon brush phrase: wind up, three unmistakable "swish" passes,
 * then inspect and release. The tool follows the hand; no wall/result is assumed.
 * +Z is the working direction. Feet stay planted; gaze never tracks the camera.
 */
export function paintPose(t: number): DesignerPose {
  const time = Math.max(0, Math.min(1, t));
  const attention = phrase(time, [[0, 0], [0.1, 1], [0.85, 1], [1, 0]]);
  const reach = phrase(time, [[0, 0], [0.08, 0], [0.2, 1], [0.81, 1], [0.97, 0], [1, 0]]);
  const anticipation = phrase(time, [[0, 0], [0.1, 1], [0.2, 0], [1, 0]]);
  // Uneven accents keep the broad passes readable: long, quick, small finishing pass.
  const stroke = phrase(time, [[0, 0], [0.1, 0], [0.23, 1], [0.39, -1], [0.51, 0.85], [0.62, -0.8], [0.72, 0.55], [0.81, -0.5], [0.96, 0], [1, 0]]);
  // Eyes lead the brush; torso arrives a beat later, producing visible follow-through.
  const gazeHeight = phrase(time, [[0, 0], [0.19, 1], [0.35, -1], [0.47, 0.85], [0.58, -0.8], [0.68, 0.55], [0.77, -0.5], [0.89, 0], [1, 0]]);
  const follow = phrase(time, [[0, 0], [0.26, 1], [0.42, -1], [0.54, 0.85], [0.65, -0.8], [0.75, 0.55], [0.84, -0.5], [0.98, 0], [1, 0]]);
  const compression = phrase(time, [[0, 0], [0.1, 1], [0.23, -0.5], [0.4, 0.65], [0.52, -0.35], [0.63, 0.45], [0.73, -0.2], [0.82, 0.25], [1, 0]]);

  return {
    Body: {
      position: [0.025 * reach, -0.012 * anticipation, 0.025 * reach],
      rotation: [0.035 * reach - 0.075 * gazeHeight, 0.34 * attention, 0.045 * follow - 0.02 * reach],
      scale: [1 + 0.025 * compression, 1 - 0.035 * compression, 1 + 0.015 * compression],
    },
    ArmR: {
      position: [0, 0.015 * reach, 0.025 * reach],
      rotation: [-1.7 * reach - 0.6 * stroke + 0.23 * anticipation, 0.08 * reach, 0.33 * reach + 0.12 * stroke],
    },
    ArmL: {
      rotation: [-0.3 * reach + 0.12 * anticipation - 0.09 * follow, 0, -0.2 * reach + 0.06 * follow],
    },
    FootL: { rotation: [0, 0.055 * attention, 0] },
    FootR: { rotation: [0, 0.11 * attention, 0] },
    EyeL: {
      position: [0.02 * attention, 0.02 * gazeHeight, 0],
      rotation: [-0.055 * gazeHeight, 0.055 * attention, 0],
    },
    EyeR: {
      position: [0.02 * attention, 0.02 * gazeHeight, 0],
      rotation: [-0.055 * gazeHeight, 0.055 * attention, 0],
    },
  };
}
