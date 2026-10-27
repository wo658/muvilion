"""Outdoor plaza: zones, fence gates and the fire lane."""

import copy
from itertools import combinations

from app.geometry import booth_polygon, zone_polygon
from app.schemas import Booth, Zone


def _errors(body):
    return [v for v in body["violations"] if v["severity"] == "error"]


def _validate(client, venue, layout):
    res = client.post("/validate", json={"venue": venue, "layout": layout})
    assert res.status_code == 200, res.text
    return res.json()


def _zone(venue, zone_id):
    return zone_polygon(Zone(**next(z for z in venue["zones"] if z["id"] == zone_id)))


def test_outdoor_layout_feasible_and_valid(client, outdoor, solved_outdoor):
    assert solved_outdoor["status"] in ("optimal", "feasible")
    booths = solved_outdoor["layout"]["booths"]
    assert {b["id"] for b in booths} == {b["id"] for b in outdoor["booths"]}
    polys = [booth_polygon(Booth(**b)) for b in booths]
    for a, b in combinations(polys, 2):
        assert a.intersection(b).area < 1e-9
    body = _validate(client, outdoor["venue"], solved_outdoor["layout"])
    assert _errors(body) == [], body["violations"]
    assert body["ok"]


def test_outdoor_booths_off_fire_lane_and_stage_front(outdoor, solved_outdoor):
    venue = outdoor["venue"]
    for zone_id in ("Z-fire", "Z-stagefront"):
        zone = _zone(venue, zone_id)
        for b in solved_outdoor["layout"]["booths"]:
            assert booth_polygon(Booth(**b)).intersection(zone).area < 1e-9, (zone_id, b)


def test_zone_unbuildable_detected(client, outdoor, solved_outdoor):
    layout = copy.deepcopy(solved_outdoor["layout"])
    tent = next(b for b in layout["booths"] if b["id"] == "M01")
    tent.update(x=6.0, y=24.0)  # on the stage-front lawn, clear of the fire lane
    body = _validate(client, outdoor["venue"], layout)
    hits = [v for v in _errors(body) if v["rule_id"] == "zone_unbuildable"]
    assert [v["booth_ids"] for v in hits] == [["M01"]]
    assert hits[0]["source"] == "venue:zones/Z-stagefront"
    assert not any(v["rule_id"] == "fire_lane_blocked" for v in body["violations"])


def test_fire_lane_blocked_detected(client, outdoor, solved_outdoor):
    layout = copy.deepcopy(solved_outdoor["layout"])
    truck = next(b for b in layout["booths"] if b["id"] == "F1")
    truck.update(x=40.0, y=19.0, rotation=0)  # parked across the middle of the lane
    body = _validate(client, outdoor["venue"], layout)
    rules = {v["rule_id"] for v in _errors(body)}
    assert {"zone_unbuildable", "fire_lane_blocked"} <= rules
    hit = next(v for v in body["violations"] if v["rule_id"] == "fire_lane_blocked")
    assert hit["booth_ids"] == ["F1"] and hit["source"] == "venue:zones/Z-fire"


def test_fire_lane_blocked_by_obstacle_on_buildable_lane(client, outdoor):
    venue = copy.deepcopy(outdoor["venue"])
    for z in venue["zones"]:
        if z["kind"] == "fire_lane":
            z["buildable"] = True
    pts = [(30, 17), (31, 17), (31, 19), (30, 19)]  # a structure poking 1 m into the lane
    venue["obstacles"].append(
        {"id": "X", "kind": "structure", "polygon": [{"x": x, "y": y} for x, y in pts]}
    )
    body = _validate(client, venue, {"id": "t", "venue_id": venue["id"], "booths": []})
    hit = next(v for v in body["violations"] if v["rule_id"] == "fire_lane_blocked")
    assert "X" in hit["message"] and hit["booth_ids"] == []


def test_outdoor_gates_reachable_through_zones(client, outdoor):
    # Empty site: every gate is reachable across lawn, plaza and fire lane.
    body = _validate(client, outdoor["venue"], {"id": "t", "venue_id": "v", "booths": []})
    assert body["ok"], body["violations"]
