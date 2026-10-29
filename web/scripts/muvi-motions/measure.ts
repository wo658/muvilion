import type { DesignerPose } from "./types";

function ease(from: number, to: number, t: number) {
  const u = Math.max(0, Math.min(1, (t - from) / (to - from)));
  return u * u * u * (u * (u * 6 - 15) + 10);
}
function hold(start: number, arrive: number, leave: number, end: number, t: number) {
  return ease(start, arrive, t) * (1 - ease(leave, end, t));
}

/** Pull takes effort; the spring winds the tape back much faster than it came out. */
export function measureExtension(t: number): number {
  return ease(0.23, 0.49, t) * (1 - ease(0.73, 0.81, t));
}

/**
 * Five-second cartoon tape measure: collect hands, brace, tug, read, click,
 * spring-retract, recover. The case/hook are attached by the GLB baker to
 * opposite hands; their connecting strip therefore follows the actual grip.
 */
export function measurePose(t: number): DesignerPose {
  const ready = hold(0.04, 0.19, 0.86, 0.98, t);
  const extension = measureExtension(t);
  const brace = hold(0.16, 0.25, 0.46, 0.54, t);
  const read = hold(0.48, 0.57, 0.68, 0.74, t);
  const nod = hold(0.59, 0.63, 0.65, 0.70, t);
  const click = hold(0.69, 0.73, 0.75, 0.79, t);
  const recoil = hold(0.75, 0.81, 0.82, 0.88, t);
  const settle = hold(0.83, 0.88, 0.89, 0.95, t);
  const gaze = -0.018 * brace + 0.025 * read;
  const yaw = -0.10 * brace + 0.13 * read - 0.06 * recoil;
  const squeeze = 0.045 * brace + 0.025 * settle - 0.035 * recoil;
  return {
    Body: {
      position: [0.025 * brace - 0.035 * recoil, 0.01 * recoil, 0.015 * ready],
      rotation: [-0.15 * brace + 0.10 * read + 0.055 * nod + 0.10 * recoil, yaw, -0.035 * brace + 0.05 * recoil],
      scale: [1 + squeeze * 0.55, 1 - squeeze, 1 + squeeze * 0.35],
    },
    ArmL: {
      scale: [1, 1 + 0.25 * ready, 1],
      position: [0.12 * ready - 0.07 * extension, 0.015 * ready, 0.18 * ready],
      rotation: [-1.3 * ready - 0.10 * recoil, -0.08 * extension, 0.9 * ready - 1.60 * extension - 0.13 * recoil],
    },
    ArmR: {
      scale: [1, 1 + 0.25 * ready, 1],
      position: [-0.12 * ready + 0.04 * extension, 0.025 * ready, 0.18 * ready],
      rotation: [-1.3 * ready + 0.09 * click - 0.08 * recoil, 0.06 * extension, -0.9 * ready + 1.50 * extension + 0.11 * recoil],
    },
    FootL: { position: [0, 0, 0], rotation: [0, 0, 0] },
    FootR: { position: [0, 0, 0], rotation: [0, 0, 0] },
    EyeL: { position: [gaze, -0.014 * read - 0.006 * nod + 0.008 * recoil, 0.004 * ready] },
    EyeR: { position: [gaze, -0.014 * read - 0.006 * nod + 0.008 * recoil, 0.004 * ready] },
  };
}
