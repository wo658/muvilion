from fastapi import APIRouter, HTTPException, Response

from app.schemas import SimResult, SimulateRequest, Trajectories
from app.sim.cache import trajectory_cache
from app.sim.runner import run_id_for, simulate_with_tracks

router = APIRouter(tags=["simulate"])


def _run(req: SimulateRequest) -> tuple[SimResult, bytes]:
    try:
        result, traj = simulate_with_tracks(req)
    except ValueError as exc:  # e.g. no reachable entrance/exit in this layout
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    body = traj.model_dump_json().encode()
    trajectory_cache.put(result.run_id, body)
    return result, body


@router.post("/simulate")
def simulate(req: SimulateRequest) -> SimResult:
    return _run(req)[0]


@router.post("/trajectories", response_model=Trajectories)
def trajectories(req: SimulateRequest) -> Response:
    # Positions recorded by the run /simulate does for the same request: served from the run
    # cache when /simulate ran it recently, otherwise the (deterministic) run is repeated.
    body = trajectory_cache.get(run_id_for(req))
    if body is None:
        body = _run(req)[1]
    return Response(content=body, media_type="application/json")
