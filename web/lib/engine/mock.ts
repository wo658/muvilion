/** Deterministic layout and rectangle-validation mock for local tests. */
import type { Engine } from "./client";
import {
  LayoutRequest,
  LayoutResponse,
  ValidateRequest,
  ValidateResponse,
  type Booth,
  type BoothSpec,
  type LayoutRequestInput,
  type ValidateRequestInput,
  type LayoutConstraints,
  type Rect,
  type Venue,
  type Violation,
} from "./contract";
import {
  boothRect,
  center,
  dist,
  distanceToNearestEntrance,
  doorClearanceRect,
  hashString,
  polygonBBox,
  rectGap,
  inPopularZone,
  rectsOverlap,
  round,
} from "@/lib/geometry";

// ---------- layout ----------

/** Footprints booths may not overlap: obstacles, unbuildable zones, door clearances and keep-outs. */
function blockedRects(venue: Venue, c: LayoutConstraints): Rect[] {
  const out: Rect[] = venue.obstacles.map((o) => polygonBBox(o.polygon));
  for (const z of venue.zones) if (!z.buildable) out.push(polygonBBox(z.polygon));
  for (const d of venue.doors) {
    const r = doorClearanceRect(d, venue, c.door_clearance, c.min_aisle_width / 2);
    if (r) out.push(r);
  }
  out.push(...c.keep_out);
  return out;
}

type Size = { w: number; h: number };
const sizeKey = (s: Size) => `${s.w}x${s.h}`;

/** Back-to-back booth rows for one footprint size, separated by aisles of `min_aisle_width`. */
function candidateSlots(venue: Venue, size: Size, c: LayoutConstraints, blocked: Rect[]): Rect[] {
  const { w: cw, h: ch } = size;
  const m = c.wall_margin;
  const aisle = c.min_aisle_width;
  const slots: Rect[] = [];
  for (let y0 = m; y0 + ch <= venue.height - m + 1e-9; y0 += 2 * ch + aisle) {
    for (const y of [y0, y0 + ch]) {
      if (y + ch > venue.height - m + 1e-9) continue;
      for (let x = m; x + cw <= venue.width - m + 1e-9; x += cw + aisle) {
        slots.push({ x: round(x, 3), y: round(y, 3), w: cw, h: ch });
      }
    }
  }
  return slots.filter((s) => !blocked.some((b) => rectsOverlap(s, b)));
}

/** A slot stays usable next to `r` if it touches it back to back or leaves at least one aisle. */
function compatible(s: Rect, r: Rect, aisle: number): boolean {
  if (rectsOverlap(s, r)) return false;
  const gap = rectGap(s, r);
  return gap <= 1e-6 || gap >= aisle - 1e-6;
}

export function mockLayout(input: LayoutRequestInput): LayoutResponse {
  const req = LayoutRequest.parse(input);
  const warm = greedyLayout(req);
  if (warm.status !== "infeasible" || !req.previous) return warm;
  // A solver would still find a layout where the warm-start greedy fill gets stuck; retry cold
  // and keep reporting the displacement from `previous`.
  const cold = greedyLayout({ ...req, previous: null });
  if (cold.status === "infeasible") return warm;
  const prev = new Map(req.previous.booths.map((b) => [b.id, b]));
  const moved = cold.layout.booths.reduce((s, b) => s + (prev.has(b.id) ? dist(b, prev.get(b.id)!) : 0), 0);
  return LayoutResponse.parse({ ...cold, objective: round(moved, 3), solve_time_s: 0.02 });
}

