/**
 * Crowding color ramp shared by the 2D plan, the 3D floor decal, the 3D agents and the legends:
 * transparent → warm amber → orange → red, more opaque as density rises. Colors come from
 * lib/ui/tokens.ts; this is the only saturated color in the console.
 */
import { hexToRgb, TOKENS } from "./tokens";

/** Density (p/m²) mapped to the top of the ramp. */
export const HEAT_MAX = 4;

type Stop = { t: number; rgb: [number, number, number]; a: number };
const STOPS: Stop[] = [
  { t: 0.12, rgb: hexToRgb(TOKENS.heat0), a: 0 },
  { t: 0.3, rgb: hexToRgb(TOKENS.heat0), a: 0.32 },
  { t: 0.55, rgb: hexToRgb(TOKENS.heat1), a: 0.5 },
  { t: 0.78, rgb: hexToRgb(TOKENS.heat2), a: 0.66 },
  { t: 1, rgb: hexToRgb(TOKENS.heat3), a: 0.8 },
];

/** sRGB bytes + alpha 0..1 for a density, or null when it is below the visible threshold. */
export function heatRgba(v: number, max = HEAT_MAX): [number, number, number, number] | null {
  const t = Math.min(1, v / max);
  if (!(t > STOPS[0].t)) return null;
  let i = 1;
  while (i < STOPS.length - 1 && t > STOPS[i].t) i++;
  const a = STOPS[i - 1];
  const b = STOPS[i];
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const mix = (x: number, y: number) => x + (y - x) * f;
  return [Math.round(mix(a.rgb[0], b.rgb[0])), Math.round(mix(a.rgb[1], b.rgb[1])), Math.round(mix(a.rgb[2], b.rgb[2])), mix(a.a, b.a)];
}

export function heatCss(v: number, max = HEAT_MAX): string | null {
  const c = heatRgba(v, max);
  return c && `rgb(${c[0]} ${c[1]} ${c[2]} / ${c[3].toFixed(3)})`;
}

/** CSS gradient of the ramp for legends. */
export const HEAT_GRADIENT = `linear-gradient(90deg, rgb(${hexToRgb(TOKENS.heat0).join(" ")} / 0.15), ${TOKENS.heat0}aa, ${TOKENS.heat1}, ${TOKENS.heat2}, ${TOKENS.heat3})`;

const NEUTRAL: [number, number, number] = [0.62, 0.61, 0.58];
const AMBER = hexToRgb(TOKENS.heat0).map((c) => c / 255) as [number, number, number];
const ORANGE = hexToRgb(TOKENS.heat2).map((c) => c / 255) as [number, number, number];
const RED = hexToRgb(TOKENS.heat3).map((c) => c / 255) as [number, number, number];

/** Local crowding (p/m²) at which a pedestrian turns fully amber / red. */
export const CROWD_AMBER = 1.5;
export const CROWD_RED = 3.5;

/**
 * Pedestrian color by *local* density (sRGB 0..1): neutral grey when uncrowded, warming to amber
 * and then red. Writes into `out` (no allocation; called per agent per frame).
 */
export function crowdColor(density: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  let a: [number, number, number];
  let b: [number, number, number];
  let f: number;
  if (density <= CROWD_AMBER) {
    a = NEUTRAL;
    b = AMBER;
    f = Math.max(0, (density - 0.5) / (CROWD_AMBER - 0.5));
  } else if (density <= (CROWD_AMBER + CROWD_RED) / 2) {
    a = AMBER;
    b = ORANGE;
    f = (density - CROWD_AMBER) / ((CROWD_RED - CROWD_AMBER) / 2);
  } else {
    a = ORANGE;
    b = RED;
    f = Math.min(1, (density - (CROWD_AMBER + CROWD_RED) / 2) / ((CROWD_RED - CROWD_AMBER) / 2));
  }
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}
