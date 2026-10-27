"""Run layout -> validate -> simulate (+ queue) on the sample fixture and print metrics.

uv run python scripts/demo.py                 # in-process, no server needed
uv run python scripts/demo.py --url http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT.parent / "fixtures" / "sample_hall.json"


def make_client(url: str | None):
    if url:
        import httpx

        return httpx.Client(base_url=url, timeout=120)
    sys.path.insert(0, str(ROOT))
    warnings.filterwarnings("ignore", message="Using `httpx`")
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", help="engine base URL; omit to run in-process")
    ap.add_argument("--agents", type=int, default=200)
    ap.add_argument("--duration", type=float, default=300.0)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    client = make_client(args.url)
    sample = json.loads(FIXTURE.read_text())
    venue, specs = sample["venue"], sample["booths"]

    lay = client.post("/layout", json={"venue": venue, "booths": specs, "seed": args.seed}).json()
    layout = lay["layout"]
    print(f"layout  {layout['id']}  status={lay['status']}  solve={lay['solve_time_s']:.2f}s")
    if lay["status"] == "infeasible":
        return

    val = client.post("/validate", json={"venue": venue, "layout": layout}).json()
    print(f"validate ok={val['ok']}  violations={len(val['violations'])}")
    for v in val["violations"]:
        print(f"  [{v['severity']}] {v['rule_id']}: {v['message']}")

    for kind in ("entry", "browse", "exit"):
        scenario = {
            "kind": kind,
            "agents": args.agents,
            "duration_s": args.duration,
            "seed": args.seed,
        }
        req = {"venue": venue, "layout": layout, "booths": specs, "scenario": scenario}
        r = client.post("/simulate", json=req).json()
        print(
            f"simulate {kind:<6} done={r['completed_fraction']:.2f}  "
            f"travel mean/p90={r['mean_travel_time_s']:.0f}/{r['p90_travel_time_s']:.0f}s  "
            f"max_density={r['max_density']:.2f} p/m²  wall={r['wall_time_s']:.1f}s"
        )
        for h in r["hotspots"][:3]:
            z = h["zone"]
            print(
                f"    hotspot ({z['x']:.0f},{z['y']:.0f}) {z['w']:.0f}x{z['h']:.0f}m  "
                f"peak={h['peak_density']:.2f} mean={h['mean_density']:.2f}  "
                f"near={','.join(h['nearby_booth_ids'])}"
            )

    q = client.post(
        "/queue", json={"arrivals_per_min": 6, "service_time_s": 25, "servers": 3}
    ).json()
    print(f"queue   3 desks: mean wait={q['mean_wait_s']:.0f}s  util={q['utilization']:.2f}")


if __name__ == "__main__":
    main()
