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

With `LIVE_AGENT` unset/off the console still works: **Watch recorded run** streams
the recorded run of the venue picked in the header (`fixtures/replay/<venue-id>.json`).

## Who does what

Muse decides intent; the open-source engines compute; our code keeps the comparison honest.
The LLM never produces a number: coordinates come from OR-Tools, checks from Shapely, metrics
from JuPedSim, and every table in the report from code. (Same table in `lib/ui/actors.ts`,
which drives the pipeline panel and the **How it works** explainer.)

| Component | Role |
|---|---|
| **Muse** (Meta Model API) | Reads the site and writes the design brief; interprets simulation results; decides revisions; writes the report prose. |
| **OR-Tools CP-SAT** | Computes booth coordinates satisfying the constraints (no overlap, aisle widths, door clearance, keep-outs) and minimises displacement on revisions. |
| **Shapely** | Geometry checks: overlap, outside the site, obstacle/zone conflicts, aisle width, reachability of every booth and door, fire-lane continuity. |
| **JuPedSim** | Pedestrian simulation: agents walk, queue and dwell; outputs density, travel time, completion and trajectories. |
| **SimPy** | Queue model for ticket/registration desks (`POST /queue`). Available, not called by the loop yet — shown as idle. |
| **Code** (ours) | Locks the scenario so before/after are compared under identical conditions; translates intent into constraints; aggregates metrics; renders the views. |

## Venues

The header's **Indoor hall / Outdoor plaza** control picks a sample venue (`lib/venues`): live runs
POST that venue's project, replays stream its recording. A venue may override scenario fields for
live runs and real-engine recordings (the outdoor plaza uses an entry rush of 400 visitors, seed 0);
mock recordings pin `MOCK_RECORDING_ENV` (entry, 200, target 2.0 p/m², tuned for the mock).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint`, `pnpm typecheck` | ESLint, `tsc --noEmit` |
| `pnpm gen:engine-types` | regenerate lib/engine/openapi.{json,gen.ts} from engine/ (needs uv); run after changing engine/app/schemas.py |
| `pnpm test` | vitest (contract, revision translator, scenario guard, loop e2e, stream/replay) |
| `pnpm record:replay` | Re-records `fixtures/replay/<venue-id>.json` for every venue by running the real loop with the stub LLM, and writes each iteration's trajectories to `public/replay/traj/<run_id>.json`. Mock engine by default (deterministic); record from the real engine with `RECORD_ENGINE_URL=http://localhost:8000 pnpm record:replay` (engine must be running; re-record after engine or scenario changes). |
| `pnpm smoke:tools` | With `MODEL_API_KEY` set, checks the model calls two tools in sequence through the AI SDK; skips cleanly without a key. |
| `pnpm sync:fixtures` | Copies `../fixtures/sample_hall.json` and `../fixtures/outdoor_plaza.json` into `fixtures/` (a test checks they match). |

## Layout

