import type { DesignObject } from "./schema";
import type { DerivedWall } from "./walls";

export type WalkPoint = { x: number; y: number };
export type WalkTelemetry = WalkPoint & { blocked: boolean };
export type WalkWorld = { width: number; depth: number; walls: DerivedWall[]; objects: DesignObject[]; boundary?: WalkPoint[] };
export const WALK_RADIUS = 0.25;
export const EYE_HEIGHT = 1.65;
export function distanceToSegment(p: WalkPoint, a: WalkPoint, b: WalkPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
function inside(p: WalkPoint, polygon: WalkPoint[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
export function canStand(p: WalkPoint, world: WalkWorld, radius = WALK_RADIUS): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  if (p.x < radius || p.y < radius || p.x > world.width - radius || p.y > world.depth - radius) return false;
  if (world.boundary?.length) {
    if (!inside(p, world.boundary)) return false;
    if (world.boundary.some((a, i, points) => distanceToSegment(p, a, points[(i + 1) % points.length]) < radius)) return false;
  }
  if (world.walls.some(wall => distanceToSegment(p, wall.a, wall.b) < radius + wall.thickness / 2)) return false;
  return !world.objects.some(object => {
    const theta = object.rotation * Math.PI / 180;
    const dx = p.x - object.x * world.width, dy = p.y - object.y * world.depth;
    const x = dx * Math.cos(theta) + dy * Math.sin(theta), y = -dx * Math.sin(theta) + dy * Math.cos(theta);
    const nearestX = Math.max(Math.abs(x) - object.width / 2, 0), nearestY = Math.max(Math.abs(y) - object.depth / 2, 0);
    return Math.hypot(nearestX, nearestY) < radius;
  });
}
/** Clamp resumed/background frames and sweep in small substeps, sliding along obstacles. */
export function moveWalker(start: WalkPoint, velocity: WalkPoint, delta: number, world: WalkWorld): WalkPoint {
  if (!canStand(start, world)) return start;
  const dt = Math.min(0.05, Math.max(0, Number.isFinite(delta) ? delta : 0));
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!Number.isFinite(speed)) return start;
  const factor = speed > 3 ? 3 / speed : 1;
  const dx = velocity.x * factor * dt, dy = velocity.y * factor * dt;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.05));
  let p = { ...start };
  for (let i = 0; i < steps; i++) {
    const target = { x: p.x + dx / steps, y: p.y + dy / steps };
    if (canStand(target, world)) p = target;
    else {
      const alongX = { x: target.x, y: p.y };
      if (canStand(alongX, world)) p = alongX;
      const alongY = { x: p.x, y: target.y };
      if (canStand(alongY, world)) p = alongY;
    }
  }
  return p;
}
/** Prefer a nominated position; otherwise find a collision-safe point nearest centre. */
export function findWalkSpawn(world: WalkWorld, preferred?: WalkPoint): WalkPoint | null {
  const centre = preferred ?? { x: world.width / 2, y: world.depth / 2 };
  if (canStand(centre, world)) return centre;
  const candidates: WalkPoint[] = [];
  // Bounded search: sparse geometry does not fabricate an enclosed room.
  for (let y = 1; y < 40; y++) for (let x = 1; x < 40; x++) candidates.push({ x: x * world.width / 40, y: y * world.depth / 40 });
  candidates.sort((a, b) => Math.hypot(a.x - centre.x, a.y - centre.y) - Math.hypot(b.x - centre.x, b.y - centre.y));
  return candidates.find(p => canStand(p, world)) ?? null;
}
