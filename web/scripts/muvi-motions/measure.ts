import type { DesignerPose } from "./types";

// Quintic easing gives every intentional hold a still, soft arrival rather than
// a mechanical reversal. The final quiet beat can blend into any other action.
function ease(from: number, to: number, t: number) {
  const u = Math.max(0, Math.min(1, (t - from) / (to - from)));
  return u * u * u * (u * (u * 6 - 15) + 10);
}
function hold(start: number, arrive: number, leave: number, end: number, t: number) {
  return ease(start, arrive, t) * (1 - ease(leave, end, t));
}

/**
 * Five-second spacing study, in place and independent of object dimensions.
 * Look to the first extent → establish the near hand → open the far hand →
 * compare both extents → small confirming nod → release each hand in turn.
 * Feet stay planted: this is an attention/working gesture, not a measured span.
 */
export function measurePose(t: number): DesignerPose {
  const ready = hold(0.04, 0.21, 0.74, 0.96, t);
  const near = hold(0.12, 0.30, 0.70, 0.91, t);
  const far = hold(0.28, 0.47, 0.76, 0.95, t);
  const lookNear = hold(0.05, 0.18, 0.34, 0.48, t);
  const lookFar = hold(0.35, 0.50, 0.63, 0.77, t);
  const check = hold(0.56, 0.64, 0.68, 0.76, t);
  const nod = hold(0.64, 0.69, 0.72, 0.80, t);
  const yaw = -0.14 * lookNear + 0.17 * lookFar;
  const gaze = -0.018 * lookNear + 0.022 * lookFar;
  return {
    Body: {
      position: [0.018 * (far - near), -0.014 * ready, 0.012 * ready],
      rotation: [0.075 * ready + 0.035 * nod, yaw, 0.014 * (near - far)],
    },
    ArmL: {
      position: [0.025 * near, 0.012 * near, 0.025 * near],
      rotation: [-1.12 * near, -0.07 * near, -0.31 * near + 0.025 * check],
    },
    ArmR: {
      position: [-0.02 * far, 0.018 * far, 0.03 * far],
      rotation: [-1.04 * far - 0.045 * check, 0.09 * far, 0.39 * far - 0.035 * check],
    },
    FootL: { position: [0, 0, 0], rotation: [0, 0, 0] },
    FootR: { position: [0, 0, 0], rotation: [0, 0, 0] },
    EyeL: { position: [gaze, -0.012 * ready - 0.004 * nod, 0.004 * ready] },
    EyeR: { position: [gaze, -0.012 * ready - 0.004 * nod, 0.004 * ready] },
  };
}
