/**
 * Design tokens for the "architectural model" look — the ONE place colors are defined.
 *
 * - `app/layout.tsx` writes them as CSS custom properties (`--bg`, `--ink`, …) via `tokenCss()`;
 *   `app/globals.css` maps those onto Tailwind theme colors (`bg-surface`, `text-muted`, …).
 * - The SVG plan uses `var(--…)`; the 3D scene and canvas textures import `TOKENS` directly.
 *
 * Calm, warm off-white study-model palette; one accent (deep teal) for interactive elements and
 * "the agent changed this"; color with real saturation is reserved for crowding (the heat ramp).
 */
export const TOKENS = {
  // surfaces & ink
  bg: "#F4F1EA",
  surface: "#FBFAF7",
  sunken: "#EFEBE3",
  ink: "#1E1E1C",
  inkSoft: "#3A3936",
  muted: "#6B6A65",
  faint: "#9C9A93",
  hairline: "#DAD6CC",
  hairlineStrong: "#C4BFB3",
  // the single accent
  accent: "#1F5F5B",
  accentHover: "#174B48",
  accentSoft: "#E2EBE8",
  accentInk: "#FFFFFF",
  // status (desaturated so they never compete with crowding)
  ok: "#4F7A5E",
  bad: "#A1473A",
  // site materials
  floorIndoor: "#E7E3DA",
  floorOutdoor: "#E6E2D7",
  lawn: "#D5DDCB",
  lawnDeep: "#B9C6AE",
  paving: "#E9E5DB",
  fireLane: "#E4D8CF",
  fireLaneHatch: "#C6A99B",
  stageFront: "#E1DCD0",
  queueArea: "#E0DFD6",
  water: "#CBD6D4",
  model: "#FFFFFF",
  modelShade: "#ECE8E0",
  modelEdge: "#2B2A27",
  foliage: "#C4CFB6",
  wall: "#BDB7AA",
  // crowding ramp (perceptually ordered: transparent → amber → orange → red)
  heat0: "#E8B54D",
  heat1: "#E2913A",
  heat2: "#D2632C",
  heat3: "#B4352A",
} as const;

export type TokenName = keyof typeof TOKENS;

const kebab = (s: string) => s.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`);

/** `:root { --bg: …; --ink: …; … }` for the document head. */
export function tokenCss(): string {
  return `:root{${Object.entries(TOKENS)
    .map(([k, v]) => `--${kebab(k)}:${v}`)
    .join(";")}}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
