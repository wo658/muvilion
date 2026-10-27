/**
 * Deterministic mock of POST /trajectories (ENGINE_MOCK=1). Like the rest of the mock it is
 * NOT a pedestrian model — no agent–agent interaction — but it is consistent with the mock
 * layout and density field so the 3D replay tells the same story as the heatmap:
 *
 * - navigation on a 0.5 m occupancy grid; booths and obstacles are inflated by AGENT_CLEARANCE,
 *   paths come from Dijkstra distance fields (8-connected, no corner cutting) and are
 *   string-pulled with a line-of-sight check, so agents walk along aisles and never cross a booth;
 * - entry/browse: agents arrive through entrance doors (ramped arrivals), visit 2–5 booths chosen
 *   by popularity (first picks biased toward booths near the entrance), dwell longer at popular
 *   booths on the side where the mock density field is highest, and leave via an exit door
 *   (sometimes back through the entrance); walking speed drops in dense cells;
 * - exit: agents start spread over the booth fronts and head for the nearest door of any kind.
 *
 * Per-agent randomness is seeded by (scenario.seed, agent id) only, so the same agents arrive at
 * the same times in every iteration; only the layout changes what they do. run_id / layout_id are
 * the ones mockSimulate returns for the same request.
 */
import { SimulateRequest, Trajectories, type Door, type Rect, type SimulateRequestInput } from "./contract";
import { boothRect, pointRectDistance, polygonBBox, prng, round } from "@/lib/geometry";
import { mockSimulate } from "./mock";

const RES = 0.5; // nav grid resolution (m)
/** Free cells are at least this far (m) from any booth / obstacle footprint and walls. */
export const AGENT_CLEARANCE = 0.5;
const DWELL_BAND = 2.0; // dwell spots lie within this distance of a booth face

type Pt = { x: number; y: number };

class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
    solids: Rect[],
  ) {
    this.cols = Math.ceil(width / RES);
    this.rows = Math.ceil(height / RES);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const p = this.center(j * this.cols + i);
        const wall = Math.min(p.x, p.y, width - p.x, height - p.y);
        if (wall < AGENT_CLEARANCE * 0.8 || solids.some((r) => pointRectDistance(p, r) < AGENT_CLEARANCE))
          this.blocked[j * this.cols + i] = 1;
      }
    }
  }
  center(k: number): Pt {
    return { x: ((k % this.cols) + 0.5) * RES, y: (Math.floor(k / this.cols) + 0.5) * RES };
  }
  cellOf(p: Pt): number {
    const i = Math.min(this.cols - 1, Math.max(0, Math.floor(p.x / RES)));
    const j = Math.min(this.rows - 1, Math.max(0, Math.floor(p.y / RES)));
    return j * this.cols + i;
  }
  free(p: Pt): boolean {
    if (p.x < 0 || p.y < 0 || p.x > this.width || p.y > this.height) return false;
    return !this.blocked[this.cellOf(p)];
  }
  /** Nearest free cell to p (BFS outward). */
  nearestFree(p: Pt): number {
    const start = this.cellOf(p);
    if (!this.blocked[start]) return start;
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < this.blocked.length; k++) {
      if (this.blocked[k]) continue;
      const c = this.center(k);
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }
  lineOfSight(a: Pt, b: Pt): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / (RES / 4)));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      if (!this.free({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  }
  /** Dijkstra distance field (meters) from a set of goal cells. */
  field(goals: number[]): Float64Array {
    const dist = new Float64Array(this.blocked.length).fill(Infinity);
    const heap = new MinHeap();
    for (const g of goals) {
      if (this.blocked[g]) continue;
      dist[g] = 0;
      heap.push(g, 0);
    }
    const { cols, rows } = this;
    while (heap.size) {
      const [k, d] = heap.pop();
      if (d > dist[k]) continue;
      const i = k % cols;
      const j = (k - i) / cols;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
          const n = b * cols + a;
          if (this.blocked[n]) continue;
          // no corner cutting
          if (di && dj && (this.blocked[j * cols + a] || this.blocked[b * cols + i])) continue;
          const nd = d + (di && dj ? Math.SQRT2 : 1) * RES;
          if (nd < dist[n]) {
            dist[n] = nd;
            heap.push(n, nd);
          }
        }
      }
    }
    return dist;
  }
  /** Descend a distance field from `from` to its goal; returns cell-center waypoints. */
  descend(field: Float64Array, from: number): Pt[] {
    const out: Pt[] = [];
    let k = from;
    const { cols, rows } = this;
    for (let guard = 0; guard < this.blocked.length && field[k] > 0; guard++) {
      out.push(this.center(k));
      const i = k % cols;
      const j = (k - i) / cols;
      let best = k;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
          const n = b * cols + a;
          if (di && dj && (this.blocked[j * cols + a] || this.blocked[b * cols + i])) continue;
          if (field[n] < field[best]) best = n;
        }
      if (best === k) break;
      k = best;
    }
    out.push(this.center(k));
    return out;
  }
  /** Shortest path from a down the field (ending at b when visible), string-pulled. */
  path(field: Float64Array, a: Pt, b?: Pt): Pt[] {
    const raw = [a, ...this.descend(field, this.free(a) ? this.cellOf(a) : this.nearestFree(a))];
    // the requested end point is only used when it is visible from where the descent stopped
    if (b && this.free(b) && this.lineOfSight(raw[raw.length - 1], b)) raw.push(b);
    const out: Pt[] = [raw[0]];
    let i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !this.lineOfSight(raw[i], raw[j])) j--;
      out.push(raw[j]);
      i = j;
    }
    return out;
  }
}

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const { k, v } = this;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p] <= val) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const { k, v } = this;
    const top: [number, number] = [k[0], v[0]];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let mv = lv;
        if (l < k.length && v[l] < mv) {
          m = l;
          mv = v[l];
        }
        if (r < k.length && v[r] < mv) m = r;
        if (m === i) break;
        k[i] = k[m];
        v[i] = v[m];
        i = m;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

