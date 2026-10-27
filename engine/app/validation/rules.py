"""Geometry rule checks. Each rule is a small function returning a list of violations."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from itertools import combinations

from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from app.geometry import (
    blocked_union,
    booth_polygon,
    clearance_zones,
    door_segment,
    hall_polygon,
    inner_hall,
    obstacle_polygon,
    rect_polygon,
    zone_polygon,
)
from app.schemas import (
    Booth,
    LayoutConstraints,
    Point,
    ValidateRequest,
    ValidateResponse,
    Venue,
    Violation,
)

EPS = 1e-6
SOURCE = "internal:geometry"
# Zone rules come from the site plan's zone designations, not from a building code.
ZONE_SOURCE = "venue:zones"
CONNECTIVITY_SLACK = 0.05


@dataclass
class Ctx:
    venue: Venue
    booths: list[Booth]
    c: LayoutConstraints
    polys: dict[str, Polygon]


def _boundary(venue: Venue) -> tuple[str, str]:
    """Words for the site and its boundary in messages."""
    return ("site", "fence") if venue.setting == "outdoor" else ("hall", "wall")


def _at(geom) -> Point:
    p = geom.representative_point() if not geom.is_empty else None
    return Point(x=round(p.x, 3), y=round(p.y, 3)) if p is not None else None


def booth_overlap(ctx: Ctx) -> list[Violation]:
    out = []
    for a, b in combinations(ctx.booths, 2):
        inter = ctx.polys[a.id].intersection(ctx.polys[b.id])
        if inter.area > EPS:
            out.append(
                Violation(
                    rule_id="booth_overlap",
                    severity="error",
                    message=f"{a.id} overlaps {b.id} by {inter.area:.2f} m²",
                    booth_ids=[a.id, b.id],
                    location=_at(inter),
                    source=SOURCE,
                )
            )
    return out


def booth_outside_hall(ctx: Ctx) -> list[Violation]:
    hall = hall_polygon(ctx.venue).buffer(EPS)
    inner = inner_hall(ctx.venue, ctx.c.wall_margin).buffer(EPS)
    out = []
    for b in ctx.booths:
        poly = ctx.polys[b.id]
        if not hall.contains(poly):
            out.append(
                Violation(
                    rule_id="booth_outside_hall",
                    severity="error",
                    message=f"{b.id} extends outside the {_boundary(ctx.venue)[0]}",
                    booth_ids=[b.id],
                    location=_at(poly.difference(hall)),
                    source=SOURCE,
                )
            )
        elif not inner.contains(poly):
            out.append(
                Violation(
                    rule_id="wall_margin",
                    severity="warning",
                    message=(
                        f"{b.id} is closer than {ctx.c.wall_margin} m to the "
                        f"{_boundary(ctx.venue)[1]}"
                    ),
                    booth_ids=[b.id],
                    location=_at(poly.difference(inner)),
                    source=SOURCE,
                )
            )
    return out


def booth_over_obstacle(ctx: Ctx) -> list[Violation]:
    out = []
    for o in ctx.venue.obstacles:
        opoly = obstacle_polygon(o)
        for b in ctx.booths:
            inter = ctx.polys[b.id].intersection(opoly)
            if inter.area > EPS:
                out.append(
                    Violation(
                        rule_id="booth_over_obstacle",
                        severity="error",
                        message=f"{b.id} overlaps {o.kind} {o.id}",
                        booth_ids=[b.id],
                        location=_at(inter),
                        source=SOURCE,
                    )
                )
    return out


def zone_unbuildable(ctx: Ctx) -> list[Violation]:
    out = []
    for z in ctx.venue.zones:
        if z.buildable:
            continue
        zpoly = zone_polygon(z)
        for b in ctx.booths:
            inter = ctx.polys[b.id].intersection(zpoly)
            if inter.area > EPS:
                out.append(
                    Violation(
                        rule_id="zone_unbuildable",
                        severity="error",
                        message=(
                            f"{b.id} is placed on unbuildable {z.kind.replace('_', ' ')} "
                            f"{z.id} ({inter.area:.2f} m²)"
                        ),
                        booth_ids=[b.id],
                        location=_at(inter),
                        source=f"{ZONE_SOURCE}/{z.id}",
                    )
                )
    return out


def fire_lane_blocked(ctx: Ctx) -> list[Violation]:
    """Each fire lane must stay clear over its full width from one end to the other.

    The lane minus booths and obstacles is eroded by half the lane width (less a slack); a
    vehicle as wide as the lane can drive end to end only if one piece of what remains spans
    both ends. Lanes are taken along the long side of their bounding box. Anything intruding
    more than the slack into the lane cuts it.
    """
    out = []
    for z in ctx.venue.zones:
        if z.kind != "fire_lane":
            continue
        lane = zone_polygon(z)
        x0, y0, x1, y1 = lane.bounds
        horizontal = x1 - x0 >= y1 - y0
        half = (min(x1 - x0, y1 - y0) / 2) - CONNECTIVITY_SLACK
        ends = (
            (box(x0, y0, x0, y1), box(x1, y0, x1, y1))
            if horizontal
            else (box(x0, y0, x1, y0), box(x0, y1, x1, y1))
        )
        blockers = {b.id: ctx.polys[b.id] for b in ctx.booths}
        blockers |= {o.id: obstacle_polygon(o) for o in ctx.venue.obstacles}
        hits = {k: p for k, p in blockers.items() if p.intersection(lane).area > EPS}
        clear = lane.difference(unary_union(list(hits.values()))) if hits else lane
        core = clear.buffer(-half)
        tol = half + 2 * CONNECTIVITY_SLACK
        spans = any(
            all(part.distance(end) <= tol for end in ends)
            for part in getattr(core, "geoms", [core])
            if not part.is_empty
        )
        if spans:
            continue
        booth_ids = sorted(k for k in hits if k in ctx.polys)
        what = ", ".join(sorted(hits)) or "its own shape"
        out.append(
            Violation(
                rule_id="fire_lane_blocked",
                severity="error",
                message=(
                    f"Fire lane {z.id} is not clear over its full "
                    f"{min(x1 - x0, y1 - y0):g} m width end to end (blocked by {what})"
                ),
                booth_ids=booth_ids,
                location=_at(unary_union(list(hits.values())).intersection(lane))
                if hits
                else _at(lane),
                source=f"{ZONE_SOURCE}/{z.id}",
            )
        )
    return out


def door_clearance(ctx: Ctx) -> list[Violation]:
    out = []
    zones = clearance_zones(ctx.venue, ctx.c.door_clearance, ctx.c.min_aisle_width)
    for door_id, zone in zones.items():
        for b in ctx.booths:
            inter = ctx.polys[b.id].intersection(zone)
            if inter.area > EPS:
                out.append(
                    Violation(
                        rule_id="door_clearance",
                        severity="error",
                        message=(
                            f"{b.id} blocks the {ctx.c.door_clearance} m clearance "
                            f"in front of door {door_id}"
                        ),
                        booth_ids=[b.id],
                        location=_at(inter),
                        source=SOURCE,
                    )
                )
    return out


def keep_out(ctx: Ctx) -> list[Violation]:
    out = []
    for i, rect in enumerate(ctx.c.keep_out):
        rpoly = rect_polygon(rect)
        for b in ctx.booths:
            inter = ctx.polys[b.id].intersection(rpoly)
            if inter.area > EPS:
                out.append(
                    Violation(
                        rule_id="keep_out",
                        severity="error",
                        message=f"{b.id} overlaps keep-out area #{i}",
                        booth_ids=[b.id],
                        location=_at(inter),
                        source=SOURCE,
                    )
                )
    return out


def aisle_width(ctx: Ctx) -> list[Violation]:
    out = []
    min_w = ctx.c.min_aisle_width
    for a, b in combinations(ctx.booths, 2):
        pa, pb = ctx.polys[a.id], ctx.polys[b.id]
        if pa.intersection(pb).area > EPS:
            continue  # reported by booth_overlap
        d = pa.distance(pb)
        if d < min_w - EPS:
            gap = unary_union([pa, pb]).convex_hull.difference(pa).difference(pb)
            out.append(
                Violation(
                    rule_id="aisle_width",
                    severity="error",
                    message=f"Aisle between {a.id} and {b.id} is {d:.2f} m (< {min_w} m)",
                    booth_ids=[a.id, b.id],
                    location=_at(gap) if not gap.is_empty else None,
                    source=SOURCE,
                )
            )
    return out


def connectivity(ctx: Ctx) -> list[Violation]:
    """Every booth and every exit must be reachable from an entrance through aisle-wide space.

    The hall is eroded and booths/obstacles are inflated by half the aisle width; whatever
    remains is the set of positions an aisle-wide "disc" can occupy. Components of that set
    touching an entrance are the reachable region. A small slack keeps aisles of exactly the
    minimum width from collapsing into zero-area slivers. Zones (lawn, fire lane, ...) are
    walkable ground and never block; on an outdoor site the doors are gates in the fence.
    """
    half = ctx.c.min_aisle_width / 2 - CONNECTIVITY_SLACK
    hall = hall_polygon(ctx.venue)
    free = hall.buffer(-half).difference(blocked_union(ctx.venue, ctx.booths).buffer(half))
    parts = list(getattr(free, "geoms", [free]))
    reach_tol = half + 2 * CONNECTIVITY_SLACK

    def touching(geom) -> list[Polygon]:
        probe = geom.buffer(reach_tol)
        return [p for p in parts if not p.is_empty and p.intersects(probe)]

    entrances = [d for d in ctx.venue.doors if d.kind == "entrance"]
    if not entrances:
        return [
            Violation(
                rule_id="connectivity",
                severity="warning",
                message="Venue has no entrance; connectivity not checked",
                source=SOURCE,
            )
        ]
    reachable = unary_union([p for d in entrances for p in touching(door_segment(d))])

    out = []
    if reachable.is_empty:
        return [
            Violation(
                rule_id="entrance_blocked",
                severity="error",
                message="No aisle-wide free space connects to any entrance",
                source=SOURCE,
            )
        ]
    for b in ctx.booths:
        if not ctx.polys[b.id].buffer(reach_tol).intersects(reachable):
            out.append(
                Violation(
                    rule_id="booth_unreachable",
                    severity="error",
                    message=(
                        f"{b.id} cannot be reached from an entrance through an aisle of "
                        f"at least {ctx.c.min_aisle_width} m"
                    ),
                    booth_ids=[b.id],
                    location=_at(ctx.polys[b.id]),
                    source=SOURCE,
                )
            )
    for d in ctx.venue.doors:
        if d.kind == "entrance":
            continue
        seg = door_segment(d)
        if not seg.buffer(reach_tol).intersects(reachable):
            out.append(
                Violation(
                    rule_id="door_unreachable",
                    severity="error",
                    message=(
                        f"{d.kind} door {d.id} cannot be reached from an entrance through an "
                        f"aisle of at least {ctx.c.min_aisle_width} m"
                    ),
                    location=_at(seg),
                    source=SOURCE,
                )
            )
    return out


RULES: list[Callable[[Ctx], list[Violation]]] = [
    booth_overlap,
    booth_outside_hall,
    booth_over_obstacle,
    zone_unbuildable,
    fire_lane_blocked,
    door_clearance,
    keep_out,
    aisle_width,
    connectivity,
]


def validate(req: ValidateRequest) -> ValidateResponse:
    booths = req.layout.booths
    ctx = Ctx(req.venue, booths, req.constraints, {b.id: booth_polygon(b) for b in booths})
    violations = [v for rule in RULES for v in rule(ctx)]
    return ValidateResponse(
        ok=not any(v.severity == "error" for v in violations), violations=violations
    )
