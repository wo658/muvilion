import type { PlanDocument } from "./schema";

type Point = { x: number; y: number };
export type DerivedWall = {
  id: string;
  /** All source evidence remains in the document, including redundant lines. */
  evidenceIds: string[];
  a: Point;
  b: Point;
  thickness: number;
  thicknessSource: "provisional" | "inferred-parallel-edges";
};
type Segment = { id: string; a: Point; b: Point; length: number };
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Coordinates are metres from the drawing's top-left; unconfirmed scale is illustrative.
 * By default merge only collinear evidence. Optional parallel pairing remains an
 * explicitly inferred preview heuristic, never a confirmed wall measurement. Confirmed gaps above 5 mm always remain open.
 */
export function deriveWalls(document: Pick<PlanDocument, "lines" | "source" | "widthMeters" | "heightMeters" | "scaleConfirmed">, options: { pairParallelEdges?: boolean } = {}): DerivedWall[] {
  const width = document.widthMeters ?? 10;
  const depth = document.heightMeters ?? width * document.source.height / document.source.width;
  const confirmed = document.scaleConfirmed && document.widthMeters !== null && document.heightMeters !== null;
  const tolerance = confirmed ? 0.001 : 1e-8;
  const gapTolerance = confirmed ? 0.005 : 1e-8;
  const segments: Segment[] = document.lines.filter(line => line.kind === "wall").map(line => {
    let a = { x: line.a.x * width, y: line.a.y * depth };
    let b = { x: line.b.x * width, y: line.b.y * depth };
    if (a.x > b.x || (a.x === b.x && a.y > b.y)) [a, b] = [b, a];
    return { id: line.id, a, b, length: Math.hypot(b.x - a.x, b.y - a.y) };
  }).filter(line => line.length > 1e-8).sort((a, b) => b.length - a.length || compare(a.id, b.id));
  const groups: { anchor: Point; axis: Point; intervals: { start: number; end: number; id: string }[] }[] = [];
  for (const segment of segments) {
    const direction = subtract(segment.b, segment.a);
    let group = groups.find(group => {
      const perpendicular = (point: Point) => {
        const delta = subtract(point, group.anchor);
        return Math.abs(delta.x * group.axis.y - delta.y * group.axis.x);
      };
      // Anchors never drift: near-collinear chains cannot gradually swallow another wall.
      const angularError = Math.abs(direction.x * group.axis.y - direction.y * group.axis.x) / segment.length;
      return angularError <= 1e-5 && perpendicular(segment.a) <= tolerance && perpendicular(segment.b) <= tolerance;
    });
    if (!group) {
      group = { anchor: segment.a, axis: { x: direction.x / segment.length, y: direction.y / segment.length }, intervals: [] };
      groups.push(group);
    }
    const a = dot(subtract(segment.a, group.anchor), group.axis);
    const b = dot(subtract(segment.b, group.anchor), group.axis);
    group.intervals.push({ start: Math.min(a, b), end: Math.max(a, b), id: segment.id });
  }
  const result: DerivedWall[] = [];
  for (const group of groups) {
    const intervals = group.intervals.sort((a, b) => a.start - b.start || a.end - b.end || compare(a.id, b.id));
    let start = intervals[0].start, end = intervals[0].end, ids = [intervals[0].id];
    const emit = () => {
      const evidenceIds = [...ids].sort(compare);
      result.push({ id: `wall:${JSON.stringify(evidenceIds)}`, evidenceIds,
        a: { x: group.anchor.x + group.axis.x * start, y: group.anchor.y + group.axis.y * start },
        b: { x: group.anchor.x + group.axis.x * end, y: group.anchor.y + group.axis.y * end },
        thickness: 0.16, thicknessSource: "provisional" });
    };
    for (const interval of intervals.slice(1)) {
      if (interval.start - end <= gapTolerance + 1e-10) { end = Math.max(end, interval.end); ids.push(interval.id); }
      else { emit(); start = interval.start; end = interval.end; ids = [interval.id]; }
    }
    emit();
  }
  const walls = confirmed && options.pairParallelEdges ? pairEdges(result) : result;
  return walls.sort((a, b) => compare(a.id, b.id));
}

