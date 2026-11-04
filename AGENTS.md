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

- `web/` — Next.js app (pnpm): UI, Meta Model drawing/design workflows and the application API.
- `web/server/plans/` — model orchestration and bounded PDF/image preview preparation.
- `web/lib/plans/schema.ts` — application drawing contract and runtime validation.
- `fixtures/` — legacy authored venue fixtures used by presentation assets, not runtime computation.
- Python/FastAPI, layout solvers and engine OpenAPI generation have been removed.

## Workflow

- Work in git worktrees under `.worktrees/<slug>` on branches `wt/<slug>`, then merge into
  `main` with `--no-ff`. Push only when asked.
- Before merging: web `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`.
- Root `README.md` is the public project overview; keep it in step with how the app works.
  `docs/` holds private planning notes and is gitignored; do not commit it.
- Never commit secrets. Keys live in `web/.env.local` or the local SQLite data directory
  (`web/data/` by default), both gitignored. Never include keys in project exports.

## Server responsibilities

- Next.js owns browser APIs, model calls, drawing/design orchestration, document previews,
  responses, project persistence and examples. There is no Python computation service.
- Meta Model interprets drawing images and proposes spatial designs. Document preparation
  only renders source images; do not reintroduce local OCR, vector-line inference or solvers.
- Request-scoped Node workers may render bounded document previews and must terminate on
  timeout/cancellation. They hold no application state and are not durable jobs.
- Keep HTTP handlers thin: parse and validate requests, call a feature service, and map
  results/errors to HTTP responses. Put reusable work in feature modules.
- Do not add a third server, durable job system, or database just to reorganize code.
  Revisit execution architecture when work must survive disconnects or process restarts.

## Code organization and migration

- `web/server/` contains server-only feature modules: `agent/`, `plans/`, and `projects/`.
  Keep new server work in these modules. Update imports and tests together.
- Keep browser code and shared pure functions/types separate from server modules.
  Follow `web/AGENTS.md` for the web boundary.
- `web/lib/plans/schema.ts` owns the drawing contract. Preserve existing project/export
  compatibility: legacy extraction provenance remains readable, but new imports use
  source-preview or model-reading provenance. No engine contract generation is needed.

## Examples and fixtures

- Keep test fixtures distinct from user-facing examples and generated run artifacts.
- User-facing sample drawings live in `data/samples/`, listed once in `samples.json`
  (provenance in its README). The start screen copies a chosen sample into SQLite as a new
  project; do not add another list of example filenames in UI or API handlers.
- When adding generated examples, distinguish recorded playback, mock computation, and live computation in example metadata
  and user-facing descriptions. A mock result is not a measured simulation result.
- Do not assume local untracked `DemoData/` files exist in a fresh checkout. Declare any
  external example directory explicitly and handle unavailable examples clearly.
- Before bundling third-party example assets, record their source and redistribution terms.
  Keep optional external assets out of the default example path until this is resolved.
- Put public setup and example documentation in tracked locations (the root README or
  `web/`); `docs/` remains private under the workflow above.

## Design and color tokens

- `web/design.md` is the interface specification: layout, copy, tokens, language and
  verification. Read it before changing UI and update it in the same commit when a rule changes.
- `web/lib/ui/tokens.ts` is the only place colors are defined. Neutrals come from one
  validated scale (Radix Colors Slate, light); keep the brand accent and status colors as they are.
- In UI code, use token roles only: Tailwind theme names (`bg-surface`, `text-muted`), CSS
  variables (`var(--hairline)`) or `TOKENS` in canvas/3D code. Never write hex, `rgb()`,
  `oklch()` or `"white"`/`"black"` literals. Need a new color? Add a named token by role,
  not by appearance, and reuse an existing token when one is close.
- Pick tokens by role, not by how they look: `bg` behind panels, `surface` for sidebars,
  headers, panels and dialogs, `sunken` for wells and hover, `selected` for current/pressed.
  Text uses `ink`, `inkSoft` or `muted`; `faint` is for icons only.
- `web/tests/tokens.test.ts` enforces this. It checks WCAG AA contrast for token pairs and
  rejects literal colors outside the documented artwork exceptions (exhibition materials,
  the mascot). Do not weaken a threshold or widen an exception to make a change pass.
  Fix the token or the usage instead, and record any new exception in `web/design.md`.
- Server-rendered source previews are evidence images, not interface styling.
- New drawing uploads support PDF/PNG/JPG only. Preserve saved DXF previews, geometry
  and originals in existing projects/exports; never re-render them on load.

## Muvi mascot

- Muvi is the muvilion mascot. Use the canonical assets in `web/public/mascot/`
  for the website, chat avatars/launcher and icons. Keep its rounded M silhouette,
  periwinkle body and dark eyes consistent across 2D and 3D; omit cheek blush.
- The 3D drawing viewer includes optional decorative Muvi roaming. For now this is
  an illustrative animation only: do not connect it to wall collision, pathfinding,
  physical scale, occupancy/simulation or design validation. Agent operation events may
  select decorative work animations only; they never apply geometry or imply completed work.
- Muvi must not become a `PlanDocument` object or enter project persistence, exports,
  undo history or model/tool geometry inputs. Viewing dimensions may frame its demonstration
  path; its position and controls remain ephemeral browser state.
- Preserve pause/hide controls, reduced-motion and hidden-page behavior. Mascot
  failures must not break the drawing viewer or intercept drawing selection.
- Reuse the shared 3D model renderer and GLB; do not create competing character
  implementations. See `web/docs/muvi.md` for assets and rebuild commands.

## Architecture decisions

- Start with [architecture/README.md](architecture/README.md) and the [ADR index](architecture/adr/README.md) for current architecture and decision history.
- Update ADRs with material changes to service boundaries, data ownership, persistence or contracts. Supersede old decisions explicitly rather than erasing history.
- Use [GLOSSARY.md](GLOSSARY.md) for domain terms. `docs/` remains private and gitignored.
