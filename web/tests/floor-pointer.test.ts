import { describe, expect, it } from "vitest";
import { pointInFloor } from "@/lib/plans/footprint";

describe("purpose-zone pointer clipping", () => {
  const floor = [{x:0,y:0},{x:1,y:0},{x:1,y:.4},{x:.4,y:.4},{x:.4,y:1},{x:0,y:1}];
  it("keeps both arms and the perimeter selectable but ignores the concave missing floor", () => {
    expect(pointInFloor({x:.2,y:.8},floor)).toBe(true);
    expect(pointInFloor({x:.8,y:.2},floor)).toBe(true);
    expect(pointInFloor({x:.4,y:.8},floor)).toBe(true);
    expect(pointInFloor({x:.4,y:.4},floor)).toBe(true);
    expect(pointInFloor({x:.8,y:.8},floor)).toBe(false);
    expect(pointInFloor({x:-.01,y:.2},floor)).toBe(false);
  });
  it("uses the diagonal edge rather than its bounding rectangle", () => {
    const triangle = [{x:0,y:0},{x:1,y:0},{x:0,y:1}];
    expect(pointInFloor({x:.2,y:.2},triangle)).toBe(true);
    expect(pointInFloor({x:.5,y:.5},triangle)).toBe(true);
    expect(pointInFloor({x:.8,y:.8},triangle)).toBe(false);
    expect(pointInFloor({x:.2,y:.2},triangle.toReversed())).toBe(true);
  });
});
