"""Evidence contract: normalized image coordinates, never confirmed architecture."""

from typing import Literal

from pydantic import BaseModel, Field


class PlanPoint(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class PlanLine(BaseModel):
    id: str
    a: PlanPoint
    b: PlanPoint
    kind: Literal["unknown", "wall", "dimension"] = "unknown"
    origin: Literal["vector", "raster", "cad"]
    confidence: float = Field(ge=0, le=1)


class PlanText(BaseModel):
    id: str
    text: str
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class PlanSource(BaseModel):
    name: str
    format: Literal["pdf", "image", "dxf"]
    page: int
    pages: int
    width: int
    height: int


class PlanEvidence(BaseModel):
    schemaVersion: Literal[1] = 1
    source: PlanSource
    preview: str
    widthMeters: float | None = None
    heightMeters: float | None = None
    scaleConfirmed: Literal[False] = False
    lines: list[PlanLine] = Field(max_length=1200)
    texts: list[PlanText] = Field(max_length=400)
    warnings: list[str]
    method: Literal["pdf-vector", "opencv", "dxf"]
