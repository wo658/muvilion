/**
 * Revision vocabulary the LLM may use, and the code that translates a revision
 * into the next LayoutRequest.
 *
 * The LLM only expresses *intent* (which booth, which direction, which rule to
 * tighten). Concrete coordinates are computed here from tool results (current
 * layout, hotspot zones, door positions), and every value is bounded by zod.
 */
import { z } from "zod";
import {
  LayoutRequest,
  type Booth,
  type BoothSpec,
  type Hotspot,
  type Layout,
  type Point,
  type Rect,
  type Venue,
} from "@/lib/engine/contract";
import { boothRect, center, doorMid, entrances, round } from "@/lib/geometry";

const BoothId = z.string().min(1).describe("Booth id, e.g. B03");
const Direction = z.enum(["away_from_entrance", "away_from_hotspot", "north", "south", "east", "west"]);

export const RevisionAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move_booth"),
    booth_id: BoothId,
    direction: Direction,
    distance_m: z.number().min(1).max(20),
    hotspot_index: z.number().int().min(0).optional(),
  }),
  z.object({ type: z.literal("pin_booth"), booth_id: BoothId }),
  z.object({ type: z.literal("unpin_booth"), booth_id: BoothId }),
  z.object({
    type: z.literal("widen_aisle_at_hotspot"),
    hotspot_index: z.number().int().min(0),
    margin_m: z.number().min(0).max(3).default(0.5),
  }),
  z.object({
    type: z.literal("add_keep_out"),
    rect: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
  }),
  z.object({ type: z.literal("remove_keep_out"), index: z.number().int().min(0) }),
  z.object({ type: z.literal("set_popular_door_distance"), value: z.number().min(0).max(40) }),
  z.object({ type: z.literal("set_popular_threshold"), value: z.number().min(0).max(1) }),
  z.object({ type: z.literal("set_min_aisle_width"), value: z.number().min(1.2).max(6) }),
  z.object({ type: z.literal("set_door_clearance"), value: z.number().min(0).max(15) }),
]);
export type RevisionAction = z.infer<typeof RevisionAction>;
export const ACTION_TYPES = RevisionAction.options.map((o) => o.shape.type.value);

/**
 * Flat schema exposed to the model as a function tool. Flat objects with optional
 * fields are more reliably produced by OpenAI-compatible models than anyOf unions;
 * each action is then checked against the strict `RevisionAction` union.
 */
export const RevisionToolInput = z.object({
  rationale: z.string().describe("Why these changes should reduce the observed congestion or fix the violations."),
  actions: z
    .array(
      z.object({
        type: z.enum(ACTION_TYPES as [string, ...string[]]),
        booth_id: z.string().optional().describe("For move_booth / pin_booth / unpin_booth"),
        direction: Direction.optional().describe("For move_booth"),
        distance_m: z.number().optional().describe("For move_booth: 1..20 m"),
        hotspot_index: z.number().int().optional().describe("For widen_aisle_at_hotspot, or move_booth away_from_hotspot"),
        margin_m: z.number().optional().describe("For widen_aisle_at_hotspot: 0..3 m added around the hotspot zone"),
        rect: z
          .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
          .optional()
          .describe("For add_keep_out (hall meters, origin bottom-left)"),
        index: z.number().int().optional().describe("For remove_keep_out: index into constraints.keep_out"),
        value: z.number().optional().describe("For set_* actions"),
      }),
    )
    .min(1)
    .max(8),
});
export type RevisionToolInput = z.infer<typeof RevisionToolInput>;

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

export type Revision = { rationale: string; actions: RevisionAction[] };
export type RejectedAction = { action: unknown; reason: string };
export type AppliedAction = { action: RevisionAction; effect: string };

