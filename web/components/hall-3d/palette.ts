/** Scene colors, taken from the design tokens (lib/ui/tokens.ts). The model is light-only. */
import { TOKENS } from "@/lib/ui/tokens";

export const PALETTE = {
  background: TOKENS.bg,
  ground: TOKENS.sunken,
  floorIndoor: TOKENS.floorIndoor,
  floorOutdoor: TOKENS.floorOutdoor,
  grid: TOKENS.hairlineStrong,
  wall: TOKENS.wall,
  model: TOKENS.model,
  modelShade: TOKENS.modelShade,
  edge: TOKENS.modelEdge,
  foliage: TOKENS.foliage,
  water: TOKENS.water,
  accent: TOKENS.accent,
  hotspot: TOKENS.heat3,
  ink: TOKENS.ink,
  muted: TOKENS.muted,
  labelBg: "rgba(255,255,255,0.94)",
  labelFg: TOKENS.ink,
  zone: {
    lawn: TOKENS.lawn,
    paved: TOKENS.paving,
    fire_lane: TOKENS.fireLane,
    stage_front: TOKENS.stageFront,
    queue_area: TOKENS.queueArea,
  },
  fireHatch: TOKENS.fireLaneHatch,
} as const;

export type Palette = typeof PALETTE;
