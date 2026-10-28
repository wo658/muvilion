"""Run layout and validation on a fixture.

uv run python scripts/demo.py                 # in-process, no server needed
uv run python scripts/demo.py --fixture outdoor_plaza
uv run python scripts/demo.py --url http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT.parent / "fixtures"


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
    ap.add_argument(
        "--fixture",
        default="sample_hall",
        help="fixture name in fixtures/ (sample_hall, outdoor_plaza) or a path to a JSON file",
    )
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    client = make_client(args.url)
    path = Path(args.fixture)
    if not path.suffix:
        path = FIXTURES / f"{args.fixture}.json"
    sample = json.loads(path.read_text())
    venue, specs = sample["venue"], sample["booths"]

    lay = client.post("/layout", json={"venue": venue, "booths": specs, "seed": args.seed}).json()
    layout = lay["layout"]
    print(f"venue   {venue['name']}  ({venue.get('setting', 'indoor')}, {len(specs)} booths)")
    print(f"layout  {layout['id']}  status={lay['status']}  solve={lay['solve_time_s']:.2f}s")
    if lay["status"] == "infeasible":
        return

    val = client.post("/validate", json={"venue": venue, "layout": layout}).json()
    print(f"validate ok={val['ok']}  violations={len(val['violations'])}")
    for v in val["violations"]:
        print(f"  [{v['severity']}] {v['rule_id']}: {v['message']}")


if __name__ == "__main__":
    main()
