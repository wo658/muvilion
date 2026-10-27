import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "sample_hall.json"


@pytest.fixture(scope="session")
def sample() -> dict:
    return json.loads(FIXTURE.read_text())


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def solved_layout(client, sample) -> dict:
    """A layout solved once for the whole session (CP-SAT is the slowest step)."""
    res = client.post(
        "/layout", json={"venue": sample["venue"], "booths": sample["booths"], "time_limit_s": 3}
    )
    assert res.status_code == 200
    return res.json()