/** Turn raw tool input into strictly-validated actions; invalid ones are reported, not applied. */
export function normalizeRevision(raw: unknown): { revision: Revision; rejected: RejectedAction[] } {
  // Models often send `null` for unused optional fields; treat it as absent.
  const top = RevisionToolInput.safeParse(dropNulls(raw));
  if (!top.success) {
    return { revision: { rationale: "", actions: [] }, rejected: [{ action: raw, reason: `invalid revision: ${top.error.message}` }] };
  }
  const actions: RevisionAction[] = [];
  const rejected: RejectedAction[] = [];
  for (const a of top.data.actions) {
    const p = RevisionAction.safeParse(a);
    if (p.success) actions.push(p.data);
    else rejected.push({ action: a, reason: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  }
  return { revision: { rationale: top.data.rationale, actions }, rejected };
}

export type RevisionContext = {
  venue: Venue;
  specs: BoothSpec[];
  /** The request that produced `layout`. */
  request: LayoutRequest;
  /** The layout being revised (becomes `previous`). */
  layout: Layout;
  /** Hotspots from the simulation of `layout` (empty for validation fixes). */
  hotspots: Hotspot[];
};

export type TranslatedRevision = { request: LayoutRequest; applied: AppliedAction[]; rejected: RejectedAction[] };

const fmt = (p: Point) => `(${round(p.x, 1)}, ${round(p.y, 1)})`;

function unit(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const n = Math.hypot(dx, dy);
  return n < 1e-9 ? { x: 0, y: 1 } : { x: dx / n, y: dy / n };
}

/**
 * Translate a revision into the next LayoutRequest:
 * - `previous` is set to the revised layout so the solver moves as little as possible;
 * - `seed` and `time_limit_s` are carried over unchanged;
 * - `move_booth` shifts that booth's anchor in `previous` (the solver keeps it as
 *   close as feasible to the new anchor) instead of pinning an unchecked coordinate.
 */
export function applyRevision(ctx: RevisionContext, revision: Revision): TranslatedRevision {
  const base = LayoutRequest.parse(ctx.request);
  const c = structuredClone(base.constraints);
  const prevBooths: Booth[] = structuredClone(ctx.layout.booths);
  const byId = new Map(prevBooths.map((b) => [b.id, b]));
  const known = new Set(ctx.specs.map((s) => s.id));
  const applied: AppliedAction[] = [];
  const rejected: RejectedAction[] = [];
  const reject = (action: unknown, reason: string) => rejected.push({ action, reason });
  const W = ctx.venue.width;
  const H = ctx.venue.height;

  for (const action of revision.actions) {
    switch (action.type) {
      case "move_booth": {
        const b = byId.get(action.booth_id);
        if (!b || !known.has(action.booth_id)) {
          reject(action, `unknown booth ${action.booth_id}`);
          break;
        }
        const from = center(boothRect(b));
        let dir: Point;
        if (action.direction === "away_from_entrance") {
          const ents = entrances(ctx.venue).map(doorMid);
          const near = ents.reduce((a, e) => (Math.hypot(e.x - from.x, e.y - from.y) < Math.hypot(a.x - from.x, a.y - from.y) ? e : a));
          dir = unit(near, from);
        } else if (action.direction === "away_from_hotspot") {
          const h = ctx.hotspots[action.hotspot_index ?? 0];
          if (!h) {
            reject(action, `no hotspot #${action.hotspot_index ?? 0} in the last simulation`);
            break;
          }
          dir = unit(center(h.zone), from);
        } else {
          dir = { north: { x: 0, y: 1 }, south: { x: 0, y: -1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } }[action.direction];
        }
        const m = c.wall_margin;
        const nx = Math.min(Math.max(b.x + dir.x * action.distance_m, m), W - m - b.w);
        const ny = Math.min(Math.max(b.y + dir.y * action.distance_m, m), H - m - b.h);
        const old = { x: b.x, y: b.y };
        b.x = round(nx, 2);
        b.y = round(ny, 2);
        let note = "";
        if (c.fixed[b.id]) {
          delete c.fixed[b.id];
          note = " (unpinned so it can move)";
        }
        applied.push({ action, effect: `${b.id} target ${fmt(old)} → ${fmt(b)}${note}` });
        break;
      }
      case "pin_booth": {
        const b = byId.get(action.booth_id);
        if (!b) {
          reject(action, `unknown booth ${action.booth_id}`);
          break;
        }
        c.fixed[b.id] = { x: b.x, y: b.y };
        applied.push({ action, effect: `${b.id} pinned at ${fmt(b)}` });
        break;
      }
      case "unpin_booth": {
        if (!c.fixed[action.booth_id]) {
          reject(action, `${action.booth_id} is not pinned`);
          break;
        }
        delete c.fixed[action.booth_id];
        applied.push({ action, effect: `${action.booth_id} unpinned` });
        break;
      }
      case "widen_aisle_at_hotspot": {
        const h = ctx.hotspots[action.hotspot_index];
        if (!h) {
          reject(action, `no hotspot #${action.hotspot_index} in the last simulation`);
          break;
        }
        const mg = action.margin_m;
        const x = Math.max(0, h.zone.x - mg);
        const y = Math.max(0, h.zone.y - mg);
        const r: Rect = {
          x: round(x, 2),
          y: round(y, 2),
          w: round(Math.min(W, h.zone.x + h.zone.w + mg) - x, 2),
          h: round(Math.min(H, h.zone.y + h.zone.h + mg) - y, 2),
        };
        c.keep_out.push(r);
        applied.push({ action, effect: `keep-out #${c.keep_out.length} added over hotspot #${action.hotspot_index} ${fmt(r)} ${r.w}×${r.h} m` });
        break;
      }
      case "add_keep_out": {
        const r = action.rect;
        if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) {
          reject(action, "keep-out rect lies outside the hall");
          break;
        }
        c.keep_out.push(r);
        applied.push({ action, effect: `keep-out #${c.keep_out.length} added at ${fmt(r)} ${r.w}×${r.h} m` });
        break;
      }
      case "remove_keep_out": {
        if (action.index >= c.keep_out.length) {
          reject(action, `no keep-out #${action.index}`);
          break;
        }
        c.keep_out.splice(action.index, 1);
        applied.push({ action, effect: `keep-out index ${action.index} removed` });
        break;
      }
      case "set_popular_door_distance":
        applied.push({ action, effect: `popular_door_distance ${c.popular_door_distance} → ${action.value} m` });
        c.popular_door_distance = action.value;
        break;
      case "set_popular_threshold":
        applied.push({ action, effect: `popular_threshold ${c.popular_threshold} → ${action.value}` });
        c.popular_threshold = action.value;
        break;
      case "set_min_aisle_width":
        applied.push({ action, effect: `min_aisle_width ${c.min_aisle_width} → ${action.value} m` });
        c.min_aisle_width = action.value;
        break;
      case "set_door_clearance":
        applied.push({ action, effect: `door_clearance ${c.door_clearance} → ${action.value} m` });
        c.door_clearance = action.value;
        break;
    }
  }

  const request = LayoutRequest.parse({
    ...base,
    constraints: c,
    previous: { ...ctx.layout, booths: prevBooths },
  });
  return { request, applied, rejected };
}
