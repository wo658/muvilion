# Engine

Stateless, deterministic computation server for the booth-layout agent: CP-SAT layout,
Shapely rule checks, JuPedSim crowd simulation and a SimPy registration queue. No LLM calls,
no persistence. The data contract lives in `app/schemas.py` (meters / seconds, origin at the
hall's bottom-left, x right, y up; a booth's `(x, y)` is its bottom-left corner and
`rotation: 90` swaps its `w`/`h` footprint).

Venues are `setting: "indoor"` (walls, doors) or `"outdoor"` (a fence with gates; gates are
`doors` and behave exactly like doors). `zones` are walkable ground areas (`fire_lane`,
`lawn`, `paved`, `stage_front`, `queue_area`); booths may not overlap a zone with
`buildable: false`, but people walk on every zone. Obstacle kinds include `tree`, `fountain`
and `structure` (all non-walkable). `BoothSpec.kind` (`booth`, `tent`, `food_truck`, `kiosk`)
is visual only: every footprint is a rectangle.

Fixtures: `fixtures/sample_hall.json` (indoor 40×30 m, 24 booths) and
`fixtures/outdoor_plaza.json` (outdoor 60×40 m park plaza: fence with two entrance gates, an
exit gate and fire-lane emergency gates, a 4 m east-west fire lane at y 18–22, an unbuildable
stage-front lawn, trees, a fountain, a stage, restrooms; 18 tents, 6 food trucks of 6×2.5 m,
1 kiosk).

## Run

```bash
cd engine
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs (CORS allows `http://localhost:3000`).

```bash
uv run pytest            # ~15 s
uv run ruff check .
uv run python scripts/demo.py   # layout -> validate -> simulate -> queue on the fixture
uv run python scripts/demo.py --fixture outdoor_plaza --agents 200
```

## Endpoints

| Method | Path        | Body → Response                   | What it does |
|--------|-------------|-----------------------------------|--------------|
| GET    | `/health`   | → `{status, versions}`            | Liveness + library versions |
| POST   | `/layout`   | `LayoutRequest` → `LayoutResponse` | CP-SAT placement on a 0.5 m grid |
| POST   | `/validate` | `ValidateRequest` → `ValidateResponse` | Geometry + connectivity rules |
| POST   | `/simulate` | `SimulateRequest` → `SimResult`   | JuPedSim run (`entry`, `browse`, `exit`) |
| POST   | `/trajectories` | `SimulateRequest` → `Trajectories` | Agent positions of that run, for 3D replay |
| POST   | `/queue`    | `QueueRequest` → `QueueResult`    | M/M/c registration desk |

### `/layout`
Booths are placed inside the hall minus `wall_margin`, avoiding obstacle bounding boxes,
unbuildable zone bounding boxes, `keep_out` rects and door/gate clearance zones
(`door_clearance` deep, door width + one aisle wide).
Every pair of booths is at least `min_aisle_width` apart along x or y. Non-square booths may
rotate 0/90. `fixed` pins booths; booths at or above `popular_threshold` keep
`popular_door_distance` from entrances. Objective: compactness around the hall center; when
the venue has a fire lane, booths are pulled toward the lane instead (distance across the lane
weighs 4× distance along it), which lines both sides of the lane with rows of booths. Plus a
heavily weighted displacement term from `previous` when given (revisions move as little as
possible). The solver uses a deterministic-time budget (`time_limit_s`) so the same request
returns the same layout. `status: "infeasible"` returns an empty booth list and no steps.

`steps` lets the web animate empty site → first feasible → better → final: up to 12 improving
solutions `{t_s, objective, booths}` in the order found, objectives strictly decreasing
(minimization), sampled evenly over the objective range, first one = first feasible solution,
last one = the returned `layout`. `t_s` is wall time since the request started (the only
non-reproducible field). The intermediate steps come from a single-worker CP-SAT solve of the
same model that runs alongside the main 8-worker solve with a deterministic budget of
`min(2, time_limit_s / 4)`: a solution callback on the main solve would make its result vary
between runs, while a single worker reports the same solutions every time. Typical numbers
(default `time_limit_s` 10, 18-core dev machine): indoor ~4 s, outdoor ~4.5 s, 12 steps each.

