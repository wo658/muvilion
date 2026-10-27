/**
 * Density color scale shared by the 2D SVG hall and the 3D floor texture:
 * yellow → orange → red, more opaque as density rises; transparent below 12 % of `max`.
 */
export const HEAT_MAX = 4;

export type Hsla = { h: number; s: number; l: number; a: number };

export function heatHsla(v: number, max = HEAT_MAX): Hsla | null {
  const t = Math.min(1, v / max);
  if (!(t >= 0.12)) return null;
  return { h: 55 - 55 * t, s: 95, l: 50, a: 0.18 + 0.6 * t };
}

export function heatCss(v: number, max = HEAT_MAX): string | null {
  const c = heatHsla(v, max);
  return c && `hsl(${c.h} ${c.s}% ${c.l}% / ${c.a})`;
}

/** Booth fill by popularity (0..1), same lightness ramp as the 2D view. */
export function boothHsl(popularity: number): { h: number; s: number; l: number } {
  return { h: 32, s: 92, l: 93 - popularity * 48 };
}

/** CSS-style HSL (h degrees, s/l percent) → sRGB bytes. */
export function hslToRgb255(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
