from fastapi import APIRouter

from app.layout.solver import solve_layout
from app.schemas import LayoutRequest, LayoutResponse

router = APIRouter(tags=["layout"])


@router.post("/layout")
def layout(req: LayoutRequest) -> LayoutResponse:
    return solve_layout(req)
