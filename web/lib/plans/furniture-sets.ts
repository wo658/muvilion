import { z } from "zod";
import { FIXTURES } from "@/lib/assets/fixtures";
import { getModelAsset } from "@/lib/assets/catalog";
import type { DesignObject, PlanDocument, SpaceZone } from "./schema";
import { footprintFitsBoundary } from "./design";

/**
 * Furnished sets Muse places as one unit. The server expands each into fixtures already spaced
 * for the seating review (facing, reach, pull-back), so a set is valid by construction and a
 * furnished zone costs one placement instead of a dozen hand-positioned objects.
 */
export const FURNITURE_SET_TYPES = ["meeting-4", "consult-desk", "counter-bar", "lounge-pair", "photo-spot", "display-row", "audience-rows"] as const;
export type FurnitureSetType = typeof FURNITURE_SET_TYPES[number];
const Rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
export const FurnitureSetSchema = z.object({
  type: z.enum(FURNITURE_SET_TYPES).describe("meeting-4: conversation table with 4 chairs. consult-desk: work table with a chair each side. counter-bar: a row of worktops with chairs on the front side and a backdrop panel (fitting bar, editing bench). lounge-pair: two sofas facing a coffee table. photo-spot: backdrop panel, phone stand and two studio lights. display-row: display vitrines in a row. audience-rows: chairs in rows facing targetId (a stage)."),
  id: z.string().min(1).max(60).regex(/^[\w-]+$/).describe("Set ID; its objects get IDs `<id>-<part>`."),
  label: z.string().min(1).max(60),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  rotation: Rotation.describe("0: seats face north toward the table/backdrop side; 90 east, 180 south, 270 west."),
  count: z.number().int().min(1).max(8).optional().describe("counter-bar worktops (2 chairs each), display-row vitrines, audience-rows chairs per row. Default 2."),
  rows: z.number().int().min(1).max(8).optional().describe("audience-rows only. Default 2."),
  targetId: z.string().min(1).max(100).optional().describe("audience-rows only: the stage the seats face."),
  zoneId: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Brand color for tables, panels and upholstery."),
}).strict();
export type FurnitureSet = z.infer<typeof FurnitureSetSchema>;

type Part = { part: string; kind: DesignObject["kind"]; dx: number; dy: number; turn: 0 | 90 | 180 | 270; width: number; depth: number; height: number; extra?: Partial<DesignObject> };
const fixture = (type: keyof typeof FIXTURES) => ({ kind: FIXTURES[type].kind, width: FIXTURES[type].width, depth: FIXTURES[type].depth, height: FIXTURES[type].height, extra: { fixtureType: type } });
const modelled = (id: string) => {
  const asset = getModelAsset(id)!;
  return { kind: asset.kind as DesignObject["kind"], width: asset.width, depth: asset.depth, height: asset.height, extra: { modelAssetId: asset.id } as Partial<DesignObject> };
};
const CHAIR = FIXTURES["event-chair"], SOFA = FIXTURES["lounge-sofa"];
const CHAIR_GAP = .2, SOFA_GAP = .45, PULL_BACK = .75;

