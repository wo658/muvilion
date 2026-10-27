"""Shared Shapely helpers used by layout, validation and simulation."""

from __future__ import annotations

from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

from app.schemas import Booth, Door, Obstacle, Rect, Venue, Zone


def footprint_size(booth: Booth) -> tuple[float, float]:
    """Footprint (w, h) on the floor; rotation 90 swaps the spec's w and h."""
    return (booth.h, booth.w) if booth.rotation == 90 else (booth.w, booth.h)


def booth_polygon(booth: Booth) -> Polygon:
    w, h = footprint_size(booth)
    return box(booth.x, booth.y, booth.x + w, booth.y + h)


def hall_polygon(venue: Venue) -> Polygon:
    return box(0.0, 0.0, venue.width, venue.height)


def inner_hall(venue: Venue, margin: float) -> Polygon:
    return box(margin, margin, venue.width - margin, venue.height - margin)


def obstacle_polygon(obstacle: Obstacle) -> Polygon:
    poly = Polygon([(p.x, p.y) for p in obstacle.polygon])
    return poly if poly.is_valid else poly.buffer(0)


def zone_polygon(zone: Zone) -> Polygon:
    poly = Polygon([(p.x, p.y) for p in zone.polygon])
    return poly if poly.is_valid else poly.buffer(0)


def rect_polygon(rect: Rect) -> Polygon:
    return box(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)


def door_segment(door: Door) -> LineString:
    return LineString([(door.a.x, door.a.y), (door.b.x, door.b.y)])


def inward_normal(venue: Venue, door: Door) -> tuple[float, float]:
    """Unit vector pointing from the door segment into the hall."""
    mx, my = (door.a.x + door.b.x) / 2, (door.a.y + door.b.y) / 2
    candidates = {
        (0.0, 1.0): my,  # bottom wall
        (0.0, -1.0): venue.height - my,  # top wall
        (1.0, 0.0): mx,  # left wall
        (-1.0, 0.0): venue.width - mx,  # right wall
    }
    return min(candidates, key=candidates.get)


def door_clearance_zone(
    venue: Venue, door: Door, depth: float, side_pad: float = 0.0
) -> Polygon | None:
    """Rectangle extending `depth` meters into the hall from the door.

    The rectangle is the door's width widened by `side_pad` on both ends, so a door narrower
    than the aisle still gets an approach corridor that is at least aisle-wide.
    """
    if depth <= 0:
        return None
    nx, ny = inward_normal(venue, door)
    tx, ty = door.b.x - door.a.x, door.b.y - door.a.y
    length = (tx * tx + ty * ty) ** 0.5 or 1.0
    tx, ty = tx / length * side_pad, ty / length * side_pad
    a, b = (door.a.x - tx, door.a.y - ty), (door.b.x + tx, door.b.y + ty)
    poly = Polygon(
        [a, b, (b[0] + nx * depth, b[1] + ny * depth), (a[0] + nx * depth, a[1] + ny * depth)]
    )
    return poly.intersection(hall_polygon(venue))


def clearance_zones(venue: Venue, depth: float, aisle: float) -> dict[str, Polygon]:
    zones = {}
    for door in venue.doors:
        zone = door_clearance_zone(venue, door, depth, side_pad=aisle / 2)
        if zone is not None and not zone.is_empty:
            zones[door.id] = zone
    return zones


def blocked_union(venue: Venue, booths: list[Booth]) -> Polygon:
    return unary_union(
        [booth_polygon(b) for b in booths] + [obstacle_polygon(o) for o in venue.obstacles]
    )
