import pytest


def _req(sample, layout, kind, agents=30, duration=60.0, seed=7):
    return {
        "venue": sample["venue"],
        "layout": layout,
        "booths": sample["booths"],
        "scenario": {"kind": kind, "agents": agents, "duration_s": duration, "seed": seed},
    }


def _strip_wall(body):
    return {k: v for k, v in body.items() if k != "wall_time_s"}


@pytest.mark.parametrize("kind", ["entry", "browse", "exit"])
def test_simulate_sane_metrics(client, sample, solved_layout, kind):
    res = client.post("/simulate", json=_req(sample, solved_layout["layout"], kind))
    assert res.status_code == 200, res.text
    body = res.json()
    grid = body["grid"]
    assert len(grid["peak"]) == grid["cols"] * grid["rows"] == 20 * 15
    assert 0.0 <= body["completed_fraction"] <= 1.0
    assert body["max_density"] == pytest.approx(max(grid["peak"]))
    assert body["max_density"] > 0
    assert body["p90_travel_time_s"] >= body["mean_travel_time_s"] * 0.5
    assert body["sim_time_s"] <= 60.0 + 1e-6
    assert body["layout_id"] == solved_layout["layout"]["id"]
    assert not body["truncated"]
    for h in body["hotspots"]:
        assert h["peak_density"] >= h["mean_density"]
    if kind == "exit":
        assert body["completed_fraction"] > 0.9


def test_simulate_deterministic(client, sample, solved_layout):
    req = _req(sample, solved_layout["layout"], "browse", agents=25, duration=40.0)
    a = client.post("/simulate", json=req).json()
    b = client.post("/simulate", json=req).json()
    assert _strip_wall(a) == _strip_wall(b)

    req["scenario"]["seed"] = 8
    c = client.post("/simulate", json=req).json()
    assert c["run_id"] != a["run_id"]
