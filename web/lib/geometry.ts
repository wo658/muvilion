/** Small geometry helpers in hall coordinates (meters, origin bottom-left, y up). */
import type { Booth, Door, Point, Rect, Venue } from "@/lib/engine/contract";

export function rectsOverlap(a: Rect, b: Rect, eps = 1e-6): boolean {
  return a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
}

export function rectContainsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function polygonBBox(poly: Point[]): Rect {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(Math.max(...xs) - x, 1e-6), h: Math.max(Math.max(...ys) - y, 1e-6) };
}

/** Floor footprint size: rotation 90 swaps the spec's w and h (engine geometry.footprint_size). */
export function footprint(b: Pick<Booth, "w" | "h"> & { rotation?: 0 | 90 }): { w: number; h: number } {
  return b.rotation === 90 ? { w: b.h, h: b.w } : { w: b.w, h: b.h };
}

export function boothRect(b: Pick<Booth, "x" | "y" | "w" | "h"> & { rotation?: 0 | 90 }): Rect {
  return { x: b.x, y: b.y, ...footprint(b) };
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function doorMid(d: Door): Point {
  return { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
}

/** Gap between two rects (0 when touching or overlapping). */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

/** Distance from a point to the nearest point of a rect (0 if inside). */
export function pointRectDistance(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * The clearance zone in front of a door: a rect extending `depth` meters into the
 * hall from the door segment (doors lie on the hall boundary), widened by
 * `sidePad` on both ends (engine uses min_aisle_width / 2).
 */
export function doorClearanceRect(
  d: Door,
  venue: Pick<Venue, "width" | "height">,
  depth: number,
  sidePad = 0,
): Rect | null {
  if (depth <= 0) return null;
  const r = doorClearanceRectRaw(d, venue, depth);
  if (!r || sidePad <= 0) return r;
  const horizontal = Math.abs(d.a.y - d.b.y) < 1e-6;
  const x = horizontal ? Math.max(0, r.x - sidePad) : r.x;
  const y = horizontal ? r.y : Math.max(0, r.y - sidePad);
  const x2 = horizontal ? Math.min(venue.width, r.x + r.w + sidePad) : r.x + r.w;
  const y2 = horizontal ? r.y + r.h : Math.min(venue.height, r.y + r.h + sidePad);
  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * Zone popular booths must stay out of: the entrance segment buffered by `d`
 * with square caps (engine layout/solver.py `_popular_areas`), clipped to the hall.
 */
export function popularZoneRect(d: Door, venue: Pick<Venue, "width" | "height">, dist: number): Rect | null {
  if (dist <= 0) return null;
  const x = Math.max(0, Math.min(d.a.x, d.b.x) - dist);
  const y = Math.max(0, Math.min(d.a.y, d.b.y) - dist);
  const x2 = Math.min(venue.width, Math.max(d.a.x, d.b.x) + dist);
  const y2 = Math.min(venue.height, Math.max(d.a.y, d.b.y) + dist);
  return { x, y, w: Math.max(x2 - x, 1e-6), h: Math.max(y2 - y, 1e-6) };
}

function doorClearanceRectRaw(d: Door, venue: Pick<Venue, "width" | "height">, depth: number): Rect | null {
  const minX = Math.min(d.a.x, d.b.x);
  const maxX = Math.max(d.a.x, d.b.x);
  const minY = Math.min(d.a.y, d.b.y);
  const maxY = Math.max(d.a.y, d.b.y);
  const eps = 1e-6;
  if (Math.abs(minY) < eps && Math.abs(maxY) < eps) return { x: minX, y: 0, w: Math.max(maxX - minX, eps), h: depth };
  if (Math.abs(minY - venue.height) < eps && Math.abs(maxY - venue.height) < eps)
    return { x: minX, y: venue.height - depth, w: Math.max(maxX - minX, eps), h: depth };
  if (Math.abs(minX) < eps && Math.abs(maxX) < eps) return { x: 0, y: minY, w: depth, h: Math.max(maxY - minY, eps) };
  if (Math.abs(minX - venue.width) < eps && Math.abs(maxX - venue.width) < eps)
    return { x: venue.width - depth, y: minY, w: depth, h: Math.max(maxY - minY, eps) };
  // Door not on the boundary: square around its midpoint.
  const m = doorMid(d);
  return { x: m.x - depth / 2, y: m.y - depth / 2, w: depth, h: depth };
}

export function entrances(venue: Venue): Door[] {
  const e = venue.doors.filter((d) => d.kind === "entrance");
  return e.length > 0 ? e : venue.doors;
}

/** Distance from a rect to the nearest entrance midpoint. */
export function distanceToNearestEntrance(r: Rect, venue: Venue): number {
  return Math.min(...entrances(venue).map((d) => pointRectDistance(doorMid(d), r)));
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Deterministic 32-bit PRNG (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable FNV-1a hash of a string, hex. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** True if a booth rect overlaps any entrance's popular-distance zone. */
export function inPopularZone(r: Rect, venue: Venue, dist: number): boolean {
  return entrances(venue).some((d) => {
    const z = popularZoneRect(d, venue, dist);
    return z !== null && rectsOverlap(r, z);
  });
}
