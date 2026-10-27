/**
 * THE hall → three.js world mapping (used by every 3D component; keep it in this one place).
 *
 *   hall (x, y) meters, origin = hall bottom-left, x right, y up (engine convention)
 *   world = (x, height, -y)        three.js, y up; the floor is the XZ plane at world y = 0
 *
 * So hall +x is world +x, hall +y is world -z (away from a camera placed at +z), and the hall's
 * bottom edge (y = 0, typically the entrance side) is nearest a default "front" camera.
 * A PlaneGeometry rotated by -PI/2 about X maps its local (u, v) to world (u, 0, -v), i.e.
 * local v = hall y, so DataTexture row 0 (v = 0) is hall y = 0 — matching DensityGrid row order.
 */
export function toWorld(x: number, y: number, h = 0): [number, number, number] {
  return [x, h, -y];
}

/** Hall center in world coordinates (orbit target). */
export function hallCenter(width: number, height: number): [number, number, number] {
  return toWorld(width / 2, height / 2);
}
