import type { PlanDocument, WallSurface } from "./schema";
import { deriveWalls, type DerivedWall } from "./walls";

/** Metre-space frame; no geometry mutation or collision exemption is needed for a finish. */
export function wallSurfaceFrame(document: PlanDocument, surface: WallSurface, walls?: DerivedWall[]) {
  if (!document.widthMeters || !document.heightMeters) return null;
  let x: number, y: number, length: number, height: number, bottom: number, thickness: number, angle: number;
  if (surface.hostType === "wall") {
    const line = document.lines.find(line => line.id === surface.hostId && line.kind === "wall");
    if (!line) return null;
    const dx = (line.b.x - line.a.x) * document.widthMeters, dy = (line.b.y - line.a.y) * document.heightMeters;
    length = Math.hypot(dx, dy); if (length < .001) return null;
    angle = Math.atan2(dy, dx);
    x = (line.a.x + line.b.x) * document.widthMeters / 2;
    y = (line.a.y + line.b.y) * document.heightMeters / 2;
    height = document.wallHeight ?? 3; bottom = 0;
    const derived = (walls ?? deriveWalls(document, { pairParallelEdges: true })).find(wall => wall.evidenceIds.includes(line.id));
    thickness = derived?.thickness ?? .16;
    // Parallel source edges are rendered as one wall; move only the normal component onto its centre.
    if (derived) {
      const normalShift = -Math.sin(angle) * ((derived.a.x + derived.b.x) / 2 - x) + Math.cos(angle) * ((derived.a.y + derived.b.y) / 2 - y);
      x -= Math.sin(angle) * normalShift; y += Math.cos(angle) * normalShift;
    }
  } else {
    const host = document.objects?.find(object => object.id === surface.hostId && object.kind === "partition");
    if (!host) return null;
    x = host.x * document.widthMeters; y = host.y * document.heightMeters;
    length = host.width; height = host.height; bottom = host.elevation ?? 0;
    thickness = host.depth; angle = host.rotation * Math.PI / 180;
  }
  const sign = surface.side === "front" ? 1 : -1;
  const along = ((surface.start + surface.end) / 2 - .5) * length;
  const offset = sign * (thickness / 2 + .006);
  return {
    x: x + Math.cos(angle) * along - Math.sin(angle) * offset,
    y: y + Math.sin(angle) * along + Math.cos(angle) * offset,
    elevation: bottom + surface.elevation, width: (surface.end - surface.start) * length,
    height: surface.height, hostHeight: height, hostBottom: bottom,
    angle: angle + (sign < 0 ? Math.PI : 0),
  };
}

export function wallSurfaceIssues(document: PlanDocument): string[] {
  const walls = document.wallSurfaces?.some(surface => surface.hostType === "wall") ? deriveWalls(document, { pairParallelEdges: true }) : [];
  return (document.wallSurfaces ?? []).flatMap(surface => {
    const frame = wallSurfaceFrame(document, surface, walls);
    if (!frame) return [`${surface.label}: wall surface references a missing wall or partition (${surface.hostId}).`];
    if (surface.elevation + surface.height > frame.hostHeight + .001)
      return [`${surface.label}: wall surface extends above its host (${frame.hostHeight} m).`];
    if (document.ceiling && frame.elevation + frame.height > document.ceiling.height + .001)
      return [`${surface.label}: wall surface extends above the ceiling.`];
    return [];
  });
}
