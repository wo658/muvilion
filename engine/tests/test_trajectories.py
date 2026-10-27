import pytest
from shapely.geometry import Point

from app.geometry import booth_polygon
from app.schemas import Layout
from app.sim.cache import trajectory_cache

TOL = 0.1  # m; agents are discs, positions are centers rounded to 1 cm


def _req(sample, layout, kind, agents=20, duration=30.0, seed=3):
    return {
        "venue": sample["venue"],
        "layout": layout,
        "booths": sample["booths"],
        "scenario": {"kind": kind, "agents": agents, "duration_s": duration, "seed": seed},
    }


def _strip_wall(body):
    return {k: v for k, v in body.items() if k != "wall_time_s"}


@pytest.fixture(scope="module")
def browse(client, sample, solved_layout):
    """One browse run: /simulate fills the cache, /trajectories is served from it."""
    trajectory_cache.clear()
    req = _req(sample, solved_layout["layout"], "browse")
    sim = client.post("/simulate", json=req).json()
    res = client.post("/trajectories", json=req)
    assert res.status_code == 200, res.text
    return req, sim, res.json()


def test_tracks_cover_every_agent(browse):
    req, sim, traj = browse
    assert traj["run_id"] == sim["run_id"]
    assert traj["layout_id"] == sim["layout_id"] == req["layout"]["id"]
    assert traj["dt"] == pytest.approx(0.5)
    assert sorted(a["id"] for a in traj["agents"]) == list(range(req["scenario"]["agents"]))
    for a in traj["agents"]:
        assert len(a["xy"]) % 2 == 0 and len(a["xy"]) >= 2
        assert a["t0"] >= 0 and a["t0"] + len(a["xy"]) // 2 <= traj["frames"]
    # duration 30 s at 0.5 s -> frames 0..60, unless everyone left earlier
    assert traj["frames"] <= 61


def test_positions_inside_hall_and_outside_booths(browse, sample):
    req, _, traj = browse
    w, h = sample["venue"]["width"], sample["venue"]["height"]
    booths = [booth_polygon(b) for b in Layout.model_validate(req["layout"]).booths]
    for a in traj["agents"]:
        xy = a["xy"]
        for x, y in zip(xy[::2], xy[1::2], strict=True):
            assert -TOL <= x <= w + TOL and -TOL <= y <= h + TOL
            p = Point(x, y)
            assert all(poly.exterior.distance(p) <= TOL or not poly.contains(p) for poly in booths)


def test_cache_miss_matches_hit(client, browse):
    req, _, hit = browse
    trajectory_cache.clear()
    miss = client.post("/trajectories", json=req).json()
    assert miss == hit


def test_trajectories_deterministic_and_keep_simresult(client, sample, solved_layout):
    req = _req(sample, solved_layout["layout"], "entry", duration=20.0)
    trajectory_cache.clear()
    a = client.post("/trajectories", json=req).json()
    trajectory_cache.clear()
    b = client.post("/trajectories", json=req).json()
    assert a == b
    sim = client.post("/simulate", json=req).json()
    assert sim["run_id"] == a["run_id"]
    req2 = {**req, "trajectory_dt": 1.0}
    c = client.post("/trajectories", json=req2).json()
    sim2 = client.post("/simulate", json=req2).json()
    assert c["dt"] == pytest.approx(1.0) and c["frames"] < a["frames"]
    # Sampling interval does not affect the metrics (run_id hashes the request, so it differs).
    assert {**_strip_wall(sim2), "run_id": ""} == {**_strip_wall(sim), "run_id": ""}
