"""Reusable walkable-area geometry for layout and accessibility checks."""

from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Point as SPoint
from shapely.geometry import Polygon

from app.geometry import (
    blocked_union,
    door_segment,
    footprint_size,
    hall_polygon,
    inward_normal,
)
from app.schemas import Booth, Door, Layout, Venue

AGENT_CLEARANCE = 0.3  # min distance of a spawn/target point to any wall
FRONT_OFFSET = 0.8  # booth "front" waypoints sit this far outside the booth edge
FRONT_PROBE = 2.0  # a side counts as an open front if this depth in front of it is walkable
EXIT_DEPTH = 0.6
MIN_GAP_HALF = 0.35


@dataclass
class DoorGeometry:
    door: Door
    exit_polygon: Polygon | None  # region inside the hall that removes agents
    approach: tuple[float, float] | None  # walkable point just inside the door


def _polygons(geom) -> list[Polygon]:
    parts = getattr(geom, "geoms", [geom])
    return [p for p in parts if isinstance(p, Polygon) and not p.is_empty]


def _largest(parts: list[Polygon]) -> Polygon:
    return max(parts, key=lambda p: p.area) if parts else Polygon()


def build_walkable(venue: Venue, layout: Layout) -> Polygon:
    """Hall (or outdoor site) minus booths and obstacles.

    Zones are walkable ground, unbuildable ones included (a fire lane or stage-front lawn is
    where people walk), so they are not subtracted. On an outdoor site the doors are the
    fence gates; entrances, exits and spawn strips work exactly as indoor doors do.
    If booths split the floor into disconnected pieces, the piece next to an entrance (or the
    largest piece) is kept; agents cannot reach the others anyway.
    """
    free = hall_polygon(venue).difference(blocked_union(venue, layout.booths))
    # Morphological opening drops gaps narrower than 2*MIN_GAP_HALF (e.g. a booth 0.4 m from a
    # column); the navmesh would route agents into them and they would get stuck.
    free = free.buffer(-MIN_GAP_HALF, join_style="mitre").buffer(MIN_GAP_HALF, join_style="mitre")
    parts = _polygons(free)
    entrances = [door_segment(d) for d in venue.doors if d.kind == "entrance"]
    touching = [p for p in parts if any(p.distance(e) < 0.5 for e in entrances)]
    return _largest(touching or parts)


def is_open(walkable: Polygon, x: float, y: float, clearance: float = AGENT_CLEARANCE) -> bool:
    return walkable.contains(SPoint(x, y).buffer(clearance, quad_segs=4))


def booth_front_points(booth: Booth, walkable: Polygon) -> list[tuple[float, float]]:
    """Visitor standing points along the booth's open sides (3 per side)."""
    w, h = footprint_size(booth)
    x0, y0, x1, y1 = booth.x, booth.y, booth.x + w, booth.y + h
    sides = [
        ((x0, y0), (x1, y0), (0.0, -1.0)),
        ((x1, y0), (x1, y1), (1.0, 0.0)),
        ((x0, y1), (x1, y1), (0.0, 1.0)),
        ((x0, y0), (x0, y1), (-1.0, 0.0)),
    ]
    open_pts: list[tuple[float, float]] = []
    any_pts: list[tuple[float, float]] = []
    for (ax, ay), (bx, by), (nx, ny) in sides:
        mx, my = (ax + bx) / 2, (ay + by) / 2
        is_front = is_open(walkable, mx + nx * FRONT_PROBE, my + ny * FRONT_PROBE)
        for t in (0.25, 0.5, 0.75):
            px = ax + (bx - ax) * t + nx * FRONT_OFFSET
            py = ay + (by - ay) * t + ny * FRONT_OFFSET
            if is_open(walkable, px, py):
                (open_pts if is_front else any_pts).append((px, py))
    return open_pts or any_pts


def door_geometry(venue: Venue, door: Door, walkable: Polygon) -> DoorGeometry:
    nx, ny = inward_normal(venue, door)
    a, b = (door.a.x, door.a.y), (door.b.x, door.b.y)
    strip = Polygon(
        [
            a,
            b,
            (b[0] + nx * EXIT_DEPTH, b[1] + ny * EXIT_DEPTH),
            (a[0] + nx * EXIT_DEPTH, a[1] + ny * EXIT_DEPTH),
        ]
    )
    exit_poly = _largest(_polygons(strip.intersection(walkable)))
    if exit_poly.is_empty or exit_poly.area < 0.1:
        return DoorGeometry(door, None, None)
    exit_poly = Polygon(exit_poly.exterior)
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    approach = None
    for depth in (1.0, 1.5, 2.0, 3.0):
        px, py = mx + nx * depth, my + ny * depth
        if is_open(walkable, px, py):
            approach = (px, py)
            break
    return DoorGeometry(door, exit_poly, approach)
