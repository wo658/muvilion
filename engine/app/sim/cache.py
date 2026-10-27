"""Small in-process LRU of recorded trajectories (serialized JSON), keyed by run_id.

/simulate fills it so a following /trajectories for the same request is served without a
second run. It is only a cache: on a miss the run is repeated (runs are deterministic), so
the engine stays stateless in behavior. Entries are stored as JSON bytes (about 1 MB for
200 agents over 300 s) rather than pydantic objects, which take several times that.
"""

from __future__ import annotations

import threading
from collections import OrderedDict

MAX_RUNS = 16


class RunCache:
    def __init__(self, maxsize: int = MAX_RUNS) -> None:
        self.maxsize = maxsize
        self._items: OrderedDict[str, bytes] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, run_id: str) -> bytes | None:
        with self._lock:
            item = self._items.get(run_id)
            if item is not None:
                self._items.move_to_end(run_id)
            return item

    def put(self, run_id: str, body: bytes) -> None:
        with self._lock:
            self._items[run_id] = body
            self._items.move_to_end(run_id)
            while len(self._items) > self.maxsize:
                self._items.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


trajectory_cache = RunCache()