```
app/page.tsx                 review console (server component → <ReviewConsole/>)
app/api/agent/route.ts       GET status · POST live/replay UI message stream
app/api/trajectories/route.ts POST SimulateRequest → engine /trajectories (LIVE_AGENT=on, caps, LRU)
components/hall-3d/          3D replay (React Three Fiber): scene, instanced agents, shared clock, before/after
components/                  review-console, stage (2D/3D + placement animation), hall-view (SVG plan),
                             panels (roles, pipeline steps, brief, metrics, comparison, report), how-it-works, ui
lib/ui/tokens.ts             design tokens (the one place colors are defined; written to CSS variables by app/layout.tsx)
lib/ui/actors.ts             who-does-what table (pipeline panel, explainer)
lib/ui/placement.ts          empty site → placed layout animation over LayoutResponse.steps
lib/venues/                  sample venues (indoor hall, outdoor plaza), per-venue scenario overrides
lib/agent/brief.ts           design brief: site summary for the LLM, brief vocabulary (zod), brief → first LayoutRequest
lib/engine/contract.ts       zod mirror of engine/app/schemas.py (runtime validation)
lib/engine/openapi.gen.ts    types generated from the engine's OpenAPI spec (pnpm gen:engine-types)
lib/engine/contract-drift.ts compile-time check that contract.ts matches openapi.gen.ts
lib/engine/client.ts         typed HTTP client (ENGINE_URL, zod-validated responses, timeouts)
lib/engine/mock.ts           deterministic mock engine (ENGINE_MOCK=1); mock-trajectories.ts for /trajectories
lib/trajectory/              hall→world mapping (coords.ts), playback math, SimulateRequest rebuild
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

0. **brief** (once, on the empty site) — the LLM reads a code-built site summary (setting, doors,
   zones, obstacles, unknowns, booth list, expected attendance) and returns a design brief through the
   forced `submit_design_brief` tool: a rationale plus initial constraint choices (`min_aisle_width`,
   `door_clearance`, `popular_threshold`/`popular_door_distance`, `keep_clear_at_doors` (open area in
   front of a gate — the rectangle is computed in code from the door geometry), `keep_out` rects,
   `place_near_door` (a spot beside the door, outside its walking line, clear of obstacles, zones,
   clearances and keep-outs — computed in code and pinned in `fixed`)). Each item is zod-validated;
   set_* and keep-outs go through the revision translator (`applyRevision` with no layout, so
   `previous` stays null). The stub's rule-based brief: outdoor → wider aisles and gate clearance,
   kiosks beside the main gate; indoor → defaults, popular booths away from the entrance only at
   high attendance. Emitted as `data-brief`.
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
(`data-run`, `data-step` (reconciled by id: running → done), `data-brief`, `data-layout`, `data-validation`,
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

## Placement animation

`LayoutResponse.steps` (the solver's improving solutions, last = final) drive an "empty site →
placed layout" opening in both views (`lib/ui/placement.ts`): the empty site with the brief's
keep-outs, booths dropping in at the first feasible solution, then gliding through every later
solution (eased, by step index — not `t_s`) into the final layout, ~4 s, skippable and replayable.
The console holds the stage on the baseline until it has played; replays pause the stream for the
same time after the first layout so it plays before the simulation results arrive.

## Visual language

"Architectural model": warm off-white ground, white matte booth models with soft shadows, hairline
plan drawing, Inter + IBM Plex Mono figures, one deep-teal accent for interaction and "the agent
changed this". Saturated color is reserved for crowding (transparent → amber → orange → red,
`lib/ui/heat.ts`), used by the plan's soft density gradient, the 3D floor decal and pedestrians,
which turn from grey to amber/red with their instantaneous local density. Tokens: `lib/ui/tokens.ts`.

## 3D pedestrian replay

The site card has a **Plan / Model** toggle; **Before / after 3D** (hall card) or **▶ Replay before / after in
3D** (Before / after card) opens baseline and a revised iteration side by side with one shared clock
and linked cameras. Controls: play/pause, scrub (simulated seconds), 1×/5×/20×, loop, camera presets
(overview, top-down, entrance). Agents are one `InstancedMesh`, linearly interpolated between frames,
hidden outside their track, colored by local density (binned per frame into 1.5 m cells).

Data: the UI rebuilds the iteration's exact `SimulateRequest` from the stream (`data-run` venue/booths,
`data-layout`, `data-sim` result scenario + `params` {grid_cell, max_wall_time_s, trajectory_dt}) so
`/trajectories` returns the same `run_id` (the engine caches it). Replay runs fetch
`/replay/traj/<run_id>.json`; live runs `POST /api/trajectories?expect=<run_id>`. Trajectories never go
into the agent stream or LLM input. Coordinates: hall (x, y) → three.js world (x, h, −y)
(`lib/trajectory/coords.ts`).

Route env: `TRAJECTORY_MAX_AGENTS` (default 1000), `TRAJECTORY_MAX_CONCURRENT` (2),
`ENGINE_TRAJECTORIES_TIMEOUT_MS` (120000; effective max(this, max_wall_time_s + 60 s)).

## Engine contract assumptions

See the header of `lib/engine/contract.ts`. In addition the agent assumes:
`GET /health` returns a JSON object; `/simulate` echoes the request's `scenario` in `SimResult.scenario`;
`/layout` with `previous` keeps booths near their `previous` positions (used for `move_booth`);
`popular_door_distance` is a square zone around each entrance segment.

The mock engine is *not* a pedestrian model: it produces a synthetic density field that reacts to
the agent's knobs so the loop can be demoed. Reports from mock runs say so.