type Side = { cells: number[]; weight: number };
type BoothNav = { id: string; rect: Rect; popularity: number; sides: Side[] };

function doorCells(nav: NavGrid, d: Door): number[] {
  const cells = new Set<number>();
  const len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
  const n = Math.max(2, Math.ceil(len / (RES / 2)));
  const inward = inwardNormal(d, nav.width, nav.height);
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    const p = { x: d.a.x + (d.b.x - d.a.x) * t + inward.x, y: d.a.y + (d.b.y - d.a.y) * t + inward.y };
    if (nav.free(p)) cells.add(nav.cellOf(p));
  }
  if (cells.size === 0) cells.add(nav.nearestFree({ x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 }));
  return [...cells];
}

/** Unit-ish vector (length = AGENT_CLEARANCE + 0.3 m) pointing into the hall from a boundary door. */
function inwardNormal(d: Door, W: number, H: number): Pt {
  const m = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
  const k = AGENT_CLEARANCE + 0.3;
  const dl = m.x;
  const dr = W - m.x;
  const db = m.y;
  const dt = H - m.y;
  const min = Math.min(dl, dr, db, dt);
  if (min === db) return { x: 0, y: k };
  if (min === dt) return { x: 0, y: -k };
  if (min === dl) return { x: k, y: 0 };
  return { x: -k, y: 0 };
}

type Leg = { kind: "walk"; pts: Pt[] } | { kind: "dwell"; at: Pt; seconds: number };