/** Parts in the set's local frame: metres from its centre, y south, seats facing north at turn 0. */
function parts(set: FurnitureSet): { items: Part[]; envelope: { width: number; depth: number } } {
  const id = set.id;
  if (set.type === "meeting-4" || set.type === "consult-desk") {
    const table = fixture(set.type === "meeting-4" ? "meeting-table" : "work-table");
    const offsets = set.type === "meeting-4" ? [-.35, .35] : [0];
    const y = table.depth / 2 + CHAIR_GAP + CHAIR.depth / 2;
    const chairs = offsets.flatMap((dx, i) => [
      { part: `chair-s${i + 1}`, ...fixture("event-chair"), dx, dy: y, turn: 0 as const, extra: { fixtureType: "event-chair" as const, useTargetId: `${id}-table` } },
      { part: `chair-n${i + 1}`, ...fixture("event-chair"), dx, dy: -y, turn: 180 as const, extra: { fixtureType: "event-chair" as const, useTargetId: `${id}-table` } },
    ]);
    return { items: [{ part: "table", ...table, dx: 0, dy: 0, turn: 0 }, ...chairs], envelope: { width: table.width, depth: 2 * (y + CHAIR.depth / 2 + PULL_BACK) } };
  }
  if (set.type === "counter-bar") {
    const table = fixture("work-table"), count = set.count ?? 2, length = count * table.width;
    const chairY = table.depth / 2 + CHAIR_GAP + CHAIR.depth / 2;
    const items: Part[] = [{ part: "backdrop", kind: "partition", width: length, depth: .1, height: 1.8, dx: 0, dy: -(table.depth / 2 + .1), turn: 0 }];
    for (let i = 0; i < count; i++) {
      const cx = -length / 2 + table.width * (i + .5);
      items.push({ part: `top-${i + 1}`, ...table, dx: cx, dy: 0, turn: 0 });
      for (const [j, dx] of [-.3, .3].entries())
        items.push({ part: `chair-${i + 1}${"ab"[j]}`, ...fixture("event-chair"), dx: cx + dx, dy: chairY, turn: 0, extra: { fixtureType: "event-chair", useTargetId: `${id}-top-${i + 1}` } });
    }
    return { items, envelope: { width: length, depth: table.depth + .25 + 2 * (CHAIR_GAP + CHAIR.depth + PULL_BACK) } };
  }
  if (set.type === "lounge-pair") {
    // The coffee table's long side is its local depth, so turn it to run along the sofas.
    const table = modelled("modern_coffee_table_01"), y = table.width / 2 + SOFA_GAP + SOFA.depth / 2;
    return { items: [
      { part: "table", ...table, dx: 0, dy: 0, turn: 90 },
      { part: "sofa-s", ...fixture("lounge-sofa"), dx: 0, dy: y, turn: 0, extra: { fixtureType: "lounge-sofa", useTargetId: `${id}-table` } },
      { part: "sofa-n", ...fixture("lounge-sofa"), dx: 0, dy: -y, turn: 180, extra: { fixtureType: "lounge-sofa", useTargetId: `${id}-table` } },
    ], envelope: { width: SOFA.width + 2 * .65, depth: 2 * (y + SOFA.depth / 2) } };
  }
  if (set.type === "photo-spot") {
    const light = fixture("studio-light"), stand = fixture("phone-stand");
    return { items: [
      { part: "backdrop", kind: "partition", width: 3, depth: .15, height: 2.4, dx: 0, dy: -1.2, turn: 0 },
      { part: "light-w", ...light, dx: -1.4, dy: .2, turn: 0 },
      { part: "light-e", ...light, dx: 1.4, dy: .2, turn: 0 },
      { part: "phone", ...stand, dx: 0, dy: 1.2, turn: 0 },
    ], envelope: { width: 3.4, depth: 3 } };
  }
  if (set.type === "display-row") {
    const vitrine = modelled("display_vitrine"), count = set.count ?? 3, pitch = vitrine.width + .6;
    return { items: Array.from({ length: count }, (_, i) => ({ part: `vitrine-${i + 1}`, ...vitrine, dx: (i - (count - 1) / 2) * pitch, dy: 0, turn: 0 as const })),
      envelope: { width: count * pitch, depth: vitrine.depth + 1.2 } };
  }
  const perRow = set.count ?? 2, rows = set.rows ?? 2, pitch = 1.6, spacing = CHAIR.width + .1;
  const items: Part[] = [];
  for (let row = 0; row < rows; row++) for (let i = 0; i < perRow; i++)
    items.push({ part: `seat-${row + 1}-${i + 1}`, ...fixture("event-chair"), dx: (i - (perRow - 1) / 2) * spacing, dy: (row - (rows - 1) / 2) * pitch, turn: 0,
      extra: { fixtureType: "event-chair", ...(set.targetId ? { useTargetId: set.targetId } : {}) } });
  return { items, envelope: { width: perRow * spacing, depth: rows * pitch + .45 } };
}

const rotate = (dx: number, dy: number, turn: number) => {
  const a = turn * Math.PI / 180, cos = Math.round(Math.cos(a)), sin = Math.round(Math.sin(a));
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
};

