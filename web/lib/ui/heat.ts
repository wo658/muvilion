/**
 * Crowding color ramp shared by the 2D plan, the 3D floor decal, the 3D agents and the legends.
 * It is anchored on the crowd threshold (SimulateRequest.crowd_threshold, default 2 p/m²), the
 * line the agent optimizes against: below it colors stay faint, at it they step to solid amber,
 * above it they deepen through orange to red. Colors come from lib/ui/tokens.ts; this is the only
 * saturated color in the console.
 */
import { hexToRgb, TOKENS } from "./tokens";

/** Density (p/m²) mapped to the top of the ramp. */
export const HEAT_MAX = 4;
/** Default crowd threshold (p/m²): a cell is "crowded" at or above this. */
export const CROWD_THRESHOLD = 2;

type Stop = { d: number; rgb: [number, number, number]; a: number };

/** Ramp stops in density units; the step at the threshold makes "crowded" readable at a glance. */
function stops(threshold: number, max: number): Stop[] {
  const amber = hexToRgb(TOKENS.heat0);
  return [
    { d: threshold * 0.3, rgb: amber, a: 0 },
    { d: threshold - 1e-6, rgb: amber, a: 0.2 },
    { d: threshold, rgb: amber, a: 0.55 },
    { d: threshold + (max - threshold) * 0.35, rgb: hexToRgb(TOKENS.heat1), a: 0.62 },
    { d: threshold + (max - threshold) * 0.7, rgb: hexToRgb(TOKENS.heat2), a: 0.7 },
    { d: max, rgb: hexToRgb(TOKENS.heat3), a: 0.8 },
  ];
}

/** sRGB bytes + alpha 0..1 for a density, or null when it is below the visible threshold. */
export function heatRgba(v: number, max = HEAT_MAX, threshold = CROWD_THRESHOLD): [number, number, number, number] | null {
  const s = stops(threshold, max);
  const d = Math.min(max, v);
  if (!(d > s[0].d)) return null;
  let i = 1;
  while (i < s.length - 1 && d > s[i].d) i++;
  const a = s[i - 1];
  const b = s[i];
  const f = Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d)));
  const mix = (x: number, y: number) => x + (y - x) * f;
  return [Math.round(mix(a.rgb[0], b.rgb[0])), Math.round(mix(a.rgb[1], b.rgb[1])), Math.round(mix(a.rgb[2], b.rgb[2])), mix(a.a, b.a)];
}

export function heatCss(v: number, max = HEAT_MAX, threshold = CROWD_THRESHOLD): string | null {
  const c = heatRgba(v, max, threshold);
  return c && `rgb(${c[0]} ${c[1]} ${c[2]} / ${c[3].toFixed(3)})`;
}

/** Where the threshold sits on a 0 → HEAT_MAX legend (0..1). */
export const THRESHOLD_AT = CROWD_THRESHOLD / HEAT_MAX;

/** CSS gradient of the ramp for legends (0 → HEAT_MAX), with the step at the threshold. */
export const HEAT_GRADIENT = (() => {
  const p = (x: number) => `${(x * 100).toFixed(1)}%`;
  const amber = hexToRgb(TOKENS.heat0).join(" ");
  return `linear-gradient(90deg, rgb(${amber} / 0.05) 0%, rgb(${amber} / 0.3) ${p(THRESHOLD_AT)}, ${TOKENS.heat0} ${p(THRESHOLD_AT)}, ${TOKENS.heat1} ${p(THRESHOLD_AT + (1 - THRESHOLD_AT) * 0.35)}, ${TOKENS.heat2} ${p(THRESHOLD_AT + (1 - THRESHOLD_AT) * 0.7)}, ${TOKENS.heat3} 100%)`;
})();

const NEUTRAL: [number, number, number] = [0.62, 0.61, 0.58];
const AMBER = hexToRgb(TOKENS.heat0).map((c) => c / 255) as [number, number, number];
const ORANGE = hexToRgb(TOKENS.heat2).map((c) => c / 255) as [number, number, number];
const RED = hexToRgb(TOKENS.heat3).map((c) => c / 255) as [number, number, number];

/** Local crowding (p/m²) at which a pedestrian turns amber (= the crowd threshold) / fully red. */
export const CROWD_AMBER = CROWD_THRESHOLD;
export const CROWD_RED = 3.5;
/** Below the threshold a pedestrian only takes this much of the amber tint. */
const SUB_THRESHOLD_TINT = 0.25;

/** CSS gradient for the pedestrian legend (0 → CROWD_RED + 0.5), stepping to amber at the threshold. */
export const CROWD_GRADIENT = (() => {
  const top = CROWD_RED + 0.5;
  const p = (d: number) => `${((d / top) * 100).toFixed(1)}%`;
  const n = NEUTRAL.map((c) => Math.round(c * 255)).join(" ");
  const tint = NEUTRAL.map((c, i) => Math.round((c + (AMBER[i] - c) * SUB_THRESHOLD_TINT) * 255)).join(" ");
  return `linear-gradient(90deg, rgb(${n}) 0%, rgb(${n}) ${p(1)}, rgb(${tint}) ${p(CROWD_AMBER)}, ${TOKENS.heat0} ${p(CROWD_AMBER)}, ${TOKENS.heat2} ${p((CROWD_AMBER + CROWD_RED) / 2)}, ${TOKENS.heat3} ${p(CROWD_RED)})`;
})();

/**
 * Pedestrian color by *local* density (sRGB 0..1): neutral grey when uncrowded, only faintly warm
 * below the crowd threshold, solid amber from the threshold, then orange and red. Writes into
 * `out` (no allocation; called per agent per frame).
 */
export function crowdColor(density: number, out: [number, number, number] = [0, 0, 0], threshold = CROWD_AMBER): [number, number, number] {
  let a: [number, number, number];
  let b: [number, number, number];
  let f: number;
  const mid = (threshold + CROWD_RED) / 2;
  if (density < threshold) {
    a = NEUTRAL;
    b = AMBER;
    f = SUB_THRESHOLD_TINT * Math.max(0, (density - threshold / 2) / (threshold / 2));
  } else if (density <= mid) {
    a = AMBER;
    b = ORANGE;
    f = (density - threshold) / Math.max(1e-6, mid - threshold);
  } else {
    a = ORANGE;
    b = RED;
    f = Math.min(1, (density - mid) / Math.max(1e-6, CROWD_RED - mid));
  }
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}
