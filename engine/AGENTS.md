# Engine agent instructions

The root `AGENTS.md` also applies here.

## Responsibilities and structure

- FastAPI is the internal computation API. Keep model calls, agent orchestration,
  conversation state, and user-facing example selection in the Next.js server.
- Keep routers in `app/routers/` thin. Put extraction in `app/plans/`, optimization in
  `app/layout/`, validation in `app/validation/`, and shared walkable geometry in `app/walkable.py`.
- Computation modules must not depend on FastAPI request/response objects. Map domain
  failures to HTTP errors at the router boundary.
- Avoid blocking the async event loop with document extraction or CPU-heavy computation.
  Preserve the existing synchronous endpoint/threadpool execution boundaries.
- Preserve computation inputs, units, and resource limits. Parallel OR-Tools searches
  may choose different equivalent layouts on a cache miss; do not promise bit-for-bit
  reproducibility after cache expiry or eviction.
- `app/layout/cache.py` stores disposable layout results on disk. Preserve TTL, count,
  and byte limits, atomic writes, and best-effort I/O. Bump `CACHE_VERSION` when solver
  semantics change; OR-Tools versions are already included in the key.
- Cache limits are enforced per write in one process. Shared multi-process directories
  can briefly exceed limits; do not describe them as strict cross-process quotas.
- Application data must not rely on an in-memory cache surviving restart or being shared
  across worker processes. Cache misses must remain correct.

## Contracts and verification

- Keep transport schemas in `app/schemas.py` and `app/plan_schemas.py`; expose response
  schemas through FastAPI so generated OpenAPI describes the actual API.
- Preserve documented units and coordinate conventions. Treat changes to units, geometry
  semantics, or response shapes as contract changes, not incidental refactoring.
- After schema changes, run `pnpm gen:engine-types` from `web/` and update affected web
  validators until type checking passes.
- Run `uv run pytest` and `uv run ruff check .`; follow the root pre-merge checks as well.
