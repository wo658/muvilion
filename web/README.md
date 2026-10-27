# web — Autonomous Event Layout Engineer (frontend + agent server)

Next.js 16 (App Router) app that hosts the review console, the agent loop and the
streaming agent API. All geometry / simulation work is done by the Python engine
(`../engine`, FastAPI); this app only orchestrates it.

```
pnpm install
cp .env.example .env.local     # then edit
pnpm dev                       # http://localhost:3000
```

Run the full loop without Python or an API key:

```
ENGINE_MOCK=1 AGENT_LLM=stub LIVE_AGENT=on pnpm dev
```

With `LIVE_AGENT` unset/off the console still works: **Watch sample run** streams
a recorded run (`fixtures/replay/sample-run.json`).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint`, `pnpm typecheck` | ESLint, `tsc --noEmit` |
| `pnpm test` | vitest (contract, revision translator, scenario guard, loop e2e, stream/replay) |
| `pnpm record:replay` | Re-records `fixtures/replay/sample-run.json` by running the real loop against the mock engine with the stub LLM (deterministic; a test asserts the committed file still matches). |
| `pnpm smoke:tools` | With `MODEL_API_KEY` set, checks the model calls two tools in sequence through the AI SDK; skips cleanly without a key. |
| `pnpm sync:fixtures` | Copies `../fixtures/sample_hall.json` into `fixtures/` (a test checks they match). |

## Layout

```
app/page.tsx                 review console (server component → <ReviewConsole/>)
app/api/agent/route.ts       GET status · POST live/replay UI message stream
components/                  hall-view (SVG), panels (timeline, metric cards, comparison, report), review-console
lib/engine/contract.ts       zod mirror of engine/app/schemas.py (to be replaced by OpenAPI-generated types)
lib/engine/client.ts         typed HTTP client (ENGINE_URL, zod-validated responses, timeouts)
lib/engine/mock.ts           deterministic mock engine (ENGINE_MOCK=1)
lib/agent/loop.ts            the code-controlled loop
lib/agent/revision.ts        revision vocabulary (zod) + revision → LayoutRequest translator
lib/agent/scenario.ts        identical-conditions guard
lib/agent/analysis.ts        metrics, LLM-facing summaries, agent-side checks, stop decision
lib/agent/report.ts          report assembly (code tables + LLM prose)
lib/agent/llm*.ts, model.ts  AgentLLM interface, stub, AI SDK implementation, provider config
lib/agent/stream.ts          AgentEvent → UI message stream encoder (shared by live + replay)
```

## Agent design

The control flow is fixed in code; the LLM only does judgment.

1. **generate** — `POST /layout` with the current constraints (`previous` set on revisions).
2. **validate** — `POST /validate` plus agent-side checks the engine cannot do without booth
   specs (`popular_door_distance`, missing booths, infeasible solve). On errors the LLM proposes
   constraint fixes (same revision tool) and the layout is regenerated, up to `AGENT_MAX_FIX_ATTEMPTS`.
3. **simulate** — `POST /simulate`, built only through `ScenarioGuard`, which locks scenario
   (kind/agents/duration/seed), grid cell, `max_wall_time_s`, venue and booth popularity for the
   whole run, re-checks each request and checks the engine echoed the same scenario.
   Truncated results (`truncated=true`) are never comparable.
4. **compare** (code) — vs previous and baseline; stop on target met (`max_density ≤
   AGENT_TARGET_MAX_DENSITY` with no errors), no improvement (`< AGENT_MIN_IMPROVEMENT` vs best so far)
   or `AGENT_MAX_ITERATIONS`.
5. **analyze** — LLM reads a compact summary (metrics, hotspots with nearby booths, popularity,
   distance to entrance, violations; never raw grids) and returns causes via a forced tool call.
6. **revise** — LLM returns actions via the `propose_revision` tool: `move_booth` (direction +
   distance; coordinates computed in code), `pin_booth`/`unpin_booth`, `widen_aisle_at_hotspot`
   (keep-out derived from the hotspot zone), `add_keep_out`/`remove_keep_out`,
   `set_popular_door_distance`, `set_popular_threshold`, `set_min_aisle_width`, `set_door_clearance`.
   Each action is zod-validated; invalid ones are reported and skipped. `applyRevision` builds the
   next `LayoutRequest` with `previous` = current layout (minimal displacement); `move_booth` shifts
   that booth's anchor in `previous`.
7. **report** — code renders the before/after table, iteration history, applied changes,
   assumptions, unconfirmed items (`venue.unknowns`, remaining warnings) and the
   not-a-certification disclaimer; the LLM writes only the Summary prose and is told not to state numbers.

The best valid iteration (lowest max density) is reported as "final"; iteration 0 is the baseline.

### Streaming

`POST /api/agent` returns an AI SDK UI message stream (`createUIMessageStream` +
`createUIMessageStreamResponse`). Each loop event becomes a typed data part
(`data-run`, `data-step` (reconciled by id: running → done), `data-layout`, `data-validation`,
`data-sim`, `data-analysis`, `data-revision`, `data-comparison`, `data-report`, `data-done`,
`data-error`); the report text also streams as a normal text part. Types: `lib/agent/events.ts`
(`AgentUIMessage`). The UI consumes it with `useChat<AgentUIMessage>` + `DefaultChatTransport`.

```
curl -N -X POST 'http://localhost:3000/api/agent?mode=replay&speed=0'   # replay, no pacing
curl -N -X POST 'http://localhost:3000/api/agent?mode=live'             # needs LIVE_AGENT=on
curl http://localhost:3000/api/agent                                    # status
```

`mode` defaults to live when `LIVE_AGENT=on`, else replay; a live request with the kill switch
off gets `403 live_disabled`. Daily/concurrent caps are in-memory per server instance.

### Model

`lib/agent/model.ts`: `createOpenAICompatible({ name: 'meta', baseURL: META_BASE_URL, apiKey: MODEL_API_KEY })`,
model `META_MODEL` (default `muse-spark-1.3`). `MODEL_PROVIDER=baseten` switches to the
Baseten-hosted `meta-models/muse-spark-open-1026`. Structured outputs use forced function tools
(`toolChoice: { type: 'tool', toolName }`), so only OpenAI-style function calling is required.
Unless `AGENT_LLM_FALLBACK=off`, a failing model call falls back to the stub for that step and
the UI shows a note.

## Engine contract assumptions

See the header of `lib/engine/contract.ts`. In addition the agent assumes:
`GET /health` returns a JSON object; `/simulate` echoes the request's `scenario` in `SimResult.scenario`;
`/layout` with `previous` keeps booths near their `previous` positions (used for `move_booth`);
`popular_door_distance` is a square zone around each entrance segment.

The mock engine is *not* a pedestrian model: it produces a synthetic density field that reacts to
the agent's knobs so the loop can be demoed. Reports from mock runs say so.
