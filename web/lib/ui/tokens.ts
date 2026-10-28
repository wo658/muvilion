/**
 * Design tokens — the ONE place colors are defined.
 *
 * - `app/layout.tsx` writes them as CSS custom properties (`--bg`, `--ink`, …) via `tokenCss()`;
 *   `app/globals.css` maps those onto Tailwind theme colors (`bg-surface`, `text-muted`, …).
 * - The SVG plan uses `var(--…)`; the 3D scene and canvas textures import `TOKENS` directly.
 *
 * Muse tone (after Meta's Muse developer pages): cool neutral greys, blue-grey ink, one accent
 * (Meta blue) for interactive elements and "the agent changed this"; Muse's avatar carries a blue
 * gradient. The white study model stays; saturated color is reserved for crowding.
 */
export const TOKENS = {
  // surfaces & ink
  bg: "#F3F4F5",
  surface: "#FFFFFF",
  sunken: "#E7EAED",
  ink: "#0A1317",
  inkSoft: "#1C2B33",
  muted: "#4E606F",
  faint: "#8C939B",
  hairline: "#E0E2E4",
  hairlineStrong: "#C9CED3",
  // the single accent
  accent: "#0064E0",
  accentHover: "#0457CB",
  accentSoft: "#E6EFFC",
  accentInk: "#FFFFFF",
  // Muse's avatar gradient (accent → glow)
  museGlow: "#4F8EF0",
  // status (desaturated so they never compete with crowding)
  ok: "#2F7A5B",
  bad: "#B3402F",
  badSoft: "#FFF1EF",
  overlay: "#0A131747",
  shadowColor: "#0A131714",
  // site materials (cool, low-chroma)
  floorIndoor: "#E3E6E9",
  floorOutdoor: "#E5E8EA",
  lawn: "#D2DDD3",
  lawnDeep: "#B5C6B8",
  paving: "#EBEDEF",
  fireLane: "#ECDDD8",
  fireLaneHatch: "#C9A094",
  stageFront: "#DDE3E8",
  queueArea: "#E1E6EB",
  water: "#C6D4E6",
  model: "#FFFFFF",
  modelShade: "#E8EBEE",
  modelEdge: "#1C2B33",
  foliage: "#C2D1C6",
  wall: "#B4BDC6",
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
