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
  return ease(0.25, 0.44, t) * (1 - ease(0.745, 0.805, t));
}

/**
 * Staging reference: Animation Mentor, “Anticipation: The 12 Basic Principles
 * of Animation” (Chris Hurtt): compress before a broad action and leave the
 * surprise reaction until the force arrives.
 * https://www.animationmentor.com/blog/anticipation-the-12-basic-principles-of-animation/
 *
 * Five-second cartoon tape measure: collect hands, brace, tug, read, click,
 * spring-retract, recover. The case/hook are attached by the GLB baker to
 * opposite hands; their connecting strip therefore follows the actual grip.
 */
export function measurePose(t: number): DesignerPose {
  const ready = hold(0.04, 0.19, 0.86, 0.98, t);
  const extension = measureExtension(t);
  const brace = hold(0.15, 0.24, 0.30, 0.39, t);
  const effort = hold(0.27, 0.40, 0.47, 0.56, t);
  const read = hold(0.48, 0.57, 0.68, 0.74, t);
  const nod = hold(0.57, 0.615, 0.635, 0.69, t);
  const click = hold(0.69, 0.73, 0.75, 0.79, t);
  const recoil = hold(0.775, 0.825, 0.835, 0.89, t);
  const settle = hold(0.865, 0.91, 0.92, 0.975, t);
  const gaze = -0.025 * effort + 0.025 * read;
  const yaw = -0.20 * effort + 0.18 * read - 0.10 * recoil;
  const squeeze = 0.105 * brace + 0.085 * settle - 0.095 * recoil;
  const eyeHeight = 1 - 0.38 * brace - 0.20 * effort + 0.22 * recoil;
  return {
    Body: {
      position: [0.075 * effort - 0.085 * recoil, 0.035 * recoil, 0.025 * ready],
      rotation: [0.10 * brace - 0.26 * effort + 0.12 * read + 0.15 * nod + 0.20 * recoil - 0.07 * settle, yaw, -0.19 * effort + 0.18 * recoil - 0.065 * settle],
      scale: [1 + squeeze * 0.55, 1 - squeeze, 1 + squeeze * 0.35],
    },
    ArmL: {
      scale: [1, 1 + 0.25 * ready, 1],
      position: [0.12 * ready - 0.07 * extension, 0.015 * ready, 0.18 * ready],
      rotation: [-1.3 * ready - 0.18 * recoil, -0.08 * extension, 0.9 * ready - 1.75 * extension - 0.25 * recoil],
    },
    ArmR: {
      scale: [1, 1 + 0.25 * ready, 1],
      position: [-0.12 * ready + 0.04 * extension, 0.025 * ready, 0.18 * ready],
      rotation: [-1.3 * ready + 0.18 * click - 0.16 * recoil, 0.06 * extension, -0.9 * ready + 1.55 * extension + 0.23 * recoil],
    },
    FootL: { position: [0, 0.035 * recoil, 0], rotation: [-0.16 * recoil, 0, 0] },
    FootR: { position: [0, 0.02 * effort, 0], rotation: [0, 0, -0.16 * effort] },
    EyeL: { position: [gaze, -0.014 * read - 0.006 * nod + 0.008 * recoil, 0.004 * ready], scale: [1 + 0.055 * recoil, eyeHeight, 1] },
    EyeR: { position: [gaze, -0.014 * read - 0.006 * nod + 0.008 * recoil, 0.004 * ready], scale: [1 + 0.055 * recoil, eyeHeight, 1] },
  };
}
