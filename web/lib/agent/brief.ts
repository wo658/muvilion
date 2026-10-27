/**
 * Design brief: the first judgment step of a run, before any layout exists.
 *
 * Muse (or the stub) reads a code-built summary of the site and the booth list and states
 * *intent*: aisle width, door clearance, which booths count as popular and how far they stay
 * from entrances, areas to keep open (e.g. a plaza in front of a gate), and booths that belong
 * next to a door (e.g. a ticket kiosk by the main gate). Code turns that intent into the first
 * LayoutRequest: rectangles and pinned coordinates are computed here from the venue geometry,
 * every value is bounded by zod, and OR-Tools then decides where every booth actually goes.
 *
 * Constraint values are the LLM's choice; metrics never are (no layout or simulation exists yet).
 */
import { z } from "zod";
import {
  LayoutRequest,
  type BoothSpec,
  type Door,
  type LayoutConstraints,
  type Point,
  type Rect,
  type Scenario,
  type Venue,
} from "@/lib/engine/contract";
import { boothRect, center, doorClearanceRect, doorMid, dist, inPopularZone, polygonBBox, rectsOverlap, round } from "@/lib/geometry";
import { applyRevision, type RejectedAction, type RevisionAction } from "./revision";

// ---------- what the LLM reads ----------

/** Compact, code-computed view of the site and the booths to place (no raw polygons beyond bboxes). */
export function summarizeSite(venue: Venue, specs: BoothSpec[], scenario: Scenario, constraints: LayoutConstraints) {
  const area = venue.width * venue.height;
  const byKind: Record<string, number> = {};
  for (const s of specs) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  return {
    venue: {
      id: venue.id,
      name: venue.name,
      setting: venue.setting,
      width_m: venue.width,
      height_m: venue.height,
      area_m2: round(area, 1),
    },
    doors: venue.doors.map((d) => ({ id: d.id, kind: d.kind, a: d.a, b: d.b, width_m: round(dist(d.a, d.b), 2) })),
    zones: venue.zones.map((z) => ({ id: z.id, kind: z.kind, buildable: z.buildable, bbox: polygonBBox(z.polygon) })),
    obstacles: venue.obstacles.map((o) => ({ id: o.id, kind: o.kind, bbox: roundRect(polygonBBox(o.polygon)) })),
    unknowns: venue.unknowns,
    booths: {
      count: specs.length,
      by_kind: byKind,
      list: specs.map((s) => ({ id: s.id, label: s.label, kind: s.kind, w: s.w, h: s.h, popularity: s.popularity })),
    },
    attendance: {
      scenario: scenario.kind,
      visitors: scenario.agents,
      duration_s: scenario.duration_s,
      visitors_per_m2: round(scenario.agents / area, 3),
    },
    default_constraints: {
      min_aisle_width: constraints.min_aisle_width,
      door_clearance: constraints.door_clearance,
      wall_margin: constraints.wall_margin,
      popular_threshold: constraints.popular_threshold,
      popular_door_distance: constraints.popular_door_distance,
    },
  };
}
export type SiteSummary = ReturnType<typeof summarizeSite>;

const roundRect = (r: Rect): Rect => ({ x: round(r.x, 2), y: round(r.y, 2), w: round(r.w, 2), h: round(r.h, 2) });

// ---------- what the LLM returns ----------

/**
 * Flat tool schema (optional fields, no unions) — the shape OpenAI-compatible models fill most
 * reliably. Each entry is then checked against the strict `BriefItem` union.
 */
export const DesignBriefToolInput = z.object({
  rationale: z.string().describe("2-4 sentences: how the site and booth mix shape the initial constraints. No invented metrics."),
  min_aisle_width: z.number().optional().describe("Initial minimum aisle width, 1.2..6 m"),
  door_clearance: z.number().optional().describe("Clear depth in front of every door, 0..15 m"),
  popular_threshold: z.number().optional().describe("Booths with popularity >= this count as popular, 0..1"),
  popular_door_distance: z.number().optional().describe("Popular booths stay this far from entrances, 0..40 m"),
  keep_clear_at_doors: z
    .array(
      z.object({
        door_id: z.string(),
        depth_m: z.number().describe("How far into the site the open area reaches, 1..20 m"),
        width_m: z.number().describe("Width of the open area along the boundary, 1..40 m (at least the door width)"),
      }),
    )
    .max(6)
    .optional()
    .describe("Open areas in front of doors/gates (e.g. an arrival plaza); the rectangle is computed in code"),
  keep_out: z
    .array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }))
    .max(6)
    .optional()
    .describe("Other areas no booth may use (site meters, origin bottom-left, y up)"),
  place_near_door: z
    .array(z.object({ booth_id: z.string(), door_id: z.string() }))
    .max(4)
    .optional()
    .describe("Booths that belong beside a door (e.g. a ticket kiosk at the main gate); the exact spot is computed in code"),
});
export type DesignBriefToolInput = z.infer<typeof DesignBriefToolInput>;