export function mockTrajectories(input: SimulateRequestInput): Trajectories {
  const req = SimulateRequest.parse(input);
  const sim = mockSimulate(req);
  const { venue, layout, booths: specs, scenario } = req;
  const dt = req.trajectory_dt;
  const frames = Math.floor(scenario.duration_s / dt + 1e-9) + 1;
  const W = venue.width;
  const H = venue.height;
  const pop = new Map(specs.map((s) => [s.id, s.popularity]));
  const boothRects = layout.booths.map((b) => ({ id: b.id, rect: boothRect(b), popularity: pop.get(b.id) ?? 0.5 }));
  const solids = [...boothRects.map((b) => b.rect), ...venue.obstacles.map((o) => polygonBBox(o.polygon))];
  const nav = new NavGrid(W, H, solids);

  const g = sim.grid;
  const density = (p: Pt) => {
    const i = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cell)));
    const j = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cell)));
    return g.peak[j * g.cols + i] ?? 0;
  };

  // ---- booth dwell bands: free cells in front of each face, weighted by the mock density ----
  const booths: BoothNav[] = boothRects.map(({ id, rect: r, popularity }) => {
    const faces: number[][] = [[], [], [], []]; // left, right, bottom, top
    for (let k = 0; k < nav.blocked.length; k++) {
      if (nav.blocked[k]) continue;
      const p = nav.center(k);
      const d = pointRectDistance(p, r);
      if (d > DWELL_BAND) continue;
      const inX = p.x >= r.x && p.x <= r.x + r.w;
      const inY = p.y >= r.y && p.y <= r.y + r.h;
      if (inY && p.x < r.x) faces[0].push(k);
      else if (inY && p.x > r.x + r.w) faces[1].push(k);
      else if (inX && p.y < r.y) faces[2].push(k);
      else if (inX && p.y > r.y + r.h) faces[3].push(k);
    }
    const sides = faces
      .filter((c) => c.length > 0)
      .map((cells) => ({ cells, weight: cells.reduce((s, k) => s + 0.1 + density(nav.center(k)) ** 3, 0) }));
    return { id, rect: r, popularity, sides };
  });
  const reachable = booths.filter((b) => b.sides.length > 0);

  const fieldCache = new Map<string, Float64Array>();
  const fieldFor = (key: string, goals: () => number[]) => {
    let f = fieldCache.get(key);
    if (!f) {
      f = nav.field(goals());
      fieldCache.set(key, f);
    }
    return f;
  };

  const ents = venue.doors.filter((d) => d.kind === "entrance");
  const entranceDoors = ents.length ? ents : venue.doors;
  const exitKind = venue.doors.filter((d) => d.kind === "exit");
  const exitDoors = exitKind.length ? exitKind : entranceDoors;
  const doorPoint = (d: Door, u: number): Pt => {
    const n = inwardNormal(d, W, H);
    const t = 0.15 + 0.7 * u;
    const p = { x: d.a.x + (d.b.x - d.a.x) * t + n.x, y: d.a.y + (d.b.y - d.a.y) * t + n.y };
    return nav.free(p) ? p : nav.center(nav.nearestFree(p));
  };
  const doorField = (doors: Door[], key: string) => fieldFor(key, () => doors.flatMap((d) => doorCells(nav, d)));
  const entranceMid = entranceDoors.map((d) => ({ x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 }));

  const pick = <T>(rand: () => number, items: T[], weight: (t: T) => number): T | undefined => {
    const ws = items.map(weight);
    const total = ws.reduce((s, w) => s + w, 0);
    if (!(total > 0)) return undefined;
    let r = rand() * total;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  const D = scenario.duration_s;
  const agents: Trajectories["agents"] = [];
  for (let id = 0; id < scenario.agents; id++) {
    const rand = prng((scenario.seed * 1_000_003 + id * 7_919 + 12_345) >>> 0);
    const speed = 1.0 + 0.45 * rand();
    const lane = (rand() - 0.5) * 0.7;
    const legs: Leg[] = [];
    let start: Pt;
    let arrival: number;

    if (scenario.kind === "exit") {
      arrival = rand() * 10;
      const b = pick(rand, reachable, (x) => 0.3 + x.popularity);
      const side = b && pick(rand, b.sides, (s) => s.cells.length);
      start = side ? nav.center(side.cells[Math.floor(rand() * side.cells.length)]) : doorPoint(entranceDoors[0], rand());
      // nearest door of any kind
      const f = doorField(venue.doors, "all-doors");
      legs.push({ kind: "walk", pts: nav.path(f, start) });
    } else {
      const window = scenario.kind === "entry" ? 0.55 * D : 0.3 * D;
      arrival = window * rand() ** 1.25;
      const door = entranceDoors[Math.floor(rand() * entranceDoors.length)];
      start = doorPoint(door, rand());
      const visits = scenario.kind === "browse" ? 3 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 3);
      let here = start;
      const seen = new Set<string>();
      for (let v = 0; v < visits; v++) {
        const cand = reachable.filter((b) => !seen.has(b.id));
        const near = (b: BoothNav) => {
          const ref = v === 0 ? entranceMid : [here];
          const d = Math.min(...ref.map((p) => pointRectDistance(p, b.rect)));
          return Math.exp(-d / (v === 0 ? 10 : 14));
        };
        const b = pick(rand, cand, (x) => (0.1 + x.popularity ** 3) * near(x));
        if (!b) break;
        seen.add(b.id);
        const si = b.sides.indexOf(pick(rand, b.sides, (s) => s.weight)!);
        const side = b.sides[si];
        const spot = pick(rand, side.cells, (k) => 0.1 + density(nav.center(k)) ** 3) ?? side.cells[0];
        const f = fieldFor(`${b.id}:${si}`, () => side.cells);
        const pts = nav.path(f, here, nav.center(spot));
        const at = pts[pts.length - 1];
        legs.push({ kind: "walk", pts });
        legs.push({ kind: "dwell", at, seconds: (5 + 35 * b.popularity ** 2) * (0.6 + 0.8 * rand()) });
        here = at;
      }
      const viaEntrance = rand() < 0.3;
      const doors = viaEntrance ? entranceDoors : exitDoors;
      const out = doors[Math.floor(rand() * doors.length)];
      const f = doorField([out], `door:${out.id}`);
      legs.push({ kind: "walk", pts: nav.path(f, here, doorPoint(out, rand())) });
    }

    const xy = simulateLegs(legs, start, Math.ceil(arrival / dt), frames, dt, speed, lane, rand, nav, density);
    if (xy.length >= 4) agents.push({ id, t0: Math.ceil(arrival / dt), xy });
  }

  return Trajectories.parse({ run_id: sim.run_id, layout_id: layout.id, dt, frames, agents });
}

