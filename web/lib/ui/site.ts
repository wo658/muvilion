/** Site geometry helpers shared by the 2D plan and the 3D scene (hall coordinates, y up). */
import type { Door, Venue } from "@/lib/engine/contract";

export type Segment = { a: [number, number]; b: [number, number] };

/** Boundary pieces (walls indoors, fence outdoors) with gaps where doors/gates are. */
export function wallSegments(venue: Pick<Venue, "width" | "height" | "doors">): Segment[] {
  const W = venue.width;
  const H = venue.height;
  const eps = 1e-6;
  const edges: { fixed: "x" | "y"; at: number; len: number }[] = [
    { fixed: "y", at: 0, len: W },
    { fixed: "y", at: H, len: W },
    { fixed: "x", at: 0, len: H },
    { fixed: "x", at: W, len: H },
  ];
  const out: Segment[] = [];
  for (const e of edges) {
    const gaps = venue.doors
      .filter((d) => (e.fixed === "y" ? Math.abs(d.a.y - e.at) < eps && Math.abs(d.b.y - e.at) < eps : Math.abs(d.a.x - e.at) < eps && Math.abs(d.b.x - e.at) < eps))
      .map((d) => (e.fixed === "y" ? [Math.min(d.a.x, d.b.x), Math.max(d.a.x, d.b.x)] : [Math.min(d.a.y, d.b.y), Math.max(d.a.y, d.b.y)]))
      .sort((p, q) => p[0] - q[0]);
    let s = 0;
    for (const [g0, g1] of [...gaps, [e.len, e.len]]) {
      if (g0 - s > eps) out.push(e.fixed === "y" ? { a: [s, e.at], b: [g0, e.at] } : { a: [e.at, s], b: [e.at, g0] });
      s = Math.max(s, g1);
    }
  }
  return out;
}

/** Unit vector pointing from a boundary door into the site. */
export function inwardNormal(d: Door, venue: Pick<Venue, "width" | "height">): { x: number; y: number } {
  const m = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
  const dist = [m.y, venue.height - m.y, m.x, venue.width - m.x];
  return [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ][dist.indexOf(Math.min(...dist))];
}

export const DOOR_LABEL: Record<Door["kind"], string> = { entrance: "Entrance", exit: "Exit", emergency: "Emergency" };
