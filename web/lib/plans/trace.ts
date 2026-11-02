import { z } from "zod";
import type { PlanDocument, PlanLine } from "./schema";

const Point = z.object({ x: z.number(), y: z.number() });
/** Muse traces walls from the page image. Coordinates are approximate and scale stays unconfirmed. */
export const PlanTrace = z.object({
  texts: z.array(z.object({ text: z.string().min(1).max(2000), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(1000).optional(),
  summary: z.string().min(1).max(2000),
  walls: z.array(z.object({ a: Point, b: Point })).max(400),
  widthMeters: z.number().positive().max(10000).optional(),
  heightMeters: z.number().positive().max(10000).optional(),
  uncertainties: z.array(z.string().max(300)).max(12),
});
export type PlanTrace = z.infer<typeof PlanTrace>;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const AXIS_SNAP = 0.01;

/** Clamp to the frame, square up nearly axis-aligned walls and drop degenerate segments. */
export function traceLines(trace: PlanTrace): PlanLine[] {
  const lines: PlanLine[] = [];
  for (const wall of trace.walls) {
    const a = { x: clamp(wall.a.x), y: clamp(wall.a.y) }, b = { x: clamp(wall.b.x), y: clamp(wall.b.y) };
    if (Math.abs(a.y - b.y) < AXIS_SNAP && Math.abs(a.x - b.x) > Math.abs(a.y - b.y)) a.y = b.y = (a.y + b.y) / 2;
    else if (Math.abs(a.x - b.x) < AXIS_SNAP && Math.abs(a.y - b.y) > Math.abs(a.x - b.x)) a.x = b.x = (a.x + b.x) / 2;
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.005) continue;
    lines.push({ id: `muse-${lines.length + 1}`, a, b, kind: "wall", origin: "ai", confidence: 0.75 });
  }
  return lines;
}

export function traceEvidence(document: PlanDocument) {
  return {
    source: document.source,
    coordinates: "Normalized 0..1; origin top-left; x right, y down. The image and text positions share this frame.",
    texts: document.texts.slice(0, 200),
  };
}

/** Use image-grounded model walls/text, preserving rendering warnings and unconfirmed scale. */
export function applyTrace(document: PlanDocument, input: unknown): PlanDocument {
  const trace = PlanTrace.parse(input);
  const lines = traceLines(trace);
  const sized = !document.widthMeters && !document.heightMeters && trace.widthMeters && trace.heightMeters;
  return {
    ...document,
    lines,
    texts: trace.texts?.map((item, index) => ({ ...item, id: `muse-text-${index + 1}` })) ?? document.texts,
    method: "muse",
    ...(sized ? { widthMeters: trace.widthMeters!, heightMeters: trace.heightMeters!, scaleConfirmed: false } : {}),
    warnings: [...new Set([
      ...document.warnings,
      ...(!lines.length ? ["Muse found no walls. Review the source image before designing."] : []),
      "Muse traced these walls from the drawing image. They are a concept approximation; check them against the source drawing.",
      ...(sized ? ["Muse estimated the drawing extent from its dimension text. Confirm scale before design."] : []),
      ...trace.uncertainties,
    ])].slice(0, 40),
  };
}
