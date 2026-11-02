# Engine agent instructions

The root `AGENTS.md` also applies here.

## Responsibilities and structure

- FastAPI is the internal computation API. Keep model calls, agent orchestration,
  conversation state, and user-facing example selection in the Next.js server.
- Keep routers in `app/routers/` thin and document handling in `app/plans/`.
- Layout optimization, walkable-area geometry and legacy validation are retired.
- Avoid blocking the async event loop with document preparation. Preserve input,
  page and resource checks at the document boundary.
- Application state belongs in Next.js, not this service.

## Contracts and verification

- Keep transport schemas in `app/plan_schemas.py`; expose response
  schemas through FastAPI so generated OpenAPI describes the actual API.
- Preserve documented units and coordinate conventions. Treat changes to units, geometry
  semantics, or response shapes as contract changes, not incidental refactoring.
- After schema changes, run `pnpm gen:engine-types` from `web/` and update affected web
  validators until type checking passes.
- Run `uv run pytest` and `uv run ruff check .`; follow the root pre-merge checks as well.
