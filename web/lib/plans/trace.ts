import { z } from "zod";
import type { PlanDocument, PlanLine } from "./schema";
import { isSimpleFootprint } from "./footprint";
import type { PlanMeasure } from "./measure";

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

/** Some model responses stringify nested arrays/objects in tool arguments; decode those top-level fields before validation. */
export function decodeToolInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (typeof value !== "string" || !/^\s*[[{]/.test(value)) return [key, value];
    try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
  }));
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const AXIS_SNAP = 0.01;
const MIN_SCALE_PIXELS = 20;

/** Convert Muse's measured reference into the full drawing extent, like the user's two-point calibration. */
export function traceScale(document: Pick<PlanDocument, "source">, scale: PlanMeasure["scale"]) {
  if (!scale) return null;
  const pixels = Math.hypot((clamp(scale.b.x) - clamp(scale.a.x)) * document.source.width, (clamp(scale.b.y) - clamp(scale.a.y)) * document.source.height);
  if (pixels < MIN_SCALE_PIXELS) return null;
  const widthMeters = document.source.width / pixels * scale.meters, heightMeters = document.source.height / pixels * scale.meters;
  if (widthMeters > 2000 || heightMeters > 2000) return null;
  return { widthMeters: Math.round(widthMeters * 100) / 100, heightMeters: Math.round(heightMeters * 100) / 100, evidence: scale.evidence };
}

/** Keep a Muse floor outline only when it is a valid simple polygon inside the frame. */
export function traceFloor(points: PlanMeasure["floorBoundary"]) {
  if (!points) return null;
  const outline = points.map(point => ({ x: clamp(point.x), y: clamp(point.y) }));
  return isSimpleFootprint(outline) ? outline : null;
}

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

const ESTIMATE_WARNING = "Muse estimated the drawing extent from its dimension text. Confirm scale before design.";

/** Use image-grounded model walls/text, preserving rendering warnings and unconfirmed scale. */
export function applyTrace(document: PlanDocument, input: unknown, measure: PlanMeasure | null = null): PlanDocument {
  const trace = PlanTrace.parse(decodeToolInput(input));
  const lines = traceLines(trace);
  const sized = !document.scaleConfirmed && !document.widthMeters && !document.heightMeters && trace.widthMeters && trace.heightMeters;
  return applyMeasure({
    ...document,
    lines,
    texts: trace.texts?.map((item, index) => ({ ...item, id: `muse-text-${index + 1}` })) ?? document.texts,
    method: "muse",
    ...(sized ? { widthMeters: trace.widthMeters!, heightMeters: trace.heightMeters!, scaleConfirmed: false } : {}),
    warnings: [...new Set([
      ...document.warnings,
      ...(!lines.length ? ["Muse found no walls. Review the source image before designing."] : []),
      "Muse traced these walls from the drawing image. They are a concept approximation; check them against the source drawing.",
      ...(sized ? [ESTIMATE_WARNING] : []),
      ...trace.uncertainties,
    ])].slice(0, 40),
  }, measure);
}

/** Muse's measured scale and floor outline; never replaces a confirmed scale or reviewed outline. */
export function applyMeasure(document: PlanDocument, measure: PlanMeasure | null): PlanDocument {
  const measured = document.scaleConfirmed ? null : traceScale(document, measure?.scale);
  const floor = document.floorBoundary ? null : traceFloor(measure?.floorBoundary);
  if (!measured && !floor) return document;
  return {
    ...document,
    ...(measured ? { widthMeters: measured.widthMeters, heightMeters: measured.heightMeters, scaleConfirmed: true, scaleSource: "muse" as const, scaleEvidence: measured.evidence } : {}),
    ...(floor ? { floorBoundary: floor } : {}),
    warnings: [...new Set([
      ...document.warnings.filter(warning => !(measured && warning === ESTIMATE_WARNING)),
      ...(measured ? [`Muse set the scale from ${measured.evidence}. Re-measure in Drawing settings if it looks wrong.`] : []),
      ...(floor ? ["Muse traced the interior floor outline. Adjust it in Drawing settings if it includes non-event areas."] : []),
    ])].slice(0, 40),
  };
}

/** Reading steps arrive as committed operations; merge each into the drawing as it is now so user scale/floor edits made meanwhile survive. */
export function mergeReading(current: PlanDocument, step: "walls" | "measured", reading: PlanDocument): PlanDocument {
  const warnings = [...new Set([...current.warnings, ...reading.warnings])].slice(0, 100);
  if (step === "walls") return {
    ...current, lines: reading.lines, texts: reading.texts, method: reading.method, warnings,
    ...(!current.scaleConfirmed && !current.widthMeters && reading.widthMeters ? { widthMeters: reading.widthMeters, heightMeters: reading.heightMeters } : {}),
  };
  return {
    ...current, warnings,
    ...(!current.scaleConfirmed && reading.scaleConfirmed ? { widthMeters: reading.widthMeters, heightMeters: reading.heightMeters, scaleConfirmed: true, scaleSource: reading.scaleSource, scaleEvidence: reading.scaleEvidence } : {}),
    ...(!current.floorBoundary && reading.floorBoundary ? { floorBoundary: reading.floorBoundary } : {}),
  };
}
