from importlib.metadata import version

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "versions": {pkg: version(pkg) for pkg in ("ortools", "jupedsim", "shapely", "simpy")},
    }
