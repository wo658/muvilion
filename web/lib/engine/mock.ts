/**
 * Deterministic mock engine (ENGINE_MOCK=1) so the whole agent loop is demoable
 * without the Python engine. It is NOT a pedestrian model; it only has to react
 * plausibly to the knobs the agent turns:
 *
 * - /layout: back-to-back booth rows on a grid whose aisle = min_aisle_width.
 *   Honors wall_margin, door_clearance, obstacles, keep_out, fixed and
 *   popular_door_distance; with `previous` each booth takes the free slot nearest
 *   its old position (minimal displacement).
 * - /validate: plain rectangle checks using the engine's rule ids (wall_margin is a
 *   warning; reachability rules — connectivity, entrance_blocked, booth_unreachable,
 *   door_unreachable — are not modeled).
 * - /simulate: a synthetic peak-density field = entrance inflow + crowding around
 *   booths weighted by popularity and amplified near entrances. The hotspot
 *   therefore sits near the entrance and shrinks when popular booths move away.
 *   Same inputs (incl. scenario seed) → identical output.
 *
 * - /trajectories: see ./mock-trajectories.ts (aisle-following walkers consistent with the
 *   layout and this density field).
 *
 * All outputs are parsed through the contract schemas, like the HTTP client.
 */
import type { Engine } from "./client";
import { mockTrajectories } from "./mock-trajectories";
import {
  LayoutRequest,
  LayoutResponse,
  QueueRequest,
  QueueResult,
  SimResult,
  SimulateRequest,
  ValidateRequest,
  ValidateResponse,
  type Booth,
  type BoothSpec,
  type LayoutRequestInput,
  type QueueRequestInput,
  type SimulateRequestInput,
  type ValidateRequestInput,
  type Hotspot,
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
  doorMid,
  entrances,
  hashString,
  pointRectDistance,
  polygonBBox,
  prng,
  rectContainsPoint,
  rectGap,
  inPopularZone,
  rectsOverlap,
  round,
} from "@/lib/geometry";

// ---------- layout ----------

function blockedRects(venue: Venue, c: LayoutConstraints): Rect[] {
  const out: Rect[] = venue.obstacles.map((o) => polygonBBox(o.polygon));
  for (const d of venue.doors) {
    const r = doorClearanceRect(d, venue, c.door_clearance, c.min_aisle_width / 2);
    if (r) out.push(r);
  }
  out.push(...c.keep_out);
  return out;
}

function candidateSlots(venue: Venue, specs: BoothSpec[], c: LayoutConstraints): Rect[] {
  const cw = Math.max(...specs.map((b) => b.w));
  const ch = Math.max(...specs.map((b) => b.h));
  const m = c.wall_margin;
  const aisle = c.min_aisle_width;
  const slots: Rect[] = [];
  // Rows come in back-to-back pairs separated by an aisle.
  for (let y0 = m; y0 + ch <= venue.height - m + 1e-9; y0 += 2 * ch + aisle) {
    for (const y of [y0, y0 + ch]) {
      if (y + ch > venue.height - m + 1e-9) continue;
      for (let x = m; x + cw <= venue.width - m + 1e-9; x += cw + aisle) {
        slots.push({ x: round(x, 3), y: round(y, 3), w: cw, h: ch });
      }
    }
  }
  const blocked = blockedRects(venue, c);
  return slots.filter((s) => !blocked.some((b) => rectsOverlap(s, b)));
}

