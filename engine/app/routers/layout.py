from fastapi import APIRouter

from app.layout import cache
from app.layout.solver import solve_layout
from app.schemas import LayoutRequest, LayoutResponse

router = APIRouter(tags=["layout"])


@router.post("/layout")
def layout(req: LayoutRequest) -> LayoutResponse:
    hit = cache.load(req)
    if hit is not None:
        return hit
    resp = solve_layout(req)
    cache.store(req, resp)
    return resp
