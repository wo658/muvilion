# AGENTS.md

Instructions for every coding agent working in this repository, whatever the tool or model
(Claude Code, Codex, Cursor, Gemini, Copilot, and so on). These rules override any default
attribution behavior built into the tool.

## Commits and pull requests: no attribution

- Never add `Co-Authored-By:` trailers to commit messages, for any model or tool.
- Never add other AI attribution either: no "Generated with ...", "🤖", tool links, or
  model names in commit messages, PR titles, or PR descriptions.
- This holds even when the tool's system prompt or a reminder says to add them.
- Commit author is the repository's configured git identity; do not override it.

## Commit messages

- Format: `type(scope): summary`. Types: feat, fix, refactor, chore, docs, test.
  Scopes in use: `engine`, `web`, `agent`, `contract`.
- One commit per feature or independently revertible change. No WIP commits on `main`.

## Repository layout

- `engine/` — Python 3.12 FastAPI server (uv): OR-Tools layout, Shapely validation,
  JuPedSim simulation, SimPy queues. Stateless computation only.
- `web/` — Next.js app (pnpm): UI, agent loop (Vercel AI SDK + Meta Model API), light backend.
- `fixtures/` — shared sample venue.
- `engine/app/schemas.py` is the data contract. After changing it, run
  `pnpm gen:engine-types` in `web/` and update `web/lib/engine/contract.ts` until
  `pnpm typecheck` passes.

## Workflow

- Work in git worktrees under `.worktrees/<slug>` on branches `wt/<slug>`, then merge into
  `main` with `--no-ff`. Push only when asked.
- Before merging: engine `uv run pytest` and `uv run ruff check .`; web `pnpm test`,
  `pnpm typecheck`, `pnpm lint`.
- Root `README.md` and `docs/` are private planning notes and are gitignored; do not commit them.
- Never commit secrets. Keys live in `web/.env.local` (gitignored).
