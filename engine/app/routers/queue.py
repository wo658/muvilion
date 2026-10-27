from fastapi import APIRouter

from app.registration_queue import simulate_queue
from app.schemas import QueueRequest, QueueResult

router = APIRouter(tags=["queue"])


@router.post("/queue")
def queue(req: QueueRequest) -> QueueResult:
    return simulate_queue(req)
