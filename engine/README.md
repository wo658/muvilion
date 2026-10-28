# Drawing and geometry engine

FastAPI service for drawing extraction, with reusable CP-SAT booth placement and
Shapely geometry validation. Studio currently calls only `/plans/extract`.
Layout and validation are retained for future integration, not applied to Studio
proposals automatically.

## Run and check

```sh
uv sync
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check .
uv run python scripts/demo.py
uv run python scripts/demo.py --fixture outdoor_plaza
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service status and retained geometry dependency versions |
| POST | `/plans/extract` | Extract drawing evidence from PDF, image or DXF uploads |
| POST | `/layout` | Solve booth placements on a 0.5 m grid |
| POST | `/validate` | Check overlaps, boundaries, aisles, door access and connectivity |

`/plans/extract` accepts multipart `file` and optional `page` (default 1).
All extracted lines start unknown; the user reviews classification and scale in Studio.
Resource limits reject oversized input instead of silently truncating evidence.

`/layout` accepts `LayoutRequest` and returns the final layout, status, objective and
solve time. It supports fixed placements, a previous layout, keep-out rectangles,
obstacles, unbuildable zones, door clearances and popular-booth placement constraints.
The disk memo keeps identical requests stable across calls and restarts;
`LAYOUT_CACHE_DIR=""` disables it. Intermediate animation frames are no longer returned.

`/validate` accepts `ValidateRequest` and returns violations with rule IDs, severity
and provenance. The solver and validator use the legacy 2D Venue/Booth contract;
they do not yet support the full Studio floor polygon and vertical installation model.

Crowd simulation, trajectories, registration queues and their API contracts have
been removed. `app/walkable.py` retains standalone Shapely geometry helpers;
`build_walkable` returns the largest entrance-adjacent component (or the largest
component), not a full disconnected-floor connectivity report.

## Data contracts

`app/schemas.py` defines layout and validation contracts. `app/plan_schemas.py`
defines drawing evidence. After changing contracts, run `pnpm gen:engine-types`
in `web/`, update `web/lib/engine/contract.ts` and run `pnpm typecheck`.

Shared fixtures are in `../fixtures/`. `scripts/demo.py` exercises layout and validation.
`scripts/prepare_fort_mason.py` prepares local drawing assets; local PDFs are not bundled.
