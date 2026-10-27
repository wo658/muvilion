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
live runs and real-engine recordings (`scenario`; the outdoor plaza browses with 300 visitors, seed 0)
and targets (`targets`; e.g. `{ crowded_s_per_visitor: 10 }`); the venue's fields win over the env.
Mock recordings pin `MOCK_RECORDING_ENV` (entry, 200, target 3 crowded s/visitor, tuned for the mock).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint`, `pnpm typecheck` | ESLint, `tsc --noEmit` |
| `pnpm gen:engine-types` | regenerate lib/engine/openapi.{json,gen.ts} from engine/ (needs uv); run after changing engine/app/schemas.py |
| `pnpm test` | vitest (contract, revision translator, scenario guard, loop e2e, stream/replay, narration, Ask Muse) |
| `pnpm record:replay` | Re-records `fixtures/replay/<venue-id>.json` for every venue by running the real loop with the stub LLM, and writes each iteration's trajectories to `public/replay/traj/<run_id>.json`. Mock engine by default (deterministic); record from the real engine with `RECORD_ENGINE_URL=http://localhost:8000 pnpm record:replay` (engine must be running; re-record after engine or scenario changes). |
| `pnpm smoke:tools` | With `MODEL_API_KEY` set, checks the model calls two tools in sequence through the AI SDK; skips cleanly without a key. |
| `pnpm sync:fixtures` | Copies `../fixtures/sample_hall.json` and `../fixtures/outdoor_plaza.json` into `fixtures/` (a test checks they match). |

## Layout