/** Walk the legs frame by frame; returns flat xy (cm-rounded). */
function simulateLegs(
  legs: Leg[],
  start: Pt,
  t0: number,
  frames: number,
  dt: number,
  speed: number,
  lane: number,
  rand: () => number,
  nav: NavGrid,
  density: (p: Pt) => number,
): number[] {
  const xy: number[] = [];
  let f = t0;
  let prev: Pt | null = null;
  const emit = (p: Pt, dir: Pt | null) => {
    let q = p;
    if (dir && lane !== 0) {
      const o = { x: p.x - dir.y * lane, y: p.y + dir.x * lane };
      if (nav.free(o) && (!prev || nav.lineOfSight(prev, o))) q = o;
    }
    if (prev && !nav.lineOfSight(prev, q)) q = p;
    xy.push(round(q.x, 2), round(q.y, 2));
    prev = q;
    f++;
  };
  let pos = start;
  for (const leg of legs) {
    if (f >= frames) break;
    if (leg.kind === "dwell") {
      const n = Math.round(leg.seconds / dt);
      const phase = rand() * Math.PI * 2;
      // spread dwellers over the spot's cell, then sway slightly
      const off = { x: (rand() - 0.5) * 0.4, y: (rand() - 0.5) * 0.4 };
      const base = nav.free({ x: leg.at.x + off.x, y: leg.at.y + off.y }) ? { x: leg.at.x + off.x, y: leg.at.y + off.y } : leg.at;
      for (let s = 0; s < n && f < frames; s++) {
        const a = phase + s * 0.15;
        const j = { x: base.x + 0.12 * Math.cos(a), y: base.y + 0.12 * Math.sin(a * 0.7) };
        emit(nav.free(j) ? j : leg.at, null);
      }
      pos = leg.at;
      continue;
    }
    const pts = leg.pts;
    let seg = 0;
    let along = 0;
    if (xy.length === 0) emit(pos, null);
    while (seg < pts.length - 1 && f < frames) {
      const a = pts[seg];
      const b = pts[seg + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-6) {
        seg++;
        continue;
      }
      const v = speed / (1 + 0.15 * density(pos));
      let step = v * dt;
      // advance `step` meters along the polyline
      while (step > 0 && seg < pts.length - 1) {
        const s0 = pts[seg];
        const s1 = pts[seg + 1];
        const l = Math.hypot(s1.x - s0.x, s1.y - s0.y);
        if (along + step < l) {
          along += step;
          step = 0;
        } else {
          step -= l - along;
          along = 0;
          seg++;
        }
      }
      const s0 = pts[Math.min(seg, pts.length - 1)];
      const s1 = pts[Math.min(seg + 1, pts.length - 1)];
      const l = Math.hypot(s1.x - s0.x, s1.y - s0.y) || 1;
      pos = seg >= pts.length - 1 ? pts[pts.length - 1] : { x: s0.x + ((s1.x - s0.x) * along) / l, y: s0.y + ((s1.y - s0.y) * along) / l };
      const dir = seg >= pts.length - 1 ? null : { x: (s1.x - s0.x) / l, y: (s1.y - s0.y) / l };
      emit(pos, dir);
    }
  }
  return xy;
}
