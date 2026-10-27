"""Disk memo for /layout responses, keyed by a hash of the request.

CP-SAT's parallel search can return different layouts with the same objective for an identical
model, so repeated requests are answered from here: the same request then gets the same layout
across calls and engine restarts (replays and live runs agree). Simulation needs no such memo; it
is deterministic for a given layout. Set LAYOUT_CACHE_DIR="" to disable.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

from app.schemas import LayoutRequest, LayoutResponse

_DEFAULT_DIR = Path(__file__).resolve().parents[2] / ".cache" / "layout"


def _dir() -> Path | None:
    raw = os.environ.get("LAYOUT_CACHE_DIR")
    if raw == "":
        return None
    return Path(raw) if raw else _DEFAULT_DIR


def request_key(req: LayoutRequest) -> str:
    return hashlib.sha1(req.model_dump_json().encode()).hexdigest()


def load(req: LayoutRequest) -> LayoutResponse | None:
    d = _dir()
    if d is None:
        return None
    path = d / f"{request_key(req)}.json"
    try:
        return LayoutResponse.model_validate_json(path.read_bytes())
    except (FileNotFoundError, ValueError):
        return None


def store(req: LayoutRequest, resp: LayoutResponse) -> None:
    d = _dir()
    if d is None:
        return
    d.mkdir(parents=True, exist_ok=True)
    tmp = d / f"{request_key(req)}.tmp"
    tmp.write_text(resp.model_dump_json())
    tmp.replace(d / f"{request_key(req)}.json")
