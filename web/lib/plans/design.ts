import { pointInFloor } from "./footprint";
import { clippedFloorArea } from "./floor-area";
import { dimensionsMatch } from "@/lib/assets/dimensions";
import { translate, type Locale } from "@/lib/i18n/messages";
import type { DesignObject, PlanDocument, SpaceZone } from "./schema";

type Footprint = Pick<DesignObject, "x" | "y" | "width" | "depth" | "rotation">;
type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };
const EPS = 1e-9;
export function objectBounds(object: Footprint, document: PlanDocument) {
  const width = (object.rotation % 180 === 90 ? object.depth : object.width) / (document.widthMeters ?? 1);
  const depth = (object.rotation % 180 === 90 ? object.width : object.depth) / (document.heightMeters ?? 1);
  return { x: object.x - width / 2, y: object.y - depth / 2, width, height: depth };
}
export function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width - EPS && a.x + a.width > b.x + EPS && a.y < b.y + b.height - EPS && a.y + a.height > b.y + EPS;
}
function contains(a: Bounds, b: Bounds) {
  return b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.width <= a.x + a.width + EPS && b.y + b.height <= a.y + a.height + EPS;
}
export function segmentHitsRect(start: Point, end: Point, rect: Bounds) {
  const dx = end.x - start.x, dy = end.y - start.y;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, start.x - rect.x], [dx, rect.x + rect.width - start.x], [-dy, start.y - rect.y], [dy, rect.y + rect.height - start.y]]) {
    if (p === 0) { if (q < 0) return false; }
    else { const t = q / p; if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) return false; }
  }
  return true;
}
/** A concave boundary may cut through a rectangle even if all four corners fit. */
export function footprintFitsBoundary(bounds: Bounds, polygon: Point[]) {
  const corners = [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, { x: bounds.x, y: bounds.y + bounds.height }];
  if (!corners.every(point => pointInFloor(point, polygon)) || !pointInFloor({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, polygon)) return false;
  const interior = { x: bounds.x + EPS, y: bounds.y + EPS, width: bounds.width - 2 * EPS, height: bounds.height - 2 * EPS };
  return !polygon.some((a, i) => segmentHitsRect(a, polygon[(i + 1) % polygon.length], interior));
}
export function designWarnings(document: PlanDocument, locale: Locale = "en"): string[] {
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  if (!document.scaleConfirmed) return [t("Confirm the drawing scale before placing objects.")];
  const messages: string[] = [];
  const objects = document.objects ?? [], zones = document.zones ?? [];
  if (document.ceiling && document.ceiling.height < 1.8) messages.push(t("Ceiling clearance is below the 1.8 m walking body height."));
  const drawing = { x: 0, y: 0, width: 1, height: 1 };
  const checkFootprint = (item: Footprint & { label: string }) => {
    const bounds = objectBounds(item, document);
    if (!contains(drawing, bounds)) messages.push(t("{name} extends outside the drawing.", { name: item.label }));
    if (document.floorBoundary && !footprintFitsBoundary(bounds, document.floorBoundary)) messages.push(t("{name} extends outside the reviewed floor boundary.", { name: item.label }));
    return bounds;
  };
  for (const zone of zones) {
    const bounds = objectBounds(zone, document);
    // Purpose reservations are clipped to the actual floor, unlike physical objects.
    // This permits complete allocation of diagonal/concave boundaries with rectangular zones.
    if (!contains(drawing, bounds)) messages.push(t("{name} extends outside the drawing.", { name: zone.label }));
    if (document.floorBoundary && clippedFloorArea(document.floorBoundary, bounds) <= EPS)
      messages.push(t("{name} extends outside the reviewed floor boundary.", { name: zone.label }));
  }
  const byZone = new Map<string, SpaceZone>(zones.map(zone => [zone.id, zone]));
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i], a = checkFootprint(object);
    if (!dimensionsMatch(object)) messages.push(t("{name} has dimensions that do not match its model. Shown as a size box; replace or regenerate it.", { name: object.label }));
    const bottom = object.elevation ?? 0, top = bottom + object.height;
    if (document.ceiling && top > document.ceiling.height + EPS)
      messages.push(t("{name} exceeds the {status} ceiling height ({height} m).", { name: object.label, status: t(document.ceiling.status), height: document.ceiling.height }));
    if (bottom < 1.8 && zones.some(zone => zone.purpose === "circulation" && overlaps(a, objectBounds(zone, document))))
      messages.push(t("{name} obstructs a circulation space.", { name: object.label }));
    if (object.zoneId) {
      const zone = byZone.get(object.zoneId);
      if (!zone) messages.push(t("{name} references a missing space.", { name: object.label }));
      else if (!contains(objectBounds(zone, document), a)) messages.push(t("{name} extends outside its assigned space ({zone}).", { name: object.label, zone: zone.label }));
    }
    for (let j = i + 1; j < objects.length; j++) {
      const other = objects[j], otherBottom = other.elevation ?? 0;
      if (overlaps(a, objectBounds(other, document)) && bottom < otherBottom + other.height - EPS && top > otherBottom + EPS)
        messages.push(t("{name} overlaps {other}.", { name: object.label, other: other.label }));
    }
    // Existing walls occupy [0, wallHeight]. View visibility never changes checks.
    if (bottom < (document.wallHeight ?? 3) - EPS && document.lines.some(line => line.kind === "wall" && segmentHitsRect(line.a, line.b, a)))
      messages.push(t("{name} intersects a classified wall line.", { name: object.label }));
  }
  return messages;
}
