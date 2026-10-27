import numpy as np
from shapely.geometry import box

from app.sim.metrics import DensityAccumulator


def test_crowded_time_counts_people_and_area_per_sample():
    acc = DensityAccumulator(4.0, 2.0, 2.0, box(0, 0, 4, 2), crowd_threshold=2.0, sample_dt=1.0)
    # 8 people in the left 2x2 cell (2 p/m^2, crowded), 2 in the right one (0.5 p/m^2).
    crowd = np.array([[0.5, 0.5]] * 8 + [[3.0, 1.0]] * 2)
    acc.add(crowd)
    acc.add(crowd)
    acc.add(np.empty((0, 2)))
    c = acc.congestion(entered=10, hotspots=[])
    assert c.crowded_person_s == 16  # 8 people x 2 crowded samples x 1 s
    assert c.crowded_area_m2s == 8  # 4 m^2 x 2 samples
    assert c.crowded_s_per_visitor == 1.6
    assert c.peak_crowded_area_m2 == 4
    assert c.worst_hotspot_mean_density == 0


def test_simulate_reports_consistent_congestion(client, sample, solved_layout):
    body = {
        "venue": sample["venue"],
        "layout": solved_layout["layout"],
        "booths": sample["booths"],
        "scenario": {"kind": "browse", "agents": 60, "duration_s": 60, "seed": 1},
    }
    r = client.post("/simulate", json=body).json()
    c = r["congestion"]
    assert c["threshold"] == 2.0
    assert c["crowded_person_s"] >= 0 and c["crowded_area_m2s"] >= 0
    worst = max((h["mean_density"] for h in r["hotspots"]), default=0)
    assert c["worst_hotspot_mean_density"] == worst
    # A higher threshold can only shrink crowded time.
    hi = client.post("/simulate", json={**body, "crowd_threshold": 3.0}).json()["congestion"]
    assert hi["crowded_person_s"] <= c["crowded_person_s"]
