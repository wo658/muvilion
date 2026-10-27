"""Density grid accumulation, hotspot extraction and travel-time statistics."""

from __future__ import annotations

import math

import numpy as np
from shapely.geometry import Polygon, box

from app.schemas import DensityGrid, Hotspot, Rect

MIN_FREE_FRACTION = 0.5  # cells mostly covered by booths use this share of area as floor
HOTSPOT_REL = 0.5  # cells at >= this fraction of the max peak are hotspot candidates
HOTSPOT_MIN_DENSITY = 0.5  # p/m^2; below this nothing is called a hotspot
HOTSPOT_MAX_CELLS = 12  # of the candidates, keep the most persistently crowded (by mean)
MAX_HOTSPOTS = 5


class DensityAccumulator:
    def __init__(self, width: float, height: float, cell: float, walkable: Polygon) -> None:
        self.cell = cell
        self.cols = max(1, math.ceil(width / cell - 1e-9))
        self.rows = max(1, math.ceil(height / cell - 1e-9))
        free = np.zeros((self.rows, self.cols))
        for r in range(self.rows):
            for c in range(self.cols):
                cb = box(c * cell, r * cell, (c + 1) * cell, (r + 1) * cell)
                free[r, c] = walkable.intersection(cb).area
        self.walkable_cell = free > 1e-6
        self.area = np.maximum(free, MIN_FREE_FRACTION * cell * cell)
        self.peak = np.zeros((self.rows, self.cols))
        self.total = np.zeros((self.rows, self.cols))
        self.samples = 0

    def add(self, positions: np.ndarray) -> None:
        counts = np.zeros((self.rows, self.cols))
        if len(positions):
            c = np.clip((positions[:, 0] / self.cell).astype(int), 0, self.cols - 1)
            r = np.clip((positions[:, 1] / self.cell).astype(int), 0, self.rows - 1)
            np.add.at(counts, (r, c), 1)
        density = counts / self.area
        np.maximum(self.peak, density, out=self.peak)
        self.total += density
        self.samples += 1

    @property
    def mean(self) -> np.ndarray:
        return self.total / max(1, self.samples)

    def grid(self) -> DensityGrid:
        return DensityGrid(
            cell=self.cell,
            cols=self.cols,
            rows=self.rows,
            peak=[round(float(v), 4) for v in self.peak.ravel()],
        )

    def hotspots(self, booth_polys: dict[str, Polygon]) -> list[Hotspot]:
        max_peak = float(self.peak.max(initial=0.0))
        threshold = max(HOTSPOT_MIN_DENSITY, HOTSPOT_REL * max_peak)
        hot = (self.peak >= threshold) & self.walkable_cell
        if hot.sum() > HOTSPOT_MAX_CELLS:
            cutoff = np.sort(self.mean[hot])[-HOTSPOT_MAX_CELLS]
            hot &= self.mean >= cutoff
        seen = np.zeros_like(hot)
        spots = []
        for r0, c0 in zip(*np.nonzero(hot), strict=True):
            if seen[r0, c0]:
                continue
            stack, cells = [(r0, c0)], []
            seen[r0, c0] = True
            while stack:  # 4-connected flood fill
                r, c = stack.pop()
                cells.append((r, c))
                for rr, cc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                    inside = 0 <= rr < self.rows and 0 <= cc < self.cols
                    if inside and hot[rr, cc] and not seen[rr, cc]:
                        seen[rr, cc] = True
                        stack.append((rr, cc))
            rs, cs = [r for r, _ in cells], [c for _, c in cells]
            x0, y0 = min(cs) * self.cell, min(rs) * self.cell
            x1, y1 = (max(cs) + 1) * self.cell, (max(rs) + 1) * self.cell
            zone = box(x0, y0, x1, y1)
            near = sorted(
                bid for bid, poly in booth_polys.items() if poly.distance(zone) <= self.cell
            )
            spots.append(
                Hotspot(
                    zone=Rect(x=x0, y=y0, w=x1 - x0, h=y1 - y0),
                    peak_density=round(float(max(self.peak[r, c] for r, c in cells)), 4),
                    mean_density=round(float(np.mean([self.mean[r, c] for r, c in cells])), 4),
                    nearby_booth_ids=near,
                )
            )
        spots.sort(key=lambda h: (-h.peak_density, h.zone.y, h.zone.x))
        return spots[:MAX_HOTSPOTS]


def travel_stats(times: list[float]) -> tuple[float, float]:
    if not times:
        return 0.0, 0.0
    arr = np.asarray(times)
    return round(float(arr.mean()), 3), round(float(np.percentile(arr, 90)), 3)
