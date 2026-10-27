from fastapi import APIRouter, HTTPException

from app.schemas import SimResult, SimulateRequest, Trajectories
from app.sim.runner import run_simulation

router = APIRouter(tags=["simulate"])


@router.post("/simulate")
def simulate(req: SimulateRequest) -> SimResult:
    try:
        return run_simulation(req)
    except ValueError as exc:  # e.g. no reachable entrance/exit in this layout
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/trajectories")
def trajectories(req: SimulateRequest) -> Trajectories:
    # Contract placeholder; recording is implemented in app.sim.
    raise HTTPException(status_code=501, detail="trajectories not implemented yet")
