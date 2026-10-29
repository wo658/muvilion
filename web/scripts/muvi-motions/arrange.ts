import type { DesignerPose } from "./types";

// Five-second, in-place arranging gesture. The gaze leads, the supporting hand
// arrives first, and the working hand makes a small final adjustment before release.
// No dimensions or props are implied: the same gesture can accompany any placement.
function ease(from: number, to: number, t: number) {
  const u = Math.max(0, Math.min(1, (t - from) / (to - from)));
  return u * u * u * (u * (u * 6 - 15) + 10);
}
function hold(t: number, start: number, ready: number, release: number, end: number) {
  return ease(start, ready, t) * (1 - ease(release, end, t));
}

export function arrangePose(t: number): DesignerPose {
  const focus = hold(t, 0.03, 0.19, 0.82, 1);
  const prepare = hold(t, 0.08, 0.2, 0.3, 0.46);
  const support = hold(t, 0.16, 0.35, 0.74, 0.96);
  const reach = hold(t, 0.23, 0.44, 0.72, 0.94);
  const settle = hold(t, 0.43, 0.57, 0.65, 0.79);
  const check = hold(t, 0.61, 0.72, 0.79, 0.93);

  return {
    Body: {
      position: [0.025 * focus, -0.025 * prepare - 0.012 * settle, 0.025 * reach],
      rotation: [0.075 * reach - 0.025 * check, 0.28 * focus, -0.018 * support],
    },
    ArmL: {
      position: [0.065 * support, 0.012 * support, 0.09 * support],
      rotation: [-1.02 * support, -0.08 * support, -0.19 * support],
    },
    ArmR: {
      // A deliberate forward reach, a short down-and-in placement, then release.
      // Translation remains small enough that the rigid shoulder stays attached.
      position: [-0.055 * reach - 0.025 * settle, -0.018 * settle, 0.11 * reach],
      rotation: [-1.23 * reach + 0.12 * settle, 0.1 * reach, 0.16 * reach - 0.1 * settle],
    },
    FootL: { position: [0, 0, 0], rotation: [0, 0, 0] },
    FootR: { position: [0, 0, 0], rotation: [0, 0, 0] },
    EyeL: { position: [0.012 * focus, -0.018 * reach, 0.002 * focus] },
    EyeR: { position: [0.012 * focus, -0.018 * reach, 0.002 * focus] },
  };
}
