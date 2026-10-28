from app.layout import cache
from app.schemas import LayoutRequest


def test_layout_memo_returns_the_stored_response(client, sample, tmp_path, monkeypatch):
    monkeypatch.setenv("LAYOUT_CACHE_DIR", str(tmp_path))
    body = {"venue": sample["venue"], "booths": sample["booths"], "time_limit_s": 1}
    first = client.post("/layout", json=body).json()
    assert len(list(tmp_path.glob("*.json"))) == 1

    # A stored response wins over a fresh solve, so repeats are identical.
    req = LayoutRequest.model_validate(body)
    stored = cache.load(req)
    assert stored is not None and stored.layout.id == first["layout"]["id"]
    assert client.post("/layout", json=body).json() == first


def test_layout_memo_can_be_disabled(monkeypatch, sample):
    monkeypatch.setenv("LAYOUT_CACHE_DIR", "")
    req = LayoutRequest.model_validate({"venue": sample["venue"], "booths": sample["booths"]})
    assert cache.load(req) is None


def test_cache_limits_expiry_version_and_corruption(sample, tmp_path, monkeypatch):
    import os
    import time

    from app.schemas import LayoutResponse

    monkeypatch.setenv("LAYOUT_CACHE_DIR", str(tmp_path))
    monkeypatch.setenv("LAYOUT_CACHE_MAX_ENTRIES", "2")
    req = LayoutRequest.model_validate(sample)
    # Obtain a valid response once; cache behavior does not need multiple solver runs.
    from app.layout.solver import solve_layout

    response = solve_layout(req.model_copy(update={"time_limit_s": 0.1}))
    assert isinstance(response, LayoutResponse)
    for index in range(3):
        cache.store(req.model_copy(update={"time_limit_s": index + 1}), response)
    assert len(list(tmp_path.glob("*.json"))) == 2
    stale = tmp_path / "layout-abandoned.tmp"
    stale.write_text("partial")
    os.utime(stale, (0, 0))
    cache.store(req, response)
    assert not stale.exists()
    path = tmp_path / f"{cache.request_key(req)}.json"
    os.utime(path, (time.time() - 100, time.time() - 100))
    monkeypatch.setenv("LAYOUT_CACHE_TTL_S", "10")
    assert cache.load(req) is None
    cache.store(req, response)
    monkeypatch.setattr(cache, "CACHE_VERSION", "changed-solver")
    assert cache.load(req) is None
    cache.store(req, response)
    path = tmp_path / f"{cache.request_key(req)}.json"
    path.write_text("broken json")
    assert cache.load(req) is None
    monkeypatch.setenv("LAYOUT_CACHE_MAX_BYTES", "1")
    cache.store(req, response)
    assert not list(tmp_path.glob("*.json"))


def test_cache_io_failure_does_not_fail_computation(client, sample, tmp_path, monkeypatch):
    blocked = tmp_path / "not-a-directory"
    blocked.write_text("occupied")
    monkeypatch.setenv("LAYOUT_CACHE_DIR", str(blocked))
    response = client.post("/layout", json={**sample, "time_limit_s": 0.1})
    assert response.status_code == 200


def test_concurrent_writes_are_atomic(sample, tmp_path, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor

    from app.layout.solver import solve_layout

    monkeypatch.setenv("LAYOUT_CACHE_DIR", str(tmp_path))
    req = LayoutRequest.model_validate({**sample, "time_limit_s": 0.1})
    response = solve_layout(req)
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda _: cache.store(req, response), range(32)))
    assert cache.load(req) == response
    assert not list(tmp_path.glob("*.tmp"))