/** Optional conservative heuristic, never a measurement confirmation. */
function pairEdges(walls: DerivedWall[]): DerivedWall[] {
  const candidates: { index: number; distance: number }[][] = walls.map(() => []);
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j];
    const da = subtract(a.b, a.a), db = subtract(b.b, b.a);
    const la = Math.hypot(da.x, da.y), lb = Math.hypot(db.x, db.y);
    if (Math.min(la, lb) <= 2) continue;
    const axis = { x: da.x / la, y: da.y / la };
    if (Math.abs(axis.x * db.y - axis.y * db.x) / lb > 1e-5) continue;
    const offset = subtract(b.a, a.a);
    const start = dot(offset, axis), end = start + dot(db, axis);
    const overlap = Math.max(0, Math.min(la, Math.max(start, end)) - Math.max(0, Math.min(start, end)));
    if (overlap / Math.max(la, lb) < 0.95) continue;
    // Matching ends avoid absorbing shorter independent parallel sections.
    if (Math.abs(Math.min(start, end)) > 0.02 || Math.abs(Math.max(start, end) - la) > 0.02) continue;
    const distance = Math.abs(offset.x * axis.y - offset.y * axis.x);
    // Include sub-thickness nearby lines in ambiguity detection as well.
    if (distance > 1e-3 && distance <= 0.4) {
      candidates[i].push({ index: j, distance }); candidates[j].push({ index: i, distance });
    }
  }
  const consumed = new Set<number>(), output: DerivedWall[] = [];
  walls.forEach((wall, i) => {
    if (consumed.has(i)) return;
    const candidate = candidates[i][0];
    // Requiring a unique mutual neighbor also rejects triple edges and any line between.
    if (candidates[i].length !== 1 || candidate.distance < 0.08 || candidates[candidate.index].length !== 1 || candidates[candidate.index][0].index !== i) {
      output.push(wall); return;
    }
    const other = walls[candidate.index];
    const delta = subtract(wall.b, wall.a), length = Math.hypot(delta.x, delta.y);
    const axis = { x: delta.x / length, y: delta.y / length };
    const signedOffset = (p: Point) => { const v = subtract(p, wall.a); return v.x * axis.y - v.y * axis.x; };
    const edgeOffset = signedOffset(other.a);
    const blocked = walls.some((third, k) => {
      if (k === i || k === candidate.index) return false;
      const offsets = [signedOffset(third.a), signedOffset(third.b)];
      if (!offsets.every(offset => offset * edgeOffset > 0 && Math.abs(offset) < Math.abs(edgeOffset))) return false;
      const projections = [dot(subtract(third.a, wall.a), axis), dot(subtract(third.b, wall.a), axis)];
      return Math.min(length, Math.max(...projections)) - Math.max(0, Math.min(...projections)) > 0.001;
    });
    if (blocked) { output.push(wall); return; }
    const sameDirection = dot(subtract(wall.b, wall.a), subtract(other.b, other.a)) >= 0;
    const a = sameDirection ? other.a : other.b, b = sameDirection ? other.b : other.a;
    const evidenceIds = [...wall.evidenceIds, ...other.evidenceIds].sort(compare);
    output.push({ id: `wall:${JSON.stringify(evidenceIds)}`, evidenceIds,
      a: { x: (wall.a.x + a.x) / 2, y: (wall.a.y + a.y) / 2 },
      b: { x: (wall.b.x + b.x) / 2, y: (wall.b.y + b.y) / 2 },
      thickness: candidate.distance, thicknessSource: "inferred-parallel-edges" });
    consumed.add(candidate.index); consumed.add(i);
  });
  return output;
}
