from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.plan_schemas import PlanEvidence
from app.plans.extract import PlanInputError, extract_plan

router = APIRouter(prefix="/plans", tags=["plans"])


@router.post("/extract", response_model=PlanEvidence)
async def extract(file: Annotated[UploadFile, File()], page: Annotated[int, Form()] = 1):
    try:
        data = await file.read(20 * 1024 * 1024 + 1)
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Upload a file no larger than 20 MB.")
        return await run_in_threadpool(extract_plan, data, file.filename or "drawing", page)
    except PlanInputError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        await file.close()
