"""Best-effort, bounded disk cache for computed layouts (not application state).

Evict oldest writes; expire after seven days by default. Atomic, unique temporary
files avoid concurrent-writer collisions. Limits are enforced on writes within one
process; independent processes sharing a directory can briefly exceed them.
"""

from __future__ import annotations

import hashlib
import logging
import os
import tempfile
import threading
import time
from contextlib import suppress
from importlib.metadata import version
from pathlib import Path

from app.schemas import LayoutRequest, LayoutResponse

# Bump whenever solver semantics or response interpretation change.
CACHE_VERSION = "layout-v2"
_DEFAULT_DIR = Path(__file__).resolve().parents[2] / ".cache" / "layout"
_LOCK = threading.RLock()
_LOG = logging.getLogger(__name__)


def _dir() -> Path | None:
    raw = os.environ.get("LAYOUT_CACHE_DIR")
    if raw == "":
        return None
    return Path(raw) if raw else _DEFAULT_DIR


def _limit(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
        return value if value > 0 else default
    except ValueError:
        return default


def _limits() -> tuple[int, int, int]:
    return (
        _limit("LAYOUT_CACHE_MAX_ENTRIES", 128),
        _limit("LAYOUT_CACHE_MAX_BYTES", 64 * 1024 * 1024),
        _limit("LAYOUT_CACHE_TTL_S", 7 * 24 * 60 * 60),
    )


def request_key(req: LayoutRequest) -> str:
    namespace = f"{CACHE_VERSION}:{version('ortools')}:"
    return hashlib.sha256((namespace + req.model_dump_json()).encode()).hexdigest()


def load(req: LayoutRequest) -> LayoutResponse | None:
    directory = _dir()
    if directory is None:
        return None
    with _LOCK:
        path = directory / f"{request_key(req)}.json"
        try:
            _, max_bytes, ttl = _limits()
            stat = path.stat()
            if stat.st_size > max_bytes or time.time() - stat.st_mtime > ttl:
                path.unlink(missing_ok=True)
                return None
            # Bound the read as well as checking stat (another process may replace it).
            with path.open("rb") as stream:
                data = stream.read(max_bytes + 1)
            if len(data) > max_bytes:
                return None
            return LayoutResponse.model_validate_json(data)
        except (OSError, ValueError):
            return None


def _prune(directory: Path) -> None:
    max_entries, max_bytes, ttl = _limits()
    now = time.time()
    for path in directory.glob("layout-*.tmp"):
        try:
            if now - path.stat().st_mtime > ttl:
                path.unlink(missing_ok=True)
        except FileNotFoundError:
            continue
    entries = []
    for path in directory.glob("*.json"):
        try:
            stat = path.stat()
            if now - stat.st_mtime > ttl or stat.st_size > max_bytes:
                path.unlink(missing_ok=True)
            else:
                entries.append((stat.st_mtime, path, stat.st_size))
        except FileNotFoundError:
            continue
    entries.sort(key=lambda item: (item[0], item[1].name))
    total = sum(item[2] for item in entries)
    count = len(entries)
    for _, path, size in entries:
        if count <= max_entries and total <= max_bytes:
            break
        path.unlink(missing_ok=True)
        total -= size
        count -= 1


def store(req: LayoutRequest, resp: LayoutResponse) -> None:
    directory = _dir()
    if directory is None:
        return
    temporary: Path | None = None
    with _LOCK:
        try:
            directory.mkdir(parents=True, exist_ok=True)
            _prune(directory)
            data = resp.model_dump_json().encode()
            if len(data) > _limits()[1]:
                return
            with tempfile.NamedTemporaryFile(
                dir=directory, prefix="layout-", suffix=".tmp", delete=False
            ) as stream:
                temporary = Path(stream.name)
                stream.write(data)
            temporary.replace(directory / f"{request_key(req)}.json")
            _prune(directory)
        except OSError:
            _LOG.warning("Layout cache unavailable; returning computed result", exc_info=True)
        finally:
            if temporary is not None:
                with suppress(OSError):
                    temporary.unlink(missing_ok=True)
