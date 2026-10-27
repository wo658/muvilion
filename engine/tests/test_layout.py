from itertools import combinations

from app.geometry import booth_polygon
from app.schemas import Booth


def test_layout_feasible_and_valid(client, sample, solved_layout):
    assert solved_layout["status"] in ("optimal", "feasible")
    booths = solved_layout["layout"]["booths"]
    assert {b["id"] for b in booths} == {b["id"] for b in sample["booths"]}

    polys = [booth_polygon(Booth(**b)) for b in booths]
    for a, b in combinations(polys, 2):
        assert a.intersection(b).area < 1e-9

    res = client.post(
        "/validate", json={"venue": sample["venue"], "layout": solved_layout["layout"]}
    )
    body = res.json()
    assert body["ok"], body["violations"]


def test_layout_deterministic(client, sample, solved_layout):
    res = client.post(
        "/layout", json={"venue": sample["venue"], "booths": sample["booths"], "time_limit_s": 3}
    )
    assert res.json()["layout"] == solved_layout["layout"]


def test_layout_honors_fixed_and_previous(client, sample, solved_layout):
    prev = solved_layout["layout"]
    pinned = prev["booths"][0]
    req = {
        "venue": sample["venue"],
        "booths": sample["booths"],
        "previous": prev,
        "constraints": {"fixed": {pinned["id"]: {"x": pinned["x"], "y": pinned["y"]}}},
        "time_limit_s": 3,
    }
    body = client.post("/layout", json=req).json()
    assert body["status"] in ("optimal", "feasible")
    out = {b["id"]: b for b in body["layout"]["booths"]}
    assert (out[pinned["id"]]["x"], out[pinned["id"]]["y"]) == (pinned["x"], pinned["y"])
    # Starting from a feasible layout with no new constraints, nothing should move.
    moved = sum(
        abs(out[b["id"]]["x"] - b["x"]) + abs(out[b["id"]]["y"] - b["y"]) for b in prev["booths"]
    )
    assert moved == 0


def test_layout_infeasible_returns_empty(client, sample):
    req = {
        "venue": sample["venue"],
        "booths": sample["booths"],
        "constraints": {"min_aisle_width": 8.0},
        "time_limit_s": 2,
    }
    body = client.post("/layout", json=req).json()
    assert body["status"] == "infeasible"
    assert body["layout"]["booths"] == []


def test_popular_booths_kept_away_from_entrance(client, sample):
    req = {
        "venue": sample["venue"],
        "booths": sample["booths"],
        "constraints": {"popular_door_distance": 10.0, "popular_threshold": 0.8},
        "time_limit_s": 3,
    }
    body = client.post("/layout", json=req).json()
    assert body["status"] in ("optimal", "feasible")
    popular = {b["id"] for b in sample["booths"] if b["popularity"] >= 0.8}
    for b in body["layout"]["booths"]:
        if b["id"] in popular:
            assert (
                booth_polygon(Booth(**b)).distance(
                    booth_polygon(Booth(id="door", x=18, y=0, w=4, h=0.01))
                )
                >= 10.0 - 1e-6
            )
