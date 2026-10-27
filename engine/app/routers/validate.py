from fastapi import APIRouter

from app.schemas import ValidateRequest, ValidateResponse
from app.validation.rules import validate as run_rules

router = APIRouter(tags=["validate"])


@router.post("/validate")
def validate(req: ValidateRequest) -> ValidateResponse:
    return run_rules(req)
