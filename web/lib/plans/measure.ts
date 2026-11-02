import { z } from "zod";

const Point = z.object({ x: z.number(), y: z.number() });
/** Muse's reading of the usable event floor; code keeps only a valid outline. Scale comes from wall tracing evidence. */
export const PlanMeasure = z.object({
  floorBoundary: z.array(Point).min(3).max(128).optional(),
  notes: z.array(z.string().max(300)).max(8).default([]),
});
export type PlanMeasure = z.infer<typeof PlanMeasure>;