```
app/page.tsx                 review console (server component → <ReviewConsole/>)
app/api/agent/route.ts       GET status · POST live/replay UI message stream
app/api/ask/route.ts         POST AskRequest → plain-text Ask Muse answer (stub unless LIVE_AGENT=on + key)
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
lib/agent/narrate.ts         Muse's plain-language say events: facts → slots + draft, numbers guard, narrator
lib/ask/contract.ts          RunDigest / AskRequest (zod)
lib/ask/digest.ts            buildRunDigest(events): streamed events → RunDigest (pure, client-safe)
lib/ask/answer.ts            Ask Muse: system prompt, deterministic answers, numbers guard, rate limit
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
   (kind/agents/duration/seed), grid cell, `max_wall_time_s`, `crowd_threshold`, venue and booth
   popularity for the whole run, re-checks each request and checks the engine echoed the same
   scenario and crowd threshold.
   Truncated results (`truncated=true`) are never comparable.
4. **compare** (code) — on **sustained congestion**: `congestion.crowded_s_per_visitor`, the time
   the average visitor spent in 2 m grid cells at or above `crowd_threshold` (`AGENT_CROWD_THRESHOLD`,
   default 2 p/m²); lower is better. Stops on
   - *target met*: `crowded_s_per_visitor ≤ AGENT_TARGET_CROWDED_S_PER_VISITOR` (default 10; per-venue
     `targets` override) with no validation errors;
   - *no improvement*: relative reduction vs the best comparable iteration so far
     `< AGENT_MIN_IMPROVEMENT` (default 0.10), or completion fell more than
     `AGENT_MAX_COMPLETION_DROP` (default 0.05) below the baseline — less crowding because fewer
     visitors got in or finished never counts as better;
   - `AGENT_MAX_ITERATIONS`.
   Crowded person-seconds, peak crowded area and worst hotspot mean density are shown alongside;
   `max_density` (a single-instant peak) is a secondary, displayed-only metric.
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

The best comparable iteration (valid, within the completion guard, lowest crowded s/visitor) is
reported as "final"; iteration 0 is the baseline.

### Streaming

`POST /api/agent` returns an AI SDK UI message stream (`createUIMessageStream` +
`createUIMessageStreamResponse`). Each loop event becomes a typed data part
(`data-run`, `data-step` (reconciled by id: running → done), `data-brief`, `data-layout`, `data-validation`,
`data-sim`, `data-analysis`, `data-revision`, `data-comparison`, `data-report`, `data-done`,
`data-error`, `data-say`); the report text also streams as a normal text part. Types: `lib/agent/events.ts`
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

## Muse's voice (narration)

Muse "interprets everything" for a non-expert user: at each moment of the run the loop emits a
`say` event (`SayInfo`: `moment`, `text`, `tone`, `iteration?`, `booth_ids?`, `needs_approval?`, `by`)
right after the event it describes, so the UI can sync the canvas to it:

| moment | lands after | example (outdoor plaza, real engine) |
|---|---|---|
| `intro` | `run` | "Hi, I'm Muse. I'll lay out 18 market stalls, 6 food trucks and a ticket kiosk at Riverside Park Plaza, then send 300 virtual visitors through it …" |
| `brief` | `brief` | "Here's my plan: I'll keep walkways at least 3.5 m wide, leave 6 m of open space inside every gate and put the ticket kiosk right beside the main gate." |
| `placed` | baseline's final `validation` | "All 25 booths fit, with walkways at least 3.5 m wide." |
| `simulated` | baseline's `comparison` | "With 300 visitors, the area around Food Truck 3 and Food Truck 6 gets packed: the average visitor spends 18 s squeezed in crowds." |
| `revising` | each applied `revision` | "Next, I'll let 4 of the food trucks move away from the spots the organizer asked for, because … The organizer asked for those spots, so this needs your approval." (`needs_approval`) |
| `revised` | each later `comparison` | "That helped: crowding dropped from 18 s to 13 s per visitor (27% less)." |
| `result` | just before `done` | "Crowding dropped 64% (18 s → 6.5 s per visitor). This layout is ready for your review. Before you use it, please approve …" |
| `caution` | after `result` (or a truncated sim) | one per `venue.unknowns` item, plus truncated/failed runs, remaining rule breaks, mock-engine results |

**Numbers guard.** Code supplies the numbers, the model only chooses wording. For each message code
builds the facts as formatted *slots* (`{crowded}` = "18 s", `{drop}` = "64%", booth and gate names)
from run inputs and engine results, plus a deterministic *draft* template. `AgentLLM.narrate` returns
one template per message using the same `{placeholders}` (model: forced `write_messages` tool with a
friendly, non-technical American-English system prompt; stub: the drafts). Code fills the slots and
rejects the text if a placeholder is unknown, if any digit sequence is not a digit sequence of the
slot values, if it spells a number out ("half", "twice", "forty" …), or if it uses a jargon term
(`JARGON` in `lib/agent/narrate.ts`: hotspot, p/m², solver, constraint, iteration, baseline, agent …).
A rejected message falls back to the filled draft with `by: "stub"`. Tone, iteration, booth_ids and
needs_approval are always set by code (`needs_approval` = the change releases or moves a booth whose
position the organizer requested in `ProjectInput.constraints.fixed`).

Narration has its own budget (`AGENT_MAX_NARRATION_CALLS`, default 12 calls per run, separate from
`AGENT_MAX_LLM_CALLS`) and timeout (`AGENT_NARRATION_TIMEOUT_MS`, 15 s); a failed, slow or capped
call uses the drafts and never stops the run. With `AGENT_LLM=stub` every message is the draft, so
replays read naturally without a key.

## Ask Muse

`POST /api/ask` with `AskRequest {question, digest, history}` returns the answer as a plain text
stream (`x-ask-by: stub | <provider>:<model>`). The client builds the digest itself with
`buildRunDigest(events)` (`lib/ask/digest.ts`, pure): per-iteration crowding, plain change
descriptions (with booth ids), booths near the worst crowding, approvals (organizer requests the
changes gave up) and `venue.unknowns`; it works on finished, running and replayed runs alike.

- With `LIVE_AGENT=on`, a model key and `AGENT_LLM` not `stub`, the Meta model answers via
  `streamText` (system prompt: plain language, digest only, say plainly what isn't known and point to
  the unknowns, never invent numbers, 2–5 sentences, may suggest what to try next). The full answer
  is checked before it is streamed out: every number must be in the digest (any common rounding), a
  percent change between two of its crowding values, a count of its lists, or a number the user
  wrote; otherwise, and on any error, the deterministic answer is sent.
- Otherwise the deterministic answer: summary, why was X moved, is it safe, what needs approval,
  what if more visitors, what if (other), what's still unknown, and a default.
- Caps: `ASK_MAX_OUTPUT_TOKENS` (400), `ASK_RATE_LIMIT_PER_MIN` (20, per server instance),
  `ASK_TIMEOUT_MS` (20000), 64 KB request body. `400 bad_request` on invalid input, `429 rate_limited`.

```
curl -N -X POST http://localhost:3000/api/ask -H 'content-type: application/json' \
  -d '{"question":"What needs my approval?","digest":{…},"history":[]}'
```

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
which turn from grey to amber/red with their instantaneous local density. The ramp is anchored on the
crowd threshold: below 2 p/m² colors stay faint/neutral, at the threshold they turn solid amber, and
they redden above it. Tokens: `lib/ui/tokens.ts`.

## 3D pedestrian replay

The site card has a **Plan / Model** toggle; **Before / after 3D** (hall card) or **▶ Replay before / after in
3D** (Before / after card) opens baseline and a revised iteration side by side with one shared clock
and linked cameras. Controls: play/pause, scrub (simulated seconds), 1×/5×/20×, loop, camera presets
(overview, top-down, entrance). Agents are one `InstancedMesh`, linearly interpolated between frames,
hidden outside their track, colored by local density (binned per frame into 1.5 m cells).

Data: the UI rebuilds the iteration's exact `SimulateRequest` from the stream (`data-run` venue/booths,
`data-layout`, `data-sim` result scenario + `params` {grid_cell, max_wall_time_s, trajectory_dt,
crowd_threshold}) so
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