### `/validate`
Rules (`rule_id`, severity): `booth_overlap` (error), `booth_outside_hall` (error),
`wall_margin` (warning), `booth_over_obstacle` (error), `door_clearance` (error), `keep_out`
(error), `aisle_width` (error), `zone_unbuildable` (error, booth over a `buildable: false`
zone), `fire_lane_blocked` (error, anything — booth or obstacle — that keeps a fire lane from
being clear over its full width end to end, along the long side of its bounding box),
`booth_unreachable` / `door_unreachable` / `entrance_blocked` (error). Connectivity erodes the
free floor by half the aisle width and checks that every booth and every exit/emergency door
(gate) touches the component connected to an entrance; zones are walkable and never block.
`source` is `internal:geometry` for geometry rules and `venue:zones/<zone id>` for zone rules
(they come from the site plan's designations, not from a building code).

### `/simulate`
Walkable area = hall (or site) − booths − obstacles (gaps < 0.7 m removed); zones are
walkable, gates are the doors. Scenarios:
- `entry`: agents arrive at the entrance over the first half of `duration_s`, visit one booth
  (weighted by popularity²), dwell, then disperse to a point in the hall.
- `browse`: agents start scattered, visit 2–4 booths, then leave by the nearest exit/entrance.
- `exit`: agents start scattered and evacuate via the nearest door (any kind).

Dwell = (10 s + 50 s × popularity) × U(0.7, 1.3); the agent stands still at a booth-front
point. Density is sampled every 1 s on a `grid_cell` grid (people / walkable m² of the cell);
`grid.peak` is the per-cell peak, hotspots are connected high-peak cells with their mean density
and nearby booths. Travel time = spawn → final goal for agents that finished. Same request
(incl. seed) → identical result except `wall_time_s`; `run_id` is a hash of the request.
`max_wall_time_s` (default 60) stops runaway runs and sets `truncated: true`.

### `/trajectories`
Same body as `/simulate`; returns the agent positions of that run with the same `run_id` and
`layout_id`. Every live agent is sampled every `trajectory_dt` seconds of simulated time
(default 0.5; frame `k` is at `k * dt`, `frames` is the number of sampled frames). Tracks have
ids `0..n-1` in spawn order, `t0` = frame of the first sample and `xy` = flat
`[x0, y0, x1, y1, ...]` in meters (1 cm), one pair per frame until the agent leaves or the run
ends; dwelling agents repeat their position. `/simulate` keeps the last 16 runs' trajectories in
memory, so calling `/trajectories` right after it costs no second run; on a miss the run is
repeated (deterministic, so the result is identical). Size: about 1 MB of JSON (~150 kB
gzipped) for 200 agents over 300 s. `trajectory_dt` is part of the request, so it changes
`run_id` but not the metrics.

### Outdoor plaza numbers
Default layout, 300 s, seed 0 (wall times on an 18-core dev machine, single run):

| Scenario | Agents | Done | Max density | Top hotspot | Wall |
|----------|--------|------|-------------|-------------|------|
| `entry`  | 200 | 0.99 | 2.00 p/m² | (16,8) near M12 | 6 s |
| `browse` | 200 | 0.78 | 3.00 p/m² | (16,16) near F3, M01 | 14 s |
| `exit`   | 200 | 1.00 | 1.25 p/m² | main gate | 0.4 s |

Before/after demo: pin the six food trucks in two rows just inside the main gate
(`constraints.fixed`: F1 (16,6), F2 (25,6), F3 (34,6), F4 (16,11.5), F5 (25,11.5),
F6 (34,11.5)) and run `entry` with 400 agents: max density 3.50 p/m² with the top hotspots
between the trucks at the gate. Revising with `previous` = that layout and
`popular_door_distance: 12, popular_threshold: 0.7` moves only the trucks (and two tents) and
brings the peak to 2.50 p/m², with the top hotspot moving off the gate to the trucks' new spot
(seed 0; peaks are per 2 m cell and vary by about ±0.5 p/m² between seeds: seed 1 gives
3.50 → 3.25). Wall time ≈ 20 s per run.

## curl

```bash
# The fixture is already a valid LayoutRequest ({venue, booths}).
curl -s localhost:8000/layout -H 'content-type: application/json' \
  -d @../fixtures/sample_hall.json | jq '{status, id: .layout.id}'

# layout -> simulate (needs jq)
LAYOUT=$(curl -s localhost:8000/layout -H 'content-type: application/json' \
  -d @../fixtures/sample_hall.json | jq '.layout')
jq --argjson layout "$LAYOUT" \
  '{venue, booths, layout: $layout, scenario: {kind: "browse", agents: 200, duration_s: 300}}' \
  ../fixtures/sample_hall.json \
  | curl -s localhost:8000/simulate -H 'content-type: application/json' -d @- \
  | jq '{completed_fraction, mean_travel_time_s, max_density, hotspots: .hotspots[:3]}'

# same request -> trajectories (served from the run cache after /simulate)
jq --argjson layout "$LAYOUT" \
  '{venue, booths, layout: $layout, scenario: {kind: "browse", agents: 200, duration_s: 300}}' \
  ../fixtures/sample_hall.json \
  | curl -s localhost:8000/trajectories -H 'content-type: application/json' -d @- \
  | jq '{run_id, dt, frames, tracks: (.agents | length), first: .agents[0] | {id, t0, xy: .xy[:4]}}'

curl -s localhost:8000/queue -H 'content-type: application/json' \
  -d '{"arrivals_per_min": 6, "service_time_s": 25, "servers": 3}'
```

## Layout

```
app/
  main.py               FastAPI app, CORS, routers
  schemas.py            shared contract (mirrored by the web app)
  geometry.py           Shapely helpers shared by all features
  layout/solver.py      CP-SAT model + steps trace
  validation/rules.py   rule functions + validate()
  sim/walkable.py       walkable polygon, booth-front points, door geometry
  sim/scenarios.py      per-agent plans for entry / browse / exit
  sim/metrics.py        density grid, hotspots, travel stats
  sim/runner.py         JuPedSim loop + trajectory recording
  sim/cache.py          LRU of recent runs' trajectories (by run_id)
  registration_queue.py SimPy M/M/c
  routers/              one router per endpoint
```