function greedyLayout(req: LayoutRequest): LayoutResponse {
  const { venue, booths: specs, constraints: c, previous } = req;
  const prevById = new Map((previous?.booths ?? []).map((b) => [b.id, b]));
  const blocked = blockedRects(venue, c);
  // One slot grid per distinct footprint (food trucks, tents, kiosks…); placing a booth removes
  // every slot of every grid that would overlap it or leave less than an aisle.
  const free = new Map<string, Rect[]>();
  for (const s of specs) {
    const k = sizeKey(s);
    if (!free.has(k)) free.set(k, candidateSlots(venue, s, c, blocked));
  }
  const take = (r: Rect) => {
    for (const [k, list] of free) free.set(k, list.filter((s) => compatible(s, r, c.min_aisle_width)));
  };
  const placed: Booth[] = [];
  let displacement = 0;

  // 1) pinned booths go exactly where they were pinned.
  for (const spec of specs) {
    const p = c.fixed[spec.id];
    if (!p) continue;
    const r = { x: p.x, y: p.y, w: spec.w, h: spec.h };
    placed.push({ id: spec.id, ...r, rotation: 0 });
    take(r);
  }

  const isPopular = (s: BoothSpec) => c.popular_door_distance > 0 && s.popularity >= c.popular_threshold;
  const rest = specs.filter((s) => !c.fixed[s.id]);
  // 2) constrained popular booths first (most popular first), then the rest in input order;
  //    within each group larger footprints go first so they still find room.
  const bySize = (a: BoothSpec, b: BoothSpec) => b.w * b.h - a.w * a.h;
  const order = [
    ...rest.filter(isPopular).sort((a, b) => b.popularity - a.popularity || bySize(a, b)),
    ...rest.filter((s) => !isPopular(s)).sort(bySize),
  ];
  const entranceDist = (r: Rect) => distanceToNearestEntrance(r, venue);
  let unplaced = 0;
  for (const spec of order) {
    const eligible = (free.get(sizeKey(spec)) ?? []).filter(
      (s) => !isPopular(spec) || !inPopularZone(s, venue, c.popular_door_distance),
    );
    if (eligible.length === 0) {
      unplaced++;
      continue;
    }
    const prev = prevById.get(spec.id);
    const base = prev
      ? (s: Rect) => dist(s, prev)
      : // Fresh layout: fill from the entrance outward (a typical "first draft").
        (s: Rect) => entranceDist(s) + s.x * 1e-3;
    // Constrained popular booths also spread out from each other (a solver would
    // do this through its objective); unconstrained drafts do not.
    const others: Rect[] = isPopular(spec)
      ? specs
          .filter((o) => o.id !== spec.id && o.popularity >= c.popular_threshold)
          .map((o) => placed.find((b) => b.id === o.id) ?? prevById.get(o.id))
          .filter((r): r is Booth => Boolean(r))
      : [];
    const score = (s: Rect) => base(s) + others.reduce((acc, o) => acc + 10 * Math.exp(-dist(s, o) / 6), 0);
    let best = eligible[0];
    for (const s of eligible) if (score(s) < score(best) - 1e-9) best = s;
    if (prev) displacement += dist(best, prev);
    placed.push({ id: spec.id, x: best.x, y: best.y, w: spec.w, h: spec.h, rotation: 0 });
    take(best);
  }

  placed.sort((a, b) => a.id.localeCompare(b.id));
  const layoutId = `L-${hashString(JSON.stringify(placed.map((b) => [b.id, b.x, b.y])))}`;
  const objective = round(displacement, 3);
  const solveTime = previous ? 0.01 : 0.4;
  return LayoutResponse.parse({
    layout: { id: layoutId, venue_id: venue.id, booths: placed },
    status: unplaced > 0 ? "infeasible" : "feasible",
    objective,
    solve_time_s: solveTime,
  });
}

// ---------- validate ----------

export function mockValidate(input: ValidateRequestInput): ValidateResponse {
  const { venue, layout, constraints: c } = ValidateRequest.parse(input);
  const v: Violation[] = [];
  const add = (rule_id: string, message: string, booth_ids: string[], r?: Rect, severity: "error" | "warning" = "error", source = "internal:geometry") =>
    v.push({ rule_id, severity, message, booth_ids, location: r ? center(r) : null, source });
  const site = venue.setting === "outdoor" ? "site" : "hall";
  const wall = venue.setting === "outdoor" ? "fence" : "wall";
  const m = c.wall_margin;
  const rects = layout.booths.map((b) => ({ b, r: boothRect(b) }));
  for (const { b, r } of rects) {
    const outside = r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > venue.width + 1e-6 || r.y + r.h > venue.height + 1e-6;
    if (outside) add("booth_outside_hall", `${b.id} extends outside the ${site}`, [b.id], r);
    else if (r.x < m - 1e-6 || r.y < m - 1e-6 || r.x + r.w > venue.width - m + 1e-6 || r.y + r.h > venue.height - m + 1e-6)
      add("wall_margin", `${b.id} is closer than ${m} m to the ${wall}`, [b.id], r, "warning");
    for (const o of venue.obstacles)
      if (rectsOverlap(r, polygonBBox(o.polygon))) add("booth_over_obstacle", `${b.id} overlaps ${o.kind} ${o.id}`, [b.id], r);
    for (const z of venue.zones) {
      if (z.buildable || !rectsOverlap(r, polygonBBox(z.polygon))) continue;
      const src = `venue:zones/${z.id}`;
      add("zone_unbuildable", `${b.id} is on unbuildable ${z.kind.replace(/_/g, " ")} ${z.id}`, [b.id], r, "error", src);
      if (z.kind === "fire_lane") add("fire_lane_blocked", `${b.id} blocks fire lane ${z.id}`, [b.id], r, "error", src);
    }
    for (const d of venue.doors) {
      const z = doorClearanceRect(d, venue, c.door_clearance, c.min_aisle_width / 2);
      if (z && rectsOverlap(r, z)) add("door_clearance", `${b.id} blocks the ${c.door_clearance} m clearance of door ${d.id}`, [b.id], r);
    }
    c.keep_out.forEach((k, i) => {
      if (rectsOverlap(r, k)) add("keep_out", `${b.id} overlaps keep-out area #${i + 1}`, [b.id], r);
    });
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (rectsOverlap(a.r, b.r)) {
        add("booth_overlap", `${a.b.id} overlaps ${b.b.id}`, [a.b.id, b.b.id], a.r);
        continue;
      }
      const gap = rectGap(a.r, b.r);
      if (gap > 1e-6 && gap < c.min_aisle_width - 1e-6)
        add("aisle_width", `Aisle between ${a.b.id} and ${b.b.id} is ${round(gap)} m (< ${c.min_aisle_width} m)`, [a.b.id, b.b.id], a.r);
    }
  }
  return ValidateResponse.parse({ ok: v.every((x) => x.severity !== "error"), violations: v });
}

export function createMockEngine(): Engine {
  return {
    kind: "mock",
    health: async () => ({ status: "ok (mock)" }),
    layout: async (req) => mockLayout(req),
    validate: async (req) => mockValidate(req),
  };
}
