import type { PlanDocument } from "./schema";
import { TOKENS } from "@/lib/ui/tokens";
import { deriveWalls } from "./walls";

type Point = { x: number; y: number };
export type EnclosureWall = { id: string; a: Point; b: Point; bottom: number; height: number };
export type Enclosure = {
  walls: EnclosureWall[];
  ceiling: { height: number; color: string; status: "estimated" | "confirmed" };
  assumedWalls: boolean;
  assumedCeiling: boolean;
};

/** Display-only room envelope; it never becomes surveyed geometry or design state.
 * Source wall spans and gaps remain intact; only an upper band above the original
 * wall height may be assumed. Otherwise unknown edges receive a surface. Door markers
 * reserve a provisional 2 m opening with 2.4 m clear height.
 */
export function deriveEnclosure(document: PlanDocument): Enclosure | null {
  const { widthMeters: width, heightMeters: depth, floorBoundary } = document;
  if (!document.scaleConfirmed || !width || !depth || !floorBoundary?.length) return null;
  const highestInstallation = (document.objects ?? []).reduce((height, object) => Math.max(height, (object.elevation ?? 0) + object.height), 0);
  const ceiling = document.ceiling ?? {
    height: Math.max(2.4, document.wallHeight ?? 4, highestInstallation + .5),
    color: TOKENS.modelShade,
    status: "estimated" as const,
  };
  const sourceWalls = deriveWalls(document, { pairParallelEdges: true });
  const boundary = floorBoundary.map(point => ({ x: point.x * width, y: point.y * depth }));
  const walls: EnclosureWall[] = [];
  boundary.forEach((a, index) => {
    const b = boundary[(index + 1) % boundary.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < .001) return;
    const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
    const along = (point: Point) => (point.x - a.x) * dx + (point.y - a.y) * dy;
    const perpendicular = (point: Point) => Math.abs((point.x - a.x) * dy - (point.y - a.y) * dx);
    const emit = (start: number, end: number, bottom = 0) => {
      if (end - start < .001 || ceiling.height - bottom < .001) return;
      walls.push({ id: `enclosure:${index}:${start}:${bottom}`,
        a: { x: a.x + dx * start, y: a.y + dy * start },
        b: { x: a.x + dx * end, y: a.y + dy * end },
        bottom, height: ceiling.height - bottom });
    };
    // Conservatively preserve known openings even when source edges are slightly
    // offset from the separately traced interior footprint.
    const evidence = sourceWalls.flatMap(wall => {
      const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
      if (wallLength < .001 || Math.abs((wall.b.x - wall.a.x) * dy - (wall.b.y - wall.a.y) * dx) / wallLength > .05) return [];
      if (perpendicular(wall.a) > .4 || perpendicular(wall.b) > .4) return [];
      const start = Math.max(0, Math.min(along(wall.a), along(wall.b)));
      const end = Math.min(length, Math.max(along(wall.a), along(wall.b)));
      return end - start > .01 ? [{ start, end }] : [];
    });
    if (evidence.length) {
      for (const wall of evidence) emit(wall.start, wall.end, document.wallHeight ?? 3);
      return;
    }
    const openings = (document.entrances ?? []).flatMap(entrance => {
      const point = { x: entrance.x * width, y: entrance.y * depth };
      const distance = along(point);
      return perpendicular(point) <= .5 && distance >= 0 && distance <= length
        ? [{ start: Math.max(0, distance - 1), end: Math.min(length, distance + 1) }] : [];
    }).sort((left, right) => left.start - right.start);
    const merged: typeof openings = [];
    for (const opening of openings) {
      const previous = merged.at(-1);
      if (previous && opening.start <= previous.end) previous.end = Math.max(previous.end, opening.end);
      else merged.push({ ...opening });
    }
    let cursor = 0;
    for (const opening of merged) {
      emit(cursor, opening.start);
      emit(opening.start, opening.end, 2.4);
      cursor = opening.end;
    }
    emit(cursor, length);
  });
  return { walls, ceiling, assumedWalls: walls.length > 0, assumedCeiling: !document.ceiling };
}
