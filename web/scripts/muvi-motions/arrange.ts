import type { DesignerPose } from "./types";

type Beat = readonly [time: number, value: number];
export const hammerHits = [0.275, 0.475, 0.735] as const;
const launches = [0.235, 0.435, 0.69] as const;
const contactWrist = -Math.PI + 0.08 + 1.75;

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

/** Contact accents begin only when the forward-facing hammer lands. */
export function hammerImpact(t: number) {
  return Math.max(...hammerHits.map(hit => t < hit ? 0 : 1 - ease(hit, hit + 0.055, t)));
}

/** Shared timings keep shoulder, wrist and full-body weight transfer coordinated. */
export function hammerPhase(t: number) {
  const time = Math.max(0, Math.min(1, t));
  const hold = ease(0.03, 0.13, time) * (1 - ease(0.87, 1, time));
  const pullback = phrase(time, [
    [0, 0], [0.1, 0], [0.205, 1], [0.235, 1], [0.275, 0], [0.31, 0.25],
    [0.405, 1], [0.435, 1], [0.475, 0], [0.515, 0.25],
    [0.65, 1], [0.69, 1], [0.735, 0], [0.78, 0.25], [0.87, 0], [1, 0],
  ]);
  const drive = Math.max(...hammerHits.map((hit, index) =>
    ease(launches[index], hit, time) * (1 - ease(hit + 0.012, hit + 0.065, time))));
  const recoil = Math.max(...hammerHits.map(hit =>
    ease(hit, hit + 0.025, time) * (1 - ease(hit + 0.025, hit + 0.085, time))));
  const flight = Math.max(...hammerHits.map((hit, index) => {
    if (time >= hit) return 0;
    const u = ease(launches[index], hit, time);
    return 4 * u * (1 - u);
  }));
  return { hold, pullback, drive, recoil, flight };
}

/**
 * At contact: body -.08 + shoulder -1.75 + wrist = -PI. This turns the
 * hammer's local -Z striking face toward world +Z, against a FRONT wall.
 */
export function hammerWristAngle(t: number) {
  const { hold, pullback, recoil } = hammerPhase(t);
  return contactWrist * hold + (0.64 - contactWrist) * pullback + 0.22 * recoil;
}

/**
 * Broad cartoon anticipation, forward strike and follow-through in five seconds.
 * Shoot the working arm above and behind the head, hold, then swing down
 * while the torso withdraws from the wall. Three contacts share one exact pose and one forward-facing target.
 * The body and stepping foot exaggerate weight transfer; the root never navigates.
 */
export function arrangePose(t: number): DesignerPose {
  const { hold, pullback, drive, recoil, flight } = hammerPhase(t);
  const squash = 0.09 * pullback + 0.1 * recoil * (1 - pullback);
  const stretch = 0.085 * flight;
  return {
    Body: {
      position: [-0.035 * pullback, 0.06 * pullback - 0.015 * recoil, -0.08 * drive + 0.03 * pullback],
      rotation: [-0.08 * drive - 0.14 * pullback - 0.035 * recoil, 0.28 * pullback, -0.07 * pullback],
      // Overhead anticipation stretch and recoil squash are absent at contact,
      // preserving a repeatable target and an exactly forward-facing strike face.
      scale: [1 + 0.035 * squash, 1 + 0.04 * pullback - 0.1 * recoil * (1 - pullback) - stretch * 0.35, 1 + squash * 0.5 + stretch],
    },
    ArmR: {
      position: [-0.12 * drive, 0.68 * pullback + 0.06 * drive, 0.45 * drive - 0.16 * pullback],
      rotation: [-0.55 * hold - 1.2 * drive - 2.95 * pullback, -0.12 * pullback, 0.1 * pullback],
    },
    ArmL: {
      position: [0, 0.02 * pullback, 0],
      rotation: [-0.45 * hold + 0.45 * pullback - 0.3 * drive, 0.1 * pullback, -0.5 * hold - 0.2 * pullback],
    },
    FootL: { position: [0, 0, -0.06 * hold], rotation: [0, 0, 0] },
    FootR: { position: [0, 0.045 * pullback, 0.12 * hold], rotation: [0, 0, 0] },
    EyeL: {
      position: [0, -0.008 * hold, 0],
      rotation: [0.01 * hold, 0.08 * pullback, 0],
      scale: [1 + 0.06 * recoil, 1 - 0.16 * recoil, 1],
    },
    EyeR: {
      position: [0, -0.008 * hold, 0],
      rotation: [0.01 * hold, 0.08 * pullback, 0],
      scale: [1 + 0.06 * recoil, 1 - 0.16 * recoil, 1],
    },
  };
}
