/**
 * Design tokens — the ONE place colors are defined.
 *
 * - `app/layout.tsx` writes them as CSS custom properties (`--bg`, `--ink`, …) via `tokenCss()`;
 *   `app/globals.css` maps those onto Tailwind theme colors (`bg-surface`, `text-muted`, …).
 * - The SVG plan uses `var(--…)`; the 3D scene and canvas textures import `TOKENS` directly.
 *
 * Muse tone (after Meta's Muse developer pages): cool neutral greys, one accent (Meta blue) for
 * interactive elements and "the agent changed this"; Muse's avatar carries a blue gradient.
 * The white study model stays; saturated color is reserved for crowding.
 *
 * Neutrals come from one validated 12-step scale (Radix Colors Slate, light) so every grey shares
 * the same hue, and each step keeps its documented role. `tests/tokens.test.ts` checks text
 * contrast (WCAG AA) and that UI code uses no literal colors.
 */
const SLATE = {
  2: "#F9F9FB", // app background
  3: "#F0F0F3", // component background: wells, hover
  5: "#E0E1E6", // selected / pressed background, under ink or muted text only
  6: "#D9D9E0", // subtle borders, separators
  7: "#CDCED6", // interactive borders
  8: "#B9BBC6", // strong borders, edges in drawings
  10: "#80838D", // decorative icons and drawing marks (not body text)
  11: "#60646C", // secondary text
  12: "#1C2024", // primary text
} as const;

export const TOKENS = {
  // surfaces & ink
  bg: SLATE[2],
  surface: "#FFFFFF",
  sunken: SLATE[3],
  selected: SLATE[5],
  ink: SLATE[12],
  inkSoft: SLATE[12],
  muted: SLATE[11],
  faint: SLATE[10],
  hairline: SLATE[6],
  hairlineStrong: SLATE[7],
  edge: SLATE[8],
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
  overlay: "#1C202447",
  shadowColor: "#1C202414",
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
  // 2D plan: drawing evidence, zones, objects and venue markers
  evidenceWall: "#2F7A5B",
  evidenceDimension: "#AA7933",
  zoneCirculation: "#EDF1EF",
  zoneLounge: "#E8E1D1",
  zoneStage: "#DCE3EF",
  zoneOther: "#E4EFED",
  zoneOverlay: "#7FB7B2",
  objectPlant: "#9DB798",
  objectStage: "#6D809D",
  objectBooth: "#DBE7EF",
  objectSofa: "#D7CBB5",
  objectOther: "#F1EADE",
  objectDefault: "#89A9B6",
  venueExisting: "#A5AFB8",
  venuePartition: "#82B9DF",
  venuePartitionEdge: "#256897",
  venueEntrance: "#17876F",
  venueCap: "#657582",
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
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