export function mockLayout(input: LayoutRequestInput): LayoutResponse {
  const req = LayoutRequest.parse(input);
  const { venue, booths: specs, constraints: c, previous } = req;
  const prevById = new Map((previous?.booths ?? []).map((b) => [b.id, b]));
  let free = candidateSlots(venue, specs, c);
  const placed: Booth[] = [];
  let displacement = 0;

  // 1) pinned booths go exactly where they were pinned.
  for (const spec of specs) {
    const p = c.fixed[spec.id];
    if (!p) continue;
    const r = { x: p.x, y: p.y, w: spec.w, h: spec.h };
    placed.push({ id: spec.id, ...r, rotation: 0 });
    free = free.filter((s) => !rectsOverlap(s, r));
  }

  const isPopular = (s: BoothSpec) => c.popular_door_distance > 0 && s.popularity >= c.popular_threshold;
  const rest = specs.filter((s) => !c.fixed[s.id]);
  // 2) constrained popular booths first (most popular first), then the rest in input order.
  const order = [
    ...rest.filter(isPopular).sort((a, b) => b.popularity - a.popularity),
    ...rest.filter((s) => !isPopular(s)),
  ];
  const entranceDist = (r: Rect) => distanceToNearestEntrance(r, venue);
  let unplaced = 0;
  for (const spec of order) {
    const eligible = free.filter(
      (s) => s.w >= spec.w && s.h >= spec.h && (!isPopular(spec) || !inPopularZone(s, venue, c.popular_door_distance)),
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
    free = free.filter((s) => s !== best);
  }

  placed.sort((a, b) => a.id.localeCompare(b.id));
  const layoutId = `L-${hashString(JSON.stringify(placed.map((b) => [b.id, b.x, b.y])))}`;
  return LayoutResponse.parse({
    layout: { id: layoutId, venue_id: venue.id, booths: placed },
    status: unplaced > 0 ? "infeasible" : "feasible",
    objective: round(displacement, 3),
    solve_time_s: 0.01,
  });
}

// ---------- validate ----------

export function mockValidate(input: ValidateRequestInput): ValidateResponse {
  const { venue, layout, constraints: c } = ValidateRequest.parse(input);
  const v: Violation[] = [];
  const add = (rule_id: string, message: string, booth_ids: string[], r?: Rect, severity: "error" | "warning" = "error") =>
    v.push({ rule_id, severity, message, booth_ids, location: r ? center(r) : null, source: "internal:geometry" });
  const m = c.wall_margin;
  const rects = layout.booths.map((b) => ({ b, r: boothRect(b) }));
  for (const { b, r } of rects) {
    const outside = r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > venue.width + 1e-6 || r.y + r.h > venue.height + 1e-6;
    if (outside) add("booth_outside_hall", `${b.id} extends outside the hall`, [b.id], r);
    else if (r.x < m - 1e-6 || r.y < m - 1e-6 || r.x + r.w > venue.width - m + 1e-6 || r.y + r.h > venue.height - m + 1e-6)
      add("wall_margin", `${b.id} is closer than ${m} m to a wall`, [b.id], r, "warning");
    for (const o of venue.obstacles)
      if (rectsOverlap(r, polygonBBox(o.polygon))) add("booth_over_obstacle", `${b.id} overlaps ${o.kind} ${o.id}`, [b.id], r);
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

// ---------- simulate ----------

const HOTSPOT_THRESHOLD = 2.0; // p/m^2
// Booth crowd = popularity^3 * GAIN, amplified up to (1 + AMP) next to an entrance, decaying over DECAY m.
const GAIN = 1.6;
const AMP = 3;
const DECAY = 6;

export function mockSimulate(input: SimulateRequestInput): SimResult {
  const req = SimulateRequest.parse(input);
  const { venue, layout, booths: specs, scenario, grid_cell: cell } = req;
  const cols = Math.ceil(venue.width / cell);
  const rows = Math.ceil(venue.height / cell);
  const rand = prng(scenario.seed * 7919 + 17);
  const scale = scenario.agents / 200;
  const kindGain = scenario.kind === "entry" ? 1.25 : scenario.kind === "exit" ? 1.1 : 1.0;
  const ents = entrances(venue).map(doorMid);
  const pop = new Map(specs.map((s) => [s.id, s.popularity]));
  const boothRects = layout.booths.map((b) => ({ id: b.id, r: boothRect(b), p: pop.get(b.id) ?? 0.5 }));
  const solid = [...boothRects.map((b) => b.r), ...venue.obstacles.map((o) => polygonBBox(o.polygon))];
  const boothGain = boothRects.map(({ r, p }) => {
    const dE = distanceToNearestEntrance(r, venue);
    return p ** 3 * GAIN * (1 + AMP * Math.exp(-dE / DECAY));
  });

  const peak: number[] = new Array(cols * rows).fill(0);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = { x: (i + 0.5) * cell, y: (j + 0.5) * cell };
      const noise = (rand() - 0.5) * 0.08;
      if (p.x > venue.width || p.y > venue.height || solid.some((r) => rectContainsPoint(r, p))) continue;
      let d = 0;
      for (const e of ents) d += 1.1 * Math.exp(-dist(p, e) / 5);
      boothRects.forEach(({ r }, k) => {
        const g = pointRectDistance(p, r);
        d += boothGain[k] * Math.exp(-(g * g) / (2 * 1.4 * 1.4));
      });
      peak[j * cols + i] = round(Math.max(0, d * scale * kindGain + noise), 3);
    }
  }

  const hotspots = findHotspots(peak, cols, rows, cell, layout.booths);
  const maxDensity = Math.max(0, ...peak);
  const weighted = boothRects.reduce((s, b) => s + b.p * distanceToNearestEntrance(b.r, venue), 0);
  const wsum = boothRects.reduce((s, b) => s + b.p, 0) || 1;
  const congestion = peak.reduce((s, x) => s + Math.max(0, x - 1.2) ** 2, 0);
  const mean = 45 + (weighted / wsum / 1.1) * 2 + congestion * 1.5;
  const p90 = mean * 1.35 + Math.max(0, maxDensity - 2) * 12;
  const overload = peak.reduce((s, x) => s + Math.max(0, x - 3), 0);
  const completed = Math.min(1, Math.max(0.5, 1 - overload * 0.02));

  return SimResult.parse({
    run_id: `S-${hashString(JSON.stringify([layout.id, scenario, cell]))}`,
    scenario,
    layout_id: layout.id,
    completed_fraction: round(completed, 3),
    mean_travel_time_s: round(mean, 1),
    p90_travel_time_s: round(p90, 1),
    max_density: round(maxDensity, 3),
    hotspots,
    grid: { cell, cols, rows, peak },
    sim_time_s: scenario.duration_s,
    wall_time_s: 0.05,
    truncated: false,
  });
}

function findHotspots(peak: number[], cols: number, rows: number, cell: number, booths: Booth[]): Hotspot[] {
  const seen = new Uint8Array(peak.length);
  const out: Hotspot[] = [];
  for (let start = 0; start < peak.length; start++) {
    if (seen[start] || peak[start] < HOTSPOT_THRESHOLD) continue;
    const stack = [start];
    seen[start] = 1;
    const cells: number[] = [];
    while (stack.length) {
      const k = stack.pop()!;
      cells.push(k);
      const i = k % cols;
      const j = Math.floor(k / cols);
      const nb = [
        [i - 1, j],
        [i + 1, j],
        [i, j - 1],
        [i, j + 1],
      ];
      for (const [a, b] of nb) {
        if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
        const n = b * cols + a;
        if (!seen[n] && peak[n] >= HOTSPOT_THRESHOLD) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    const is = cells.map((k) => k % cols);
    const js = cells.map((k) => Math.floor(k / cols));
    const zone = {
      x: Math.min(...is) * cell,
      y: Math.min(...js) * cell,
      w: (Math.max(...is) - Math.min(...is) + 1) * cell,
      h: (Math.max(...js) - Math.min(...js) + 1) * cell,
    };
    const vals = cells.map((k) => peak[k]);
    out.push({
      zone,
      peak_density: round(Math.max(...vals), 3),
      mean_density: round(vals.reduce((s, x) => s + x, 0) / vals.length, 3),
      nearby_booth_ids: booths.filter((b) => rectGap(boothRect(b), zone) <= cell + 1e-6).map((b) => b.id),
    });
  }
  return out.sort((a, b) => b.peak_density - a.peak_density).slice(0, 5);
}

// ---------- queue ----------

export function mockQueue(input: QueueRequestInput): QueueResult {
  const q = QueueRequest.parse(input);
  const lambda = q.arrivals_per_min / 60;
  const rho = (lambda * q.service_time_s) / q.servers;
  // Sakasegawa approximation for M/M/c waiting time.
  const wq = rho < 1 ? (rho ** (Math.sqrt(2 * (q.servers + 1)) - 1) / (q.servers * (1 - rho))) * q.service_time_s : q.duration_min * 30;
  return QueueResult.parse({
    mean_wait_s: round(wq, 1),
    p90_wait_s: round(wq * 2.3, 1),
    max_queue_len: Math.ceil(lambda * wq * 2),
    utilization: round(Math.min(rho, 1), 3),
  });
}

export function createMockEngine(): Engine {
  return {
    kind: "mock",
    health: async () => ({ status: "ok (mock)" }),
    layout: async (req) => mockLayout(req),
    validate: async (req) => mockValidate(req),
    simulate: async (req) => mockSimulate(req),
    trajectories: async (req) => mockTrajectories(req),
    queue: async (req) => mockQueue(req),
  };
}