/** Local sides (+y south, -y north, ±x) seats are approached from, for suggesting an aisle. */
const ACCESS_SIDES: Record<FurnitureSetType, ("south" | "north" | "east" | "west")[]> = {
  "meeting-4": ["south", "north"], "consult-desk": ["south", "north"], "counter-bar": ["south"], "lounge-pair": ["east", "west"],
  "photo-spot": ["south"], "display-row": ["south"], "audience-rows": ["east", "west"],
};

/** Objects for a set in document coordinates, and its footprint including seat pull-back space. */
export function expandFurnitureSet(document: Pick<PlanDocument, "widthMeters" | "heightMeters" | "floorBoundary">, set: FurnitureSet) {
  const width = document.widthMeters, depth = document.heightMeters;
  if (!width || !depth) throw new Error("Confirm the drawing scale before placing furniture sets.");
  const { items, envelope } = parts(set);
  const objects: DesignObject[] = items.map(item => {
    const offset = rotate(item.dx, item.dy, set.rotation);
    return {
      id: `${set.id}-${item.part}`, kind: item.kind, label: `${set.label} · ${item.part}`,
      x: set.x + offset.x / width, y: set.y + offset.y / depth,
      width: item.width, depth: item.depth, height: item.height,
      rotation: ((item.turn + set.rotation) % 360) as DesignObject["rotation"], color: set.color,
      ...(set.zoneId ? { zoneId: set.zoneId } : {}), ...item.extra,
    };
  });
  const turned = set.rotation % 180 !== 0;
  const w = turned ? envelope.depth : envelope.width, d = turned ? envelope.width : envelope.depth;
  const footprint = { x0: set.x - w / 2 / width, x1: set.x + w / 2 / width, y0: set.y - d / 2 / depth, y1: set.y + d / 2 / depth, width: w, depth: d };
  // A 1.2 m strip along each approach side; a circulation zone covering one connects the seats.
  const aisle = 1.2, sides = ["north", "east", "south", "west"] as const;
  const access = ACCESS_SIDES[set.type].map(side => {
    const turnedSide = sides[(sides.indexOf(side) + set.rotation / 90) % 4];
    const ax = aisle / width, ay = aisle / depth;
    if (turnedSide === "north") return { side: turnedSide, x0: footprint.x0, x1: footprint.x1, y0: footprint.y0 - ay, y1: footprint.y0 };
    if (turnedSide === "south") return { side: turnedSide, x0: footprint.x0, x1: footprint.x1, y0: footprint.y1, y1: footprint.y1 + ay };
    if (turnedSide === "east") return { side: turnedSide, x0: footprint.x1, x1: footprint.x1 + ax, y0: footprint.y0, y1: footprint.y1 };
    return { side: turnedSide, x0: footprint.x0 - ax, x1: footprint.x0, y0: footprint.y0, y1: footprint.y1 };
  });
  // Seating sets bring their own access aisle, so connecting them only needs that aisle to touch a
  // main route. Either side serves lounge and audience seats; table seats need each side.
  const either = set.type === "lounge-pair" || set.type === "audience-rows";
  const inside = (a: typeof access[number]) => !document.floorBoundary || footprintFitsBoundary({ x: a.x0, y: a.y0, width: a.x1 - a.x0, height: a.y1 - a.y0 }, document.floorBoundary);
  const seated = set.type !== "photo-spot" && set.type !== "display-row";
  const aisles = !seated ? [] : either ? [access.find(inside) ?? access[0]] : access;
  // Each aisle runs 1.2 m past both ends of the set, so a route passing any corner meets it
  // without having to overlap the furniture.
  const zones: SpaceZone[] = aisles.map(a => {
    const along = a.side === "north" || a.side === "south";
    return { id: `${set.id}-aisle-${a.side}`, label: `${set.label} · aisle`, purpose: "circulation",
      x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2, width: (a.x1 - a.x0) * width + (along ? 2 * aisle : 0), depth: (a.y1 - a.y0) * depth + (along ? 0 : 2 * aisle), rotation: 0, assignable: false };
  });
  return { objects, zones, footprint, access };
}
