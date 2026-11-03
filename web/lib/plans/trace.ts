import { z } from "zod";
import type { PlanDocument, PlanLine } from "./schema";
import { isSimpleFootprint } from "./footprint";
import type { PlanFloor } from "./floor";

const Point = z.object({ x: z.number(), y: z.number() });
/** Where the drawing states a real size. Muse locates it; code turns it into metres. */
export const ScaleEvidence = z.object({
  source: z.enum(["scale-bar", "dimension", "area-label", "module"]),
  label: z.string().max(200),
  value: z.number().positive(),
  unit: z.enum(["m", "ft", "m2", "ft2"]),
  a: Point.optional(), b: Point.optional(),
  polygon: z.array(Point).max(64).optional(),
  /** Set only by code after a zoomed tick fit succeeds; the server clears any model-supplied value. */
  refined: z.boolean().optional(),
});
export type ScaleEvidence = z.infer<typeof ScaleEvidence>;
/** Muse traces walls from the page image. Coordinates are approximate and scale stays unconfirmed. */
export const PlanTrace = z.object({
  texts: z.array(z.object({ text: z.string().min(1).max(2000), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(1000).optional(),
  summary: z.string().min(1).max(2000),
  walls: z.array(z.object({ a: Point, b: Point })).max(400),
  scaleEvidence: z.array(ScaleEvidence).max(8).default([]),
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

/** Clamp to the frame, square up nearly axis-aligned walls and drop degenerate segments. */
export function traceLines(trace: Pick<PlanTrace, "walls">): PlanLine[] {
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

/** A short length reference is re-read on a zoomed crop; a few pixels of error matter there. */
export function needsRefinement(item: ScaleEvidence, width: number, height: number) {
  if (item.source === "area-label" || !item.a || !item.b) return false;
  return Math.hypot((item.b.x - item.a.x) * width, (item.b.y - item.a.y) * height) < Math.max(width, height) * 0.3;
}

/** Normalized crop around a length reference, padded so its ticks and label stay visible. */
export function refinementWindow(item: ScaleEvidence, width: number, height: number) {
  const a = item.a!, b = item.b!;
  const pad = Math.max(Math.hypot((b.x - a.x) * width, (b.y - a.y) * height) * 0.6, Math.max(width, height) * 0.03);
  const x0 = clamp(Math.min(a.x, b.x) - pad / width), x1 = clamp(Math.max(a.x, b.x) + pad / width);
  const y0 = clamp(Math.min(a.y, b.y) - pad / height), y1 = clamp(Math.max(a.y, b.y) + pad / height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export const ReferenceLocation = z.object({
  found: z.boolean(),
  ticks: z.array(z.object({ value: z.number().min(0), x: z.number(), y: z.number() })).max(24),
});
/**
 * Fit every labelled tick on the zoomed crop to one straight scale, then map the 0 and reference-value
 * positions back to the page. Several ticks average out a misplaced one; disagreement keeps the first reading.
 */
export function applyRefinement(item: ScaleEvidence, window: ReturnType<typeof refinementWindow>, input: unknown): ScaleEvidence {
  const located = ReferenceLocation.safeParse(input);
  if (!located.success || !located.data.found) return item;
  const ticks = located.data.ticks
    .filter(tick => tick.value <= item.value * 1.001)
    .map(tick => ({ value: tick.value, x: window.x + clamp(tick.x) * window.width, y: window.y + clamp(tick.y) * window.height }));
  const values = new Set(ticks.map(tick => tick.value));
  if (values.size < 2) return item;
  const mean = (pick: (tick: typeof ticks[number]) => number) => ticks.reduce((sum, tick) => sum + pick(tick), 0) / ticks.length;
  const mv = mean(t => t.value), mx = mean(t => t.x), my = mean(t => t.y);
  const vv = ticks.reduce((sum, t) => sum + (t.value - mv) ** 2, 0);
  const sx = ticks.reduce((sum, t) => sum + (t.value - mv) * (t.x - mx), 0) / vv;
  const sy = ticks.reduce((sum, t) => sum + (t.value - mv) * (t.y - my), 0) / vv;
  const at = (value: number) => ({ x: mx + sx * (value - mv), y: my + sy * (value - mv) });
  const a = at(0), b = at(item.value);
  if (Math.hypot(b.x - a.x, b.y - a.y) < Math.hypot(window.width, window.height) * 0.1) return item;
  return { ...item, a, b, refined: true };
}

const FOOT = 0.3048;
const RANK = { "scale-bar": 1, dimension: 1, "area-label": 2, module: 3 } as const;
const DESCRIPTION = { "scale-bar": "the scale bar", dimension: "a dimension line", "area-label": "a labelled area", module: "an assumed standard booth size" } as const;
const median = (values: number[]) => [...values].sort((x, y) => x - y)[Math.floor((values.length - 1) / 2)];

/** Metres per source pixel from one piece of evidence, or null when it is unusable. */
function metresPerPixel(item: ScaleEvidence, width: number, height: number): { mpp: number; size: number } | null {
  const longest = Math.max(width, height);
  if (item.source === "area-label") {
    const polygon = item.polygon ?? [];
    if (polygon.length < 3 || (item.unit !== "m2" && item.unit !== "ft2")) return null;
    let twice = 0;
    polygon.forEach((p, i) => { const q = polygon[(i + 1) % polygon.length]; twice += p.x * width * q.y * height - q.x * width * p.y * height; });
    const area = Math.abs(twice) / 2;
    if (area < (longest * 0.05) ** 2) return null;
    return { mpp: Math.sqrt(item.value * (item.unit === "ft2" ? FOOT * FOOT : 1) / area), size: Math.sqrt(area) };
  }
  if (!item.a || !item.b || (item.unit !== "m" && item.unit !== "ft")) return null;
  const length = Math.hypot((item.b.x - item.a.x) * width, (item.b.y - item.a.y) * height);
  if (length < longest * 0.02) return null;
  return { mpp: item.value * (item.unit === "ft" ? FOOT : 1) / length, size: length };
}

/** Drawing extent in metres from the most reliable evidence: stated lengths, then areas, then module assumptions. */
export function scaleFromEvidence(document: PlanDocument, evidence: ScaleEvidence[]) {
  const { width, height } = document.source;
  const usable = evidence.flatMap(item => { const scale = metresPerPixel(item, width, height); return scale ? [{ item, ...scale }] : []; });
  if (!usable.length) return null;
  const rank = Math.min(...usable.map(entry => RANK[entry.item.source]));
  // Longer references carry less relative endpoint error.
  const best = usable.filter(entry => RANK[entry.item.source] === rank).sort((x, y) => y.size - x.size).slice(0, 3);
  const mpp = median(best.map(entry => entry.mpp));
  const widthMeters = Math.round(width * mpp * 10) / 10, heightMeters = Math.round(height * mpp * 10) / 10;
  if (!(widthMeters >= 1 && heightMeters >= 1 && widthMeters <= 10000 && heightMeters <= 10000)) return null;
  const spread = Math.max(...best.map(entry => entry.mpp)) / Math.min(...best.map(entry => entry.mpp)) - 1;
  return { widthMeters, heightMeters, source: best[0].item.source, label: best[0].item.label, spread, references: best.length, refined: best.some(entry => entry.item.refined === true) };
}

/** Use image-grounded model walls/text, preserving rendering warnings and unconfirmed scale. */
export function applyTrace(document: PlanDocument, input: unknown): PlanDocument {
  const trace = PlanTrace.parse(input);
  const lines = traceLines(trace);
  const scale = document.widthMeters || document.heightMeters ? null : scaleFromEvidence(document, trace.scaleEvidence);
  const confirmed = scale && scaleIsMeasured(scale);
  return {
    ...document,
    lines,
    texts: trace.texts?.map((item, index) => ({ ...item, id: `muse-text-${index + 1}` })) ?? document.texts,
    method: "muse",
    ...(scale ? { widthMeters: scale.widthMeters, heightMeters: scale.heightMeters, scaleConfirmed: Boolean(confirmed), ...(confirmed ? { scaleSource: "muse" as const, scaleEvidence: `${DESCRIPTION[scale.source]} (${scale.label})`.slice(0, 300) } : {}) } : {}),
    warnings: [...new Set([
      ...document.warnings,
      ...(!lines.length ? ["Muse found no walls. Review the source image before designing."] : []),
      "Muse traced these walls from the drawing image. They are a concept approximation; check them against the source drawing.",
      scale ? confirmed ? `Muse set the scale from ${DESCRIPTION[scale.source]} (${scale.label}). Re-measure in Drawing settings if it looks wrong.` : `Scale estimated from ${DESCRIPTION[scale.source]} (${scale.label}). Confirm scale before design.` : "No scale reference was found in this drawing. Enter its real dimensions before design.",
      ...(scale && scale.spread > 0.15 ? [`Scale references disagree by ${Math.round(scale.spread * 100)}%. Check the dimensions.`] : []),
      ...trace.uncertainties,
    ])].slice(0, 40),
  };
}

/**
 * Muse confirms scale only from a printed length (scale bar or dimension) that is cross-checked: a zoomed tick fit,
 * or at least two independent references agreeing within 5%. A single unchecked reading, areas and module sizes stay estimates.
 */
export function scaleIsMeasured(scale: NonNullable<ReturnType<typeof scaleFromEvidence>>) {
  return (scale.source === "scale-bar" || scale.source === "dimension") && scale.spread <= 0.05 && (scale.refined || scale.references >= 2);
}

/** Keep a Muse floor outline only when it is a valid simple polygon inside the frame. */
export function traceFloor(points: PlanFloor["floorBoundary"]) {
  if (!points) return null;
  const outline = points.map(point => ({ x: clamp(point.x), y: clamp(point.y) }));
  return isSimpleFootprint(outline) ? outline : null;
}

/** Muse's traced floor outline; never replaces a reviewed one. */
export function applyFloor(document: PlanDocument, reading: PlanFloor | null): PlanDocument {
  const floor = document.floorBoundary ? null : traceFloor(reading?.floorBoundary);
  if (!floor) return document;
  return { ...document, floorBoundary: floor, warnings: [...new Set([...document.warnings, "Muse traced the interior floor outline. Adjust it in Drawing settings if it includes non-event areas."])].slice(0, 40) };
}

/** Reading steps arrive as committed operations; merge each into the drawing as it is now so user scale/floor edits made meanwhile survive. */
export function mergeReading(current: PlanDocument, step: "walls" | "floor", reading: PlanDocument): PlanDocument {
  const warnings = [...new Set([...current.warnings, ...reading.warnings])].slice(0, 100);
  const scale = !current.scaleConfirmed && !current.widthMeters && reading.widthMeters
    ? { widthMeters: reading.widthMeters, heightMeters: reading.heightMeters, scaleConfirmed: reading.scaleConfirmed, scaleSource: reading.scaleSource, scaleEvidence: reading.scaleEvidence } : {};
  if (step === "walls") return { ...current, lines: reading.lines, texts: reading.texts, method: reading.method, warnings, ...scale };
  return { ...current, warnings, ...(!current.floorBoundary && reading.floorBoundary ? { floorBoundary: reading.floorBoundary } : {}) };
}