/** Strict brief vocabulary; the set_* / add_keep_out items share the revision action shapes and bounds. */
export const BriefItem = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_min_aisle_width"), value: z.number().min(1.2).max(6) }),
  z.object({ type: z.literal("set_door_clearance"), value: z.number().min(0).max(15) }),
  z.object({ type: z.literal("set_popular_threshold"), value: z.number().min(0).max(1) }),
  z.object({ type: z.literal("set_popular_door_distance"), value: z.number().min(0).max(40) }),
  z.object({
    type: z.literal("add_keep_out"),
    rect: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
  }),
  z.object({
    type: z.literal("keep_clear_at_door"),
    door_id: z.string().min(1),
    depth_m: z.number().min(1).max(20),
    width_m: z.number().min(1).max(40),
  }),
  z.object({ type: z.literal("place_near_door"), booth_id: z.string().min(1), door_id: z.string().min(1) }),
]);
export type BriefItem = z.infer<typeof BriefItem>;

export type Brief = { rationale: string; items: BriefItem[] };
export type BriefApplied = { item: BriefItem; effect: string };

function dropNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== null && x !== undefined)
        .map(([k, x]) => [k, dropNulls(x)]),
    );
  return v;
}

/** Raw tool input → strictly validated items; invalid ones are reported, never applied. */
export function normalizeBrief(raw: unknown): { brief: Brief; rejected: RejectedAction[] } {
  const top = DesignBriefToolInput.safeParse(dropNulls(raw));
  if (!top.success) return { brief: { rationale: "", items: [] }, rejected: [{ action: raw, reason: `invalid design brief: ${top.error.message}` }] };
  const d = top.data;
  const candidates: unknown[] = [];
  if (d.min_aisle_width !== undefined) candidates.push({ type: "set_min_aisle_width", value: d.min_aisle_width });
  if (d.door_clearance !== undefined) candidates.push({ type: "set_door_clearance", value: d.door_clearance });
  if (d.popular_threshold !== undefined) candidates.push({ type: "set_popular_threshold", value: d.popular_threshold });
  if (d.popular_door_distance !== undefined) candidates.push({ type: "set_popular_door_distance", value: d.popular_door_distance });
  for (const k of d.keep_clear_at_doors ?? []) candidates.push({ type: "keep_clear_at_door", ...k });
  for (const r of d.keep_out ?? []) candidates.push({ type: "add_keep_out", rect: r });
  for (const p of d.place_near_door ?? []) candidates.push({ type: "place_near_door", ...p });
  const items: BriefItem[] = [];
  const rejected: RejectedAction[] = [];
  for (const c of candidates) {
    const p = BriefItem.safeParse(c);
    if (p.success) items.push(p.data);
    else rejected.push({ action: c, reason: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  }
  return { brief: { rationale: d.rationale.trim(), items }, rejected };
}

// ---------- intent → first LayoutRequest (code) ----------

export type BriefContext = { venue: Venue; specs: BoothSpec[]; request: LayoutRequest };
export type TranslatedBrief = { request: LayoutRequest; applied: BriefApplied[]; rejected: RejectedAction[] };

const fmt = (p: Point) => `(${round(p.x, 1)}, ${round(p.y, 1)})`;

/** Open rectangle in front of a door: `depth` into the site, `width` centered on the door. */
export function keepClearRect(door: Door, venue: Venue, depth: number, width: number): Rect | null {
  const len = dist(door.a, door.b);
  const r = doorClearanceRect(door, venue, depth, Math.max(0, (width - len) / 2));
  return r && roundRect(r);
}

/**
 * The spot nearest a door where `spec` can stand: inside the wall margin, clear of obstacles
 * (+1 m), unbuildable zones, every door's clearance, the walking line straight in from this door,
 * every keep-out (and the popular zone if the booth counts as popular). Searched on a 0.5 m lattice along the door's side of the site.
 */
export function spotNearDoor(
  venue: Venue,
  spec: BoothSpec,
  door: Door,
  c: LayoutConstraints,
  pinned: Rect[] = [],
): Point | null {
  const m = c.wall_margin;
  const blocked: Rect[] = [
    ...venue.obstacles.map((o) => {
      const b = polygonBBox(o.polygon);
      return { x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2 };
    }),
    ...venue.zones.filter((z) => !z.buildable).map((z) => polygonBBox(z.polygon)),
    ...venue.doors.flatMap((d) => {
      const r = doorClearanceRect(d, venue, Math.max(c.door_clearance, 1), c.min_aisle_width / 2);
      return r ? [r] : [];
    }),
    ...c.keep_out,
    // Booths already pinned (input constraints or earlier brief items), with a full aisle around them.
    ...pinned.map((r) => ({
      x: r.x - c.min_aisle_width,
      y: r.y - c.min_aisle_width,
      w: r.w + 2 * c.min_aisle_width,
      h: r.h + 2 * c.min_aisle_width,
    })),
  ];
  // Keep the walking line straight out of the door free: beside the gate, not in front of it.
  const corridor = doorClearanceRect(door, venue, Math.max(c.door_clearance, 1) + 12, c.min_aisle_width / 2);
  if (corridor) blocked.push(corridor);
  const popular = c.popular_door_distance > 0 && spec.popularity >= c.popular_threshold;
  const mid = doorMid(door);
  let best: { p: Point; d: number } | null = null;
  for (let x = m; x + spec.w <= venue.width - m + 1e-9; x += 0.5) {
    for (let y = m; y + spec.h <= venue.height - m + 1e-9; y += 0.5) {
      const r = { x, y, w: spec.w, h: spec.h };
      const d = dist(center(r), mid);
      if (d > 25 || (best && d >= best.d - 1e-9)) continue;
      if (blocked.some((b) => rectsOverlap(r, b))) continue;
      if (popular && inPopularZone(r, venue, c.popular_door_distance)) continue;
      best = { p: { x: round(x, 2), y: round(y, 2) }, d };
    }
  }
  return best?.p ?? null;
}

/**
 * Apply a brief to the initial request. Constraint values and keep-outs go through the revision
 * translator (`applyRevision` with no layout, so `previous` stays null); door-relative intents
 * become rectangles and pinned positions computed from the venue geometry.
 */
export function applyBrief(ctx: BriefContext, brief: Brief): TranslatedBrief {
  const { venue, specs } = ctx;
  const applied: BriefApplied[] = [];
  const rejected: RejectedAction[] = [];
  const doors = new Map(venue.doors.map((d) => [d.id, d]));
  const actions: RevisionAction[] = [];
  const origin = new Map<RevisionAction, BriefItem>();
  for (const item of brief.items) {
    if (item.type === "place_near_door") continue;
    if (item.type === "keep_clear_at_door") {
      const d = doors.get(item.door_id);
      const r = d && keepClearRect(d, venue, item.depth_m, item.width_m);
      if (!r) {
        rejected.push({ action: item, reason: d ? `door ${item.door_id} is not on the site boundary` : `unknown door ${item.door_id}` });
        continue;
      }
      const a: RevisionAction = { type: "add_keep_out", rect: r };
      actions.push(a);
      origin.set(a, item);
      continue;
    }
    actions.push(item);
    origin.set(item, item);
  }
  const t = applyRevision({ venue, specs, request: ctx.request, layout: null, hotspots: [] }, { rationale: brief.rationale, actions });
  for (const a of t.applied) {
    const item = origin.get(a.action) ?? (a.action as BriefItem);
    applied.push({
      item,
      effect: item.type === "keep_clear_at_door" ? `open area in front of ${item.door_id}: ${a.effect.replace(/^keep-out/, "keep-out")}` : a.effect,
    });
  }
  rejected.push(...t.rejected);

  const c = structuredClone(t.request.constraints);
  const spec = new Map(specs.map((s) => [s.id, s]));
  for (const item of brief.items) {
    if (item.type !== "place_near_door") continue;
    const s = spec.get(item.booth_id);
    const d = doors.get(item.door_id);
    if (!s || !d) {
      rejected.push({ action: item, reason: !s ? `unknown booth ${item.booth_id}` : `unknown door ${item.door_id}` });
      continue;
    }
    // A pin carries no rotation, so reserve the square that covers either orientation.
    const pinned = Object.entries(c.fixed).flatMap(([id, q]) => {
      const ps = spec.get(id);
      if (!ps) return [];
      const side = Math.max(ps.w, ps.h);
      return [{ x: q.x, y: q.y, w: side, h: side }];
    });
    const p = spotNearDoor(venue, s, d, c, pinned);
    if (!p) {
      rejected.push({ action: item, reason: `no free spot for ${s.id} within 25 m of ${d.id}` });
      continue;
    }
    // Later pins must not overlap this one.
    c.keep_out.push(boothRect({ ...p, w: s.w, h: s.h }));
    c.fixed[s.id] = p;
    applied.push({ item, effect: `${s.id} pinned at ${fmt(p)} beside ${d.id}` });
  }
  // the temporary keep-outs only guarded the pin search
  c.keep_out = c.keep_out.slice(0, t.request.constraints.keep_out.length);

  const request = LayoutRequest.parse({ ...t.request, constraints: c, previous: null });
  return { request, applied, rejected };
}

// ---------- deterministic rules (stub) ----------

/**
 * Rule-based brief used by the stub LLM. Outdoor: wider aisles and door clearance, kiosks pinned
 * beside the main gate (popular stalls are left to the solver + simulation loop). Indoor: the standard rules, and popular booths
 * away from the entrance only when attendance is high.
 */
export function ruleBasedBrief(site: SiteSummary): DesignBriefToolInput {
  const d0 = site.default_constraints;
  const entrances = site.doors.filter((d) => d.kind === "entrance");
  const main = [...(entrances.length ? entrances : site.doors)].sort((a, b) => b.width_m - a.width_m)[0];
  const kiosks = site.booths.list.filter((b) => b.kind === "kiosk");
  const trucks = site.booths.list.filter((b) => b.kind === "food_truck");
  const highAttendance = site.attendance.visitors_per_m2 >= 0.25;

  if (site.venue.setting === "outdoor") {
    // Deliberately conservative: where popular stalls and food trucks go is left to the solver and
    // the simulation (the revision loop moves them if the gate area crowds), so the brief does not
    // pre-empt the bottleneck the loop is there to find.
    const out: DesignBriefToolInput = {
      rationale: "",
      min_aisle_width: Math.max(d0.min_aisle_width, 3.5),
      door_clearance: Math.max(d0.door_clearance, 6),
    };
    const parts = [
      "Outdoor site: crowds spread less evenly than indoors and service access matters, so aisles are wider and every gate keeps a deeper clearance.",
    ];
    if (main && kiosks.length > 0) {
      out.place_near_door = kiosks.slice(0, 2).map((k) => ({ booth_id: k.id, door_id: main.id }));
      parts.push(`${kiosks.map((k) => k.id).join(", ")} sells tickets, so it sits beside ${main.id}, out of the walking line.`);
    }
    if (trucks.length > 0)
      parts.push("Food trucks will draw queues; their placement is left to the solver and checked against the simulation before anything is moved.");
    if (site.zones.some((z) => z.kind === "fire_lane")) parts.push("The fire lane is unbuildable and must stay continuous; the engine enforces it.");
    out.rationale = parts.join(" ");
    return out;
  }

  if (highAttendance && entrances.length > 0) {
    return {
      rationale:
        "Attendance is high for the floor area, so the most popular booths start away from the entrance to keep the arrival zone from becoming the bottleneck. Aisles and door clearance stay at the standard values.",
      popular_door_distance: Math.max(d0.popular_door_distance, 8),
    };
  }
  return {
    rationale:
      "Indoor hall with moderate attendance for its floor area: the standard aisle width and door clearance apply and booths are not yet pushed away from the entrance. The first simulation will show whether the entrance area needs more room.",
  };
}
