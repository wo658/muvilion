"""Shared data contract between the web agent (TypeScript) and the engine (Python).

This file is the single source of truth. The engine imports these models directly;
the web app consumes them through the engine's OpenAPI spec (generated TS types).

Conventions
- Units: meters, seconds, persons per square meter.
- Coordinates: origin at the hall's bottom-left corner, x to the right, y up.
- Booth position (x, y) is the booth's bottom-left corner after rotation is applied.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ---------- geometry ----------


class Point(BaseModel):
    x: float
    y: float


class Rect(BaseModel):
    x: float
    y: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)


# ---------- venue ----------


class Obstacle(BaseModel):
    id: str
    kind: Literal["column", "restroom", "stage", "registration", "other"]
    polygon: list[Point] = Field(min_length=3)


class Door(BaseModel):
    id: str
    kind: Literal["entrance", "exit", "emergency"]
    # Door opening as a segment on the hall boundary.
    a: Point
    b: Point


class Venue(BaseModel):
    id: str
    name: str
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    obstacles: list[Obstacle] = []
    doors: list[Door] = Field(min_length=1)
    # Items the floor-plan reader could not confirm; never filled by guessing.
    unknowns: list[str] = []


# ---------- booths & layout ----------


class BoothSpec(BaseModel):
    id: str
    label: str
    w: float = Field(gt=0)
    h: float = Field(gt=0)
    # Relative attraction 0..1; drives dwell time and visit probability in simulation.
    popularity: float = Field(default=0.5, ge=0, le=1)


class Booth(BaseModel):
    id: str
    x: float
    y: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)
    rotation: Literal[0, 90] = 0


class Layout(BaseModel):
    id: str
    venue_id: str
    booths: list[Booth]


class LayoutConstraints(BaseModel):
    min_aisle_width: float = Field(default=3.0, gt=0)
    # Keep this distance clear in front of every door.
    door_clearance: float = Field(default=5.0, ge=0)
    wall_margin: float = Field(default=1.0, ge=0)
    # Booths pinned to a position (agent fixes booths it does not want moved).
    fixed: dict[str, Point] = {}
    # Areas no booth may overlap (agent widens an aisle by adding one).
    keep_out: list[Rect] = []
    # Popularity at or above this value must stay at least `popular_door_distance` from entrances.
    popular_threshold: float = Field(default=0.8, ge=0, le=1)
    popular_door_distance: float = Field(default=0.0, ge=0)


# ---------- engine requests / responses ----------


class LayoutRequest(BaseModel):
    venue: Venue
    booths: list[BoothSpec]
    constraints: LayoutConstraints = LayoutConstraints()
    # Start from this layout and move as little as possible (used on revisions).
    previous: Layout | None = None
    seed: int = 0
    time_limit_s: float = Field(default=10.0, gt=0, le=60)


class LayoutResponse(BaseModel):
    layout: Layout
    status: Literal["optimal", "feasible", "infeasible"]
    objective: float | None = None
    solve_time_s: float


class Violation(BaseModel):
    rule_id: str
    severity: Literal["error", "warning"]
    message: str
    booth_ids: list[str] = []
    location: Point | None = None
    # Where the rule comes from, e.g. "internal:geometry" or a code reference with edition.
    source: str = "internal:geometry"


class ValidateRequest(BaseModel):
    venue: Venue
    layout: Layout
    constraints: LayoutConstraints = LayoutConstraints()


class ValidateResponse(BaseModel):
    ok: bool
    violations: list[Violation]


class Scenario(BaseModel):
    kind: Literal["entry", "browse", "exit"]
    agents: int = Field(default=200, gt=0, le=3000)
    duration_s: float = Field(default=300.0, gt=0, le=3600)
    seed: int = 0


class SimulateRequest(BaseModel):
    venue: Venue
    layout: Layout
    booths: list[BoothSpec]
    scenario: Scenario
    grid_cell: float = Field(default=2.0, gt=0)


class DensityGrid(BaseModel):
    cell: float
    cols: int
    rows: int
    # Row-major, rows from y=0 upward; peak density per cell over the run (p/m^2).
    peak: list[float]


class Hotspot(BaseModel):
    zone: Rect
    peak_density: float
    mean_density: float
    # Booths whose footprint is within one cell of the hotspot.
    nearby_booth_ids: list[str] = []


class SimResult(BaseModel):
    run_id: str
    scenario: Scenario
    layout_id: str
    completed_fraction: float
    mean_travel_time_s: float
    p90_travel_time_s: float
    max_density: float
    hotspots: list[Hotspot]
    grid: DensityGrid
    sim_time_s: float
    wall_time_s: float


class QueueRequest(BaseModel):
    arrivals_per_min: float = Field(gt=0)
    service_time_s: float = Field(gt=0)
    servers: int = Field(ge=1)
    duration_min: float = Field(default=60, gt=0)
    seed: int = 0


class QueueResult(BaseModel):
    mean_wait_s: float
    p90_wait_s: float
    max_queue_len: int
    utilization: float
