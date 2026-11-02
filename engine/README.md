# Drawing document service

Architecture: [overview](../architecture/README.md) · [ADRs](../architecture/adr/README.md).

FastAPI currently handles PDF/image/DXF document extraction. Layout optimization,
legacy geometry/accessibility validation, walkable-area calculation and the disk
layout cache have been removed. Studio design proposals are produced by Meta Model
in Next.js. Document preparation must be migrated before this service can be removed.

## Run and check

```sh
uv sync
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check .
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service status and document dependency versions |
| POST | `/plans/extract` | Read drawing evidence from PDF, image or DXF uploads |

`/plans/extract` accepts multipart `file` and optional `page` (default 1).
Resource limits reject oversized input instead of silently truncating evidence.
`/layout`, `/validate`, simulation, trajectory and queue endpoints are unavailable.

## Contracts

`app/plan_schemas.py` defines the document transport. After changing it, run
`pnpm gen:engine-types` in `web/` and reconcile `web/lib/plans/schema.ts`.
`scripts/prepare_fort_mason.py` prepares local drawing assets; local PDFs are not bundled.
