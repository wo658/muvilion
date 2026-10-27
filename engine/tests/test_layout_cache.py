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
