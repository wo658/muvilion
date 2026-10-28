import { describe, expect, it } from "vitest";
import { canStand, findWalkSpawn, moveWalker, type WalkWorld } from "../lib/plans/walk";
import type { DerivedWall } from "../lib/plans/walls";
const wall = (ax: number, ay: number, bx: number, by: number): DerivedWall => ({ id: "wall", evidenceIds: ["line"], a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: .16, thicknessSource: "provisional" });
const world = (walls: DerivedWall[] = []): WalkWorld => ({ width: 10, depth: 10, walls, objects: [] });
describe("interior walk collision", () => {
  it("cannot tunnel across a thin wall even after a background frame", () => {
    const room = world([wall(5, 0, 5, 10)]);
    let p = { x: 4, y: 5 };
    for (let i = 0; i < 50; i++) p = moveWalker(p, { x: 100, y: 0 }, 30, room);
    expect(p.x).toBeLessThanOrEqual(4.67); expect(canStand(p, room)).toBe(true);
  });
  it("slides along diagonal walls without crossing them", () => {
    const room = world([wall(0, 0, 10, 10)]);
    let p = { x: 3, y: 5 };
    for (let i = 0; i < 80; i++) p = moveWalker(p, { x: 2, y: 1 }, .05, room);
    expect(p.y - p.x).toBeGreaterThan(.46); expect(p.x).toBeGreaterThan(3);
  });
  it("passes a real door opening but rejects an opening narrower than the body", () => {
    const open = world([wall(5, 0, 5, 4.5), wall(5, 5.5, 5, 10)]);
    let p = { x: 4, y: 5 };
    for (let i = 0; i < 20; i++) p = moveWalker(p, { x: 2.5, y: 0 }, .05, open);
    expect(p.x).toBeGreaterThan(6);
    expect(canStand({ x: 5, y: 5 }, world([wall(5, 0, 5, 4.9), wall(5, 5.1, 5, 10)]))).toBe(false);
  });
  it("respects rotated object footprint and drawing edge clearance", () => {
    const room = world(); room.objects = [{ id: "stage", kind: "stage", label: "Stage", x: .5, y: .5, width: 4, depth: 1, height: .2, rotation: 90, color: "#ffffff" }];
    expect(canStand({ x: 5, y: 6.8 }, room)).toBe(false); expect(canStand({ x: 6, y: 5 }, room)).toBe(true);
    expect(canStand({ x: .1, y: 5 }, room)).toBe(false);
  });
  it("constrains a concave footprint without inventing walls", () => {
    const room = world(); room.boundary = [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 9 }, { x: 1, y: 9 }];
    expect(canStand({ x: 6, y: 6 }, room)).toBe(false); expect(canStand({ x: 2, y: 6 }, room)).toBe(true);
    expect(canStand({ x: 4.1, y: 3.9 }, room)).toBe(false);
  });
  it("finds a safe spawn when the centre is blocked and explicitly fails full obstruction", () => {
    const room = world([wall(5, 0, 5, 10)]); const spawn = findWalkSpawn(room);
    expect(spawn).not.toBeNull(); expect(canStand(spawn!, room)).toBe(true);
    room.objects = [{ id: "all", kind: "stage", label: "All", x: .5, y: .5, width: 10, depth: 10, height: 1, rotation: 0, color: "#ffffff" }];
    expect(findWalkSpawn(room)).toBeNull();
  });
  it("clamps resumed frames and rejects invalid input", () => {
    expect(moveWalker({ x: 2, y: 2 }, { x: 2, y: 0 }, 5, world()).x).toBeCloseTo(2.1);
    expect(moveWalker({ x: 2, y: 2 }, { x: NaN, y: 0 }, .1, world())).toEqual({ x: 2, y: 2 });
  });
});
