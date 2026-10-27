BASE = {"arrivals_per_min": 6, "service_time_s": 25, "duration_min": 60, "seed": 3}


def _run(client, **kw):
    res = client.post("/queue", json={**BASE, **kw})
    assert res.status_code == 200, res.text
    return res.json()


def test_more_servers_less_wait(client):
    results = [_run(client, servers=c) for c in (3, 4, 6)]
    waits = [r["mean_wait_s"] for r in results]
    assert waits[0] > waits[1] >= waits[2]
    assert results[0]["utilization"] > results[2]["utilization"]
    for r in results:
        assert 0 <= r["utilization"] <= 1
        assert r["p90_wait_s"] >= 0


def test_overloaded_desk_builds_queue(client):
    r = _run(client, servers=2)  # offered load 2.5 Erlang on 2 desks
    assert r["max_queue_len"] > 10
    assert r["utilization"] > 0.9


def test_queue_deterministic(client):
    assert _run(client, servers=3) == _run(client, servers=3)
    assert _run(client, servers=3) != _run(client, servers=3, seed=4)
