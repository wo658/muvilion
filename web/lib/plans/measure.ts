import { z } from "zod";

const Point = z.object({ x: z.number(), y: z.number() });
/** Muse's reading of the scale reference and usable floor; code converts it into document fields. */
export const PlanMeasure = z.object({
  scale: z.object({ a: Point, b: Point, meters: z.number().positive().max(10000), evidence: z.string().min(1).max(200) }).optional(),
  floorBoundary: z.array(Point).min(3).max(128).optional(),
  notes: z.array(z.string().max(300)).max(8).default([]),
});
export type PlanMeasure = z.infer<typeof PlanMeasure>;
/** Graduated bar body (or dimension span) inside a zoomed crop; its long side is the reference length. */
export const ScaleBar = z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() });
export type ScaleBar = z.infer<typeof ScaleBar>;

export type PixelBox = { left: number; top: number; width: number; height: number };
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Pixel crop around an approximate reference, padded enough to contain both marks even when Muse is a few percent off. */
export function scaleCrop(size: { width: number; height: number }, scale: NonNullable<PlanMeasure["scale"]>): PixelBox {
  const ax = clamp(scale.a.x) * size.width, ay = clamp(scale.a.y) * size.height;
  const bx = clamp(scale.b.x) * size.width, by = clamp(scale.b.y) * size.height;
  const pad = Math.max(48, Math.hypot(bx - ax, by - ay) * 0.35, Math.min(size.width, size.height) * 0.04);
  const left = Math.max(0, Math.floor(Math.min(ax, bx) - pad)), top = Math.max(0, Math.floor(Math.min(ay, by) - pad));
  const right = Math.min(size.width, Math.ceil(Math.max(ax, bx) + pad)), bottom = Math.min(size.height, Math.ceil(Math.max(ay, by) + pad));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/** Average zoomed readings, map them back to whole-image marks along the bar's long axis and reject outliers. */
export function refinedMarks(size: { width: number; height: number }, box: PixelBox, bars: ScaleBar[], estimate: NonNullable<PlanMeasure["scale"]>) {
  const estimated = Math.hypot((estimate.b.x - estimate.a.x) * size.width, (estimate.b.y - estimate.a.y) * size.height);
  const spans = bars.map(bar => {
    const left = box.left + clamp(Math.min(bar.left, bar.right)) * box.width, right = box.left + clamp(Math.max(bar.left, bar.right)) * box.width;
    const top = box.top + clamp(Math.min(bar.top, bar.bottom)) * box.height, bottom = box.top + clamp(Math.max(bar.top, bar.bottom)) * box.height;
    return bottom - top > right - left
      ? { a: { x: (left + right) / 2, y: top }, b: { x: (left + right) / 2, y: bottom } }
      : { a: { x: left, y: (top + bottom) / 2 }, b: { x: right, y: (top + bottom) / 2 } };
  }).filter(span => {
    const length = Math.hypot(span.b.x - span.a.x, span.b.y - span.a.y);
    return length > 0 && length / estimated > 0.8 && length / estimated < 1.25;
  });
  if (!spans.length) return null;
  const mean = (pick: (span: typeof spans[number]) => number) => spans.reduce((sum, span) => sum + pick(span), 0) / spans.length;
  return { a: { x: mean(s => s.a.x) / size.width, y: mean(s => s.a.y) / size.height }, b: { x: mean(s => s.b.x) / size.width, y: mean(s => s.b.y) / size.height } };
}
