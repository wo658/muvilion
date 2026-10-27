import copy


def _rules(body):
    return {v["rule_id"] for v in body["violations"] if v["severity"] == "error"}


BASE = {
    "id": "base",
    "venue_id": "sample-hall",
    "booths": [
        {"id": "A", "x": 5, "y": 12, "w": 3, "h": 3},
        {"id": "B", "x": 11, "y": 12, "w": 3, "h": 3},
        {"id": "C", "x": 25, "y": 5, "w": 3, "h": 3, "rotation": 90},
    ],
}


def test_clean_layout_ok(client, sample):
    body = _post(client, sample, BASE)
    assert body["ok"], body["violations"]


def _post(client, sample, layout, **constraints):
    return client.post(
        "/validate",
        json={"venue": sample["venue"], "layout": layout, "constraints": constraints},
    ).json()


def test_overlap_detected(client, sample):
    layout = copy.deepcopy(BASE)
    a, b = layout["booths"][0], layout["booths"][1]
    b["x"], b["y"] = a["x"] + 1.0, a["y"] + 1.0
    body = _post(client, sample, layout)
    assert not body["ok"]
    assert "booth_overlap" in _rules(body)
    hit = next(v for v in body["violations"] if v["rule_id"] == "booth_overlap")
    assert set(hit["booth_ids"]) == {a["id"], b["id"]}
    assert hit["location"] is not None


def test_blocked_door_detected(client, sample):
    layout = copy.deepcopy(BASE)
    # Park a booth right in front of the main entrance (door spans x 18..22 at y=0).
    layout["booths"][0].update(x=18.5, y=1.0)
    body = _post(client, sample, layout)
    assert "door_clearance" in _rules(body)


def test_walled_off_booth_unreachable(client, sample):
    # Four booths boxing in a fifth with sub-aisle gaps.
    ring = [
        {"id": "C", "x": 20, "y": 15, "w": 3, "h": 3},
        {"id": "L", "x": 16.5, "y": 15, "w": 3, "h": 3},
        {"id": "R", "x": 23.5, "y": 15, "w": 3, "h": 3},
        {"id": "T", "x": 16.5, "y": 18.5, "w": 10, "h": 3},
        {"id": "B", "x": 16.5, "y": 11.5, "w": 10, "h": 3},
    ]
    body = _post(client, sample, {"id": "t", "venue_id": "v", "booths": ring})
    unreachable = [v for v in body["violations"] if v["rule_id"] == "booth_unreachable"]
    assert [v["booth_ids"] for v in unreachable] == [["C"]]


def test_outside_hall_and_obstacle(client, sample):
    booths = [
        {"id": "OUT", "x": 38.5, "y": 15, "w": 3, "h": 3},
        {"id": "COL", "x": 12, "y": 9, "w": 3, "h": 3},  # covers column C1
    ]
    body = _post(client, sample, {"id": "t", "venue_id": "v", "booths": booths})
    assert {"booth_outside_hall", "booth_over_obstacle"} <= _rules(body)


def test_narrow_aisle_detected(client, sample):
    booths = [
        {"id": "A", "x": 5, "y": 12, "w": 3, "h": 3},
        {"id": "B", "x": 9, "y": 12, "w": 3, "h": 3},
    ]
    body = _post(client, sample, {"id": "t", "venue_id": "v", "booths": booths})
    assert "aisle_width" in _rules(body)
