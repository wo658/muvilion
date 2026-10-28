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
- Keep computations reproducible for the same inputs, excluding explicitly
  documented timing fields. Preserve time/resource limits and bounded caches.
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
