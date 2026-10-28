import pytest


def test_retained_api_contract(client):
    spec = client.get("/openapi.json").json()
    assert set(spec["paths"]) == {"/health", "/plans/extract", "/layout", "/validate"}
    assert "steps" not in spec["components"]["schemas"]["LayoutResponse"]["properties"]


@pytest.mark.parametrize("path", ["/simulate", "/trajectories", "/queue"])
def test_retired_endpoints_are_not_available(client, path):
    assert client.post(path, json={}).status_code == 404
