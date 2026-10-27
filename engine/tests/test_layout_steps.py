"""Improving solutions exposed as LayoutResponse.steps."""

import pytest

from app.layout.solver import MAX_STEPS, downsample_steps
from app.schemas import LayoutStep


def _check_steps(body):
    steps = body["steps"]
    assert 1 <= len(steps) <= MAX_STEPS
    objectives = [s["objective"] for s in steps]
    # Minimization: each step is no worse than the one before.
    assert objectives == sorted(objectives, reverse=True)
    assert [s["t_s"] for s in steps] == sorted(s["t_s"] for s in steps)
    assert steps[-1]["booths"] == body["layout"]["booths"]
    assert steps[-1]["objective"] == pytest.approx(body["objective"])
    ids = {b["id"] for b in body["layout"]["booths"]}
    assert all({b["id"] for b in s["booths"]} == ids for s in steps)


def _no_time(body):
    return [{k: v for k, v in s.items() if k != "t_s"} for s in body["steps"]]


def test_indoor_steps(solved_layout):
    _check_steps(solved_layout)


def test_outdoor_steps(solved_outdoor):
    _check_steps(solved_outdoor)
    assert len(solved_outdoor["steps"]) >= 3  # enough frames to animate


def test_steps_deterministic(client, outdoor, solved_outdoor):
    res = client.post("/layout", json={"venue": outdoor["venue"], "booths": outdoor["booths"]})
    body = res.json()
    assert body["layout"] == solved_outdoor["layout"]
    assert _no_time(body) == _no_time(solved_outdoor)


def test_downsample_keeps_ends_and_order():
    steps = [LayoutStep(t_s=i / 10, objective=1000 - i * i, booths=[]) for i in range(30)]
    out = downsample_steps(steps)
    assert len(out) == MAX_STEPS
    assert out[0] is steps[0] and out[-1] is steps[-1]
    assert [s.t_s for s in out] == sorted(s.t_s for s in out)
    assert len({s.t_s for s in out}) == MAX_STEPS
    assert downsample_steps(steps[:5]) == steps[:5]
