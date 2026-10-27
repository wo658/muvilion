"""Outdoor plaza smoke tests: gates as doors, zones walkable, trees/fountain/stage blocking."""

import pytest
from shapely.geometry import Point

from app.geometry import obstacle_polygon
from app.schemas import Obstacle


def _req(outdoor, layout, kind, agents=20, duration=40.0, seed=5):
    return {
        "venue": outdoor["venue"],
        "layout": layout,
        "booths": outdoor["booths"],
        "scenario": {"kind": kind, "agents": agents, "duration_s": duration, "seed": seed},
    }


@pytest.mark.parametrize("kind", ["entry", "browse", "exit"])
def test_outdoor_simulate_smoke(client, outdoor, solved_outdoor, kind):
    res = client.post("/simulate", json=_req(outdoor, solved_outdoor["layout"], kind))
    assert res.status_code == 200, res.text
    body = res.json()
    grid = body["grid"]
    assert (grid["cols"], grid["rows"]) == (30, 20)
    assert len(grid["peak"]) == 30 * 20
    assert 0 < body["max_density"] == pytest.approx(max(grid["peak"]))
    assert not body["truncated"]
    if kind == "exit":
        assert body["completed_fraction"] > 0.9


def test_outdoor_tracks_avoid_obstacles_and_cross_zones(client, outdoor, solved_outdoor):
    req = _req(outdoor, solved_outdoor["layout"], "entry", agents=30, duration=60.0)
    traj = client.post("/trajectories", json=req).json()
    obstacles = [obstacle_polygon(Obstacle(**o)) for o in outdoor["venue"]["obstacles"]]
    lane_y = []
    for a in traj["agents"]:
        for x, y in zip(a["xy"][::2], a["xy"][1::2], strict=True):
            p = Point(x, y)
            assert all(o.exterior.distance(p) <= 0.1 or not o.contains(p) for o in obstacles)
            lane_y.append(18 <= y <= 22)
    # Visitors walk across the (unbuildable but walkable) fire lane.
    assert any(lane_y)
