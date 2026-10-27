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
