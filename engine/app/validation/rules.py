"""Geometry rule checks. Each rule is a small function returning a list of violations."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from itertools import combinations

from shapely.geometry import Polygon
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
CONNECTIVITY_SLACK = 0.05


@dataclass
class Ctx:
    venue: Venue
    booths: list[Booth]
    c: LayoutConstraints
    polys: dict[str, Polygon]


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
                    message=f"{b.id} extends outside the hall",
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
                    message=f"{b.id} is closer than {ctx.c.wall_margin} m to a wall",
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
    minimum width from collapsing into zero-area slivers.
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
