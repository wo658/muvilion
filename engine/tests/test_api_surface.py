import pytest


def test_retained_api_contract(client):
    spec = client.get("/openapi.json").json()
    assert set(spec["paths"]) == {"/health", "/plans/extract"}


@pytest.mark.parametrize("path", ["/layout", "/validate", "/simulate", "/trajectories", "/queue"])
def test_retired_endpoints_are_not_available(client, path):
    assert client.post(path, json={}).status_code == 404
