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
 * Five-second finish/application phrase, independent of any wall, brush or result.
 * Attention leads the right hand; two unequal passes end with a short inspection.
 * +Z is the working direction. Feet remain planted and the body never faces a camera.
 */
export function paintPose(t: number): DesignerPose {
  const time = Math.max(0, Math.min(1, t));
  const attention = phrase(time, [[0, 0], [0.12, 1], [0.81, 1], [1, 0]]);
  const reach = phrase(time, [[0, 0], [0.08, 0], [0.25, 1], [0.78, 1], [0.94, 0], [1, 0]]);
  // The hand rises, makes a longer downstroke, returns more lightly, then eases away.
  const stroke = phrase(time, [[0, 0], [0.26, 0.82], [0.47, -0.38], [0.64, 0.58], [0.78, -0.2], [1, 0]]);
  const gazeHeight = phrase(time, [[0, 0], [0.2, 0.82], [0.43, -0.38], [0.6, 0.58], [0.77, -0.2], [0.89, 0], [1, 0]]);
  const anticipation = phrase(time, [[0, 0], [0.1, 1], [0.25, 0], [1, 0]]);
  const settle = phrase(time, [[0, 0], [0.75, 0], [0.85, 1], [1, 0]]);

  return {
    Body: {
      position: [0.025 * reach, -0.012 * anticipation - 0.008 * reach, 0.025 * reach],
      rotation: [0.035 * reach - 0.055 * gazeHeight, 0.34 * attention, -0.025 * reach + 0.012 * stroke],
    },
    ArmR: {
      position: [0, 0.015 * reach, 0.025 * reach],
      rotation: [-1.5 * reach - 0.5 * stroke + 0.12 * anticipation, 0.08 * reach, 0.17 * reach + 0.06 * stroke],
    },
    ArmL: {
      rotation: [-0.24 * reach + 0.06 * anticipation, 0, -0.14 * reach - 0.035 * settle],
    },
    FootL: { rotation: [0, 0.055 * attention, 0] },
    FootR: { rotation: [0, 0.11 * attention, 0] },
    EyeL: {
      position: [0.018 * attention, 0.014 * gazeHeight, 0],
      rotation: [-0.045 * gazeHeight, 0.045 * attention, 0],
    },
    EyeR: {
      position: [0.018 * attention, 0.014 * gazeHeight, 0],
      rotation: [-0.045 * gazeHeight, 0.045 * attention, 0],
    },
  };
}
