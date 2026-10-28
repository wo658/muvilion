"""CP-SAT booth placement on a regular grid.

All coordinates are converted to integer grid units (`GRID` meters per unit). Each booth gets
an integer bottom-left corner and, for non-square booths, a rotation flag. Aisles are enforced
by padding every booth's interval by the aisle width on its right/top side and putting the
padded rectangles in one NoOverlap2D: any two booths are then at least one aisle apart along
x or y. Static areas (obstacle bounding boxes, keep-out rects, door clearance zones) are
avoided with a four-way disjunction per booth, which tolerates static areas overlapping each
other (NoOverlap2D would not).
"""

from __future__ import annotations

import hashlib
import math
import time
from dataclasses import dataclass

from ortools.sat.python import cp_model

from app.geometry import clearance_zones, door_segment, obstacle_polygon, zone_polygon
from app.schemas import Booth, BoothSpec, Layout, LayoutRequest, LayoutResponse

GRID = 0.5
DISPLACEMENT_WEIGHT = 20
ROTATION_CHANGE_PENALTY = 10
SPINE_WEIGHT = 4


@dataclass
class _BoothVars:
    spec: BoothSpec
    x: cp_model.IntVar
    y: cp_model.IntVar
    rot: cp_model.IntVar | None
    fx: cp_model.LinearExprT  # footprint width in grid units
    fy: cp_model.LinearExprT


def _units(v: float) -> int:
    return round(v / GRID)


