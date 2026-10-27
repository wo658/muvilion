"""Turn a Scenario into per-agent plans (spawn, booth visits with dwell, final goal).

Every random choice is drawn from a single seeded numpy Generator in a fixed order, so the
same request always yields the same plans.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import jupedsim as jps
import numpy as np
from shapely.geometry import Polygon

from app.schemas import BoothSpec, Layout, Scenario, Venue
from app.sim.walkable import (
    AGENT_CLEARANCE,
    DoorGeometry,
    booth_front_points,
    door_geometry,
    spawn_candidates,
)

WAYPOINT_RADIUS = 1.0
DWELL_BASE_S = 10.0
DWELL_POPULARITY_S = 50.0  # extra dwell for a popularity-1.0 booth
ENTRY_ARRIVAL_FRACTION = 0.5  # entry arrivals spread over this share of the duration
AGENT_SPACING = 0.5


@dataclass
class Visit:
    stage_id: int
    dwell_s: float


@dataclass
class AgentPlan:
    spawn_time: float
    desired_speed: float
    visits: list[Visit]
    final_stage: int
    # "exit": removed by an exit stage; "point": done when within WAYPOINT_RADIUS of final_point.
    final_kind: str
    final_point: tuple[float, float] | None = None
    position: tuple[float, float] | None = None  # None -> spawn at the entrance


@dataclass
class World:
    sim: jps.Simulation
    walkable: Polygon
    venue: Venue
    booth_stages: dict[str, list[int]]
    popularity: dict[str, float]
    doors: list[DoorGeometry]
    stage_points: dict[int, tuple[float, float]] = field(default_factory=dict)
    exit_stages: dict[str, int] = field(default_factory=dict)
    entrance_spawns: list[tuple[float, float]] = field(default_factory=list)
    _routing: jps.RoutingEngine | None = None

    def route_length(self, a: tuple[float, float], b: tuple[float, float]) -> float:
        if self._routing is None:
            self._routing = jps.RoutingEngine(self.walkable)
        try:
            path = self._routing.compute_waypoints(a, b)
        except Exception:  # unroutable point: penalize instead of failing the run
            return math.dist(a, b) * 10
        return sum(math.dist(p, q) for p, q in zip(path, path[1:], strict=False))


def build_world(
    sim: jps.Simulation, walkable: Polygon, venue: Venue, layout: Layout, specs: list[BoothSpec]
) -> World:
    popularity = {s.id: s.popularity for s in specs}
    booth_stages: dict[str, list[int]] = {}
    stage_points: dict[int, tuple[float, float]] = {}
    for booth in layout.booths:
        for p in booth_front_points(booth, walkable):
            stage = sim.add_waypoint_stage(p, WAYPOINT_RADIUS)
            booth_stages.setdefault(booth.id, []).append(stage)
            stage_points[stage] = p
    doors = [door_geometry(venue, d, walkable) for d in venue.doors]
    world = World(sim, walkable, venue, booth_stages, popularity, doors, stage_points)
    for dg in doors:
        if dg.exit_polygon is not None:
            world.exit_stages[dg.door.id] = sim.add_exit_stage(dg.exit_polygon)
    for dg in doors:
        if dg.door.kind == "entrance":
            world.entrance_spawns += spawn_candidates(venue, dg.door, walkable)
    return world


def _speed(rng: np.random.Generator) -> float:
    return float(np.clip(rng.normal(1.25, 0.2), 0.7, 1.7))


def _pick_booths(world: World, rng: np.random.Generator, k: int) -> list[str]:
    ids = sorted(world.booth_stages)
    if not ids:
        return []
    w = np.array([world.popularity.get(i, 0.5) ** 2 + 0.05 for i in ids])
    k = min(k, len(ids))
    return [ids[i] for i in rng.choice(len(ids), size=k, replace=False, p=w / w.sum())]


def _visit(world: World, rng: np.random.Generator, booth_id: str) -> Visit:
    stages = world.booth_stages[booth_id]
    pop = world.popularity.get(booth_id, 0.5)
    dwell = (DWELL_BASE_S + DWELL_POPULARITY_S * pop) * rng.uniform(0.7, 1.3)
    return Visit(stages[int(rng.integers(len(stages)))], float(dwell))


def _nearest_exit(world: World, start: tuple[float, float], kinds: set[str]) -> int | None:
    best, best_len = None, math.inf
    for dg in world.doors:
        if dg.door.kind not in kinds or dg.door.id not in world.exit_stages:
            continue
        target = dg.approach or tuple(dg.exit_polygon.centroid.coords[0])
        length = world.route_length(start, target)
        if length < best_len:
            best, best_len = world.exit_stages[dg.door.id], length
    return best


def _scatter(world: World, n: int, seed: int) -> list[tuple[float, float]]:
    try:
        return jps.distribute_by_number(
            polygon=world.walkable,
            number_of_agents=n,
            distance_to_agents=AGENT_SPACING,
            distance_to_polygon=AGENT_CLEARANCE + 0.05,
            seed=seed,
        )
    except (jps.AgentNumberError, jps.IncorrectParameterError) as exc:
        raise ValueError(f"Cannot place {n} agents in the walkable area: {exc}") from exc


def _plans_entry(world: World, sc: Scenario, rng: np.random.Generator) -> list[AgentPlan]:
    if not world.entrance_spawns:
        raise ValueError("No walkable spawn area at any entrance")
    window = sc.duration_s * ENTRY_ARRIVAL_FRACTION
    dispersal = _scatter(world, min(40, max(5, sc.agents // 5)), seed=sc.seed + 1)
    dispersal_stages = [world.sim.add_waypoint_stage(p, WAYPOINT_RADIUS) for p in dispersal]
    plans = []
    for i in range(sc.agents):
        visits = [_visit(world, rng, b) for b in _pick_booths(world, rng, 1)]
        k = int(rng.integers(len(dispersal)))
        target, stage = tuple(dispersal[k]), dispersal_stages[k]
        plans.append(
            AgentPlan(
                spawn_time=window * i / sc.agents,
                desired_speed=_speed(rng),
                visits=visits,
                final_stage=stage,
                final_kind="point",
                final_point=target,
            )
        )
    return plans


def _plans_browse(world: World, sc: Scenario, rng: np.random.Generator) -> list[AgentPlan]:
    starts = _scatter(world, sc.agents, seed=sc.seed)
    plans = []
    for pos in starts:
        booths = _pick_booths(world, rng, int(rng.integers(2, 5)))
        visits = [_visit(world, rng, b) for b in booths]
        from_pt = world.stage_points[visits[-1].stage_id] if visits else tuple(pos)
        exit_stage = _nearest_exit(world, from_pt, {"exit", "entrance"})
        if exit_stage is None:
            exit_stage = _nearest_exit(world, from_pt, {"exit", "entrance", "emergency"})
        if exit_stage is None:
            raise ValueError("No reachable exit door")
        plans.append(AgentPlan(0.0, _speed(rng), visits, exit_stage, "exit", position=tuple(pos)))
    return plans


def _plans_exit(world: World, sc: Scenario, rng: np.random.Generator) -> list[AgentPlan]:
    starts = _scatter(world, sc.agents, seed=sc.seed)
    plans = []
    for pos in starts:
        exit_stage = _nearest_exit(world, pos, {"exit", "entrance", "emergency"})
        if exit_stage is None:
            raise ValueError("No reachable exit door")
        plans.append(AgentPlan(0.0, _speed(rng), [], exit_stage, "exit", position=tuple(pos)))
    return plans


def make_plans(world: World, sc: Scenario) -> list[AgentPlan]:
    rng = np.random.default_rng(sc.seed)
    builder = {"entry": _plans_entry, "browse": _plans_browse, "exit": _plans_exit}[sc.kind]
    return builder(world, sc, rng)