def _grid_box(bounds: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    """Outward-rounded bounding box in grid units."""
    x0, y0, x1, y1 = bounds
    return (
        math.floor(x0 / GRID + 1e-9),
        math.floor(y0 / GRID + 1e-9),
        math.ceil(x1 / GRID - 1e-9),
        math.ceil(y1 / GRID - 1e-9),
    )


def _static_areas(req: LayoutRequest) -> list[tuple[int, int, int, int]]:
    c = req.constraints
    areas = [_grid_box(obstacle_polygon(o).bounds) for o in req.venue.obstacles]
    areas += [_grid_box((r.x, r.y, r.x + r.w, r.y + r.h)) for r in c.keep_out]
    areas += [_grid_box(zone_polygon(z).bounds) for z in req.venue.zones if not z.buildable]
    zones = clearance_zones(req.venue, c.door_clearance, c.min_aisle_width)
    areas += [_grid_box(z.bounds) for z in zones.values()]
    return areas


def _attractor(req: LayoutRequest) -> tuple[int, int, int, int]:
    """Doubled attractor point (cx2, cy2) and per-axis weights for the compactness term.

    Default: the hall center with equal weights (booths cluster in the middle). When the venue
    has a fire lane, booths line it instead: the attractor is the lane's center and distance
    across the lane costs SPINE_WEIGHT times more than along it, which yields rows of booths
    fronting the lane on both sides rather than a blob around the site center.
    """
    W, H = _units(req.venue.width), _units(req.venue.height)
    lanes = [zone_polygon(z) for z in req.venue.zones if z.kind == "fire_lane"]
    if not lanes:
        return W, H, 1, 1
    x0, y0, x1, y1 = max(lanes, key=lambda p: p.area).bounds
    cx2, cy2 = round((x0 + x1) / GRID), round((y0 + y1) / GRID)
    if x1 - x0 >= y1 - y0:  # east-west lane: pull booths toward it in y
        return cx2, cy2, 1, SPINE_WEIGHT
    return cx2, cy2, SPINE_WEIGHT, 1


def _popular_areas(req: LayoutRequest) -> list[tuple[int, int, int, int]]:
    d = req.constraints.popular_door_distance
    if d <= 0:
        return []
    return [
        _grid_box(door_segment(door).buffer(d, cap_style="square").bounds)
        for door in req.venue.doors
        if door.kind == "entrance"
    ]


def _padded_interval(
    model: cp_model.CpModel, start: cp_model.IntVar, size, aisle: int, limit: int
) -> cp_model.IntervalVar:
    """Interval [start, start + size + aisle); `size` may depend on the rotation flag."""
    if isinstance(size, int):
        return model.new_interval_var(start, size + aisle, start + size + aisle, "")
    # A rotating booth's end is start + rot * k + c, which is not affine in one variable.
    end = model.new_int_var(0, limit + aisle, "")
    return model.new_interval_var(start, size + aisle, end, "")


def _avoid(model: cp_model.CpModel, bv: _BoothVars, area: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = area
    sides = [model.new_bool_var("") for _ in range(4)]
    model.add(bv.x + bv.fx <= x0).only_enforce_if(sides[0])
    model.add(bv.x >= x1).only_enforce_if(sides[1])
    model.add(bv.y + bv.fy <= y0).only_enforce_if(sides[2])
    model.add(bv.y >= y1).only_enforce_if(sides[3])
    model.add_bool_or(sides)


def _booths(value, vars_: list[_BoothVars]) -> list[Booth]:
    """Booths of the final solution, read using solver.value."""
    return [
        Booth(
            id=bv.spec.id,
            x=value(bv.x) * GRID,
            y=value(bv.y) * GRID,
            w=bv.spec.w,
            h=bv.spec.h,
            rotation=90 if bv.rot is not None and value(bv.rot) else 0,
        )
        for bv in vars_
    ]


def _layout_id(venue_id: str, booths: list[Booth]) -> str:
    key = venue_id + ";" + ";".join(f"{b.id},{b.x},{b.y},{b.rotation}" for b in booths)
    return "L-" + hashlib.sha1(key.encode()).hexdigest()[:10]


def solve_layout(req: LayoutRequest) -> LayoutResponse:
    t0 = time.perf_counter()
    c = req.constraints
    W, H = _units(req.venue.width), _units(req.venue.height)
    m = math.ceil(c.wall_margin / GRID - 1e-9)
    aisle = math.ceil(c.min_aisle_width / GRID - 1e-9)
    prev = {b.id: b for b in req.previous.booths} if req.previous else {}

    model = cp_model.CpModel()
    cx2, cy2, wx, wy = _attractor(req)
    padded_x, padded_y, objective = [], [], []
    static = _static_areas(req)
    popular = _popular_areas(req)
    vars_: list[_BoothVars] = []

    for spec in req.booths:
        gw, gh = math.ceil(spec.w / GRID - 1e-9), math.ceil(spec.h / GRID - 1e-9)
        x = model.new_int_var(m, W - m - min(gw, gh), f"x_{spec.id}")
        y = model.new_int_var(m, H - m - min(gw, gh), f"y_{spec.id}")
        rot = model.new_bool_var(f"r_{spec.id}") if gw != gh else None
        fx = gw + (gh - gw) * rot if rot is not None else gw
        fy = gh + (gw - gh) * rot if rot is not None else gh
        model.add(x + fx <= W - m)
        model.add(y + fy <= H - m)
        bv = _BoothVars(spec, x, y, rot, fx, fy)
        vars_.append(bv)

        padded_x.append(_padded_interval(model, x, fx, aisle, W))
        padded_y.append(_padded_interval(model, y, fy, aisle, H))
        for area in static:
            _avoid(model, bv, area)
        if spec.popularity >= c.popular_threshold:
            for area in popular:
                _avoid(model, bv, area)

        p = prev.get(spec.id)
        prev_rot = p.rotation if p else 0
        if spec.id in c.fixed:
            pt = c.fixed[spec.id]
            model.add(x == _units(pt.x))
            model.add(y == _units(pt.y))
            if rot is not None:
                model.add(rot == (1 if prev_rot == 90 else 0))

        # Compactness: weighted L1 distance of the booth center to the attractor.
        dx = model.new_int_var(0, 2 * W, "")
        dy = model.new_int_var(0, 2 * H, "")
        model.add_abs_equality(dx, 2 * x + fx - cx2)
        model.add_abs_equality(dy, 2 * y + fy - cy2)
        objective += [wx * dx, wy * dy]

        if p is not None:
            px, py = _units(p.x), _units(p.y)
            mx = model.new_int_var(0, W, "")
            my = model.new_int_var(0, H, "")
            model.add_abs_equality(mx, x - px)
            model.add_abs_equality(my, y - py)
            objective += [DISPLACEMENT_WEIGHT * mx, DISPLACEMENT_WEIGHT * my]
            model.add_hint(x, px)
            model.add_hint(y, py)
            if rot is not None:
                target = 1 if p.rotation == 90 else 0
                objective.append(ROTATION_CHANGE_PENALTY * (rot if target == 0 else 1 - rot))
                model.add_hint(rot, target)

    model.add_no_overlap_2d(padded_x, padded_y)
    model.minimize(sum(objective))

    solver = cp_model.CpSolver()
    solver.parameters.random_seed = req.seed
    solver.parameters.num_workers = 8
    # Interleaved search keeps multi-worker runs reproducible; a deterministic-time budget
    # keeps results identical across machines (wall time is only a safety net).
    solver.parameters.interleave_search = True
    solver.parameters.max_deterministic_time = req.time_limit_s
    solver.parameters.max_time_in_seconds = req.time_limit_s * 3
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        layout = Layout(id=_layout_id(req.venue.id, []), venue_id=req.venue.id, booths=[])
        return LayoutResponse(
            layout=layout,
            status="infeasible",
            objective=None,
            solve_time_s=time.perf_counter() - t0,
        )

    booths = _booths(solver.value, vars_)
    layout = Layout(id=_layout_id(req.venue.id, booths), venue_id=req.venue.id, booths=booths)
    return LayoutResponse(
        layout=layout,
        status="optimal" if status == cp_model.OPTIMAL else "feasible",
        objective=solver.objective_value,
        solve_time_s=time.perf_counter() - t0,
    )
