# Engine

Stateless, deterministic computation server for the booth-layout agent: CP-SAT layout,
Shapely rule checks, JuPedSim crowd simulation and a SimPy registration queue. No LLM calls,
no persistence. The data contract lives in `app/schemas.py` (meters / seconds, origin at the
hall's bottom-left, x right, y up; a booth's `(x, y)` is its bottom-left corner and
`rotation: 90` swaps its `w`/`h` footprint).

## Run

```bash
cd engine
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs (CORS allows `http://localhost:3000`).

```bash
uv run pytest            # ~12 s
uv run ruff check .
uv run python scripts/demo.py   # layout -> validate -> simulate -> queue on the fixture
```

## Endpoints

| Method | Path        | Body → Response                   | What it does |
|--------|-------------|-----------------------------------|--------------|
| GET    | `/health`   | → `{status, versions}`            | Liveness + library versions |
| POST   | `/layout`   | `LayoutRequest` → `LayoutResponse` | CP-SAT placement on a 0.5 m grid |
| POST   | `/validate` | `ValidateRequest` → `ValidateResponse` | Geometry + connectivity rules |
| POST   | `/simulate` | `SimulateRequest` → `SimResult`   | JuPedSim run (`entry`, `browse`, `exit`) |
| POST   | `/queue`    | `QueueRequest` → `QueueResult`    | M/M/c registration desk |

### `/layout`
Booths are placed inside the hall minus `wall_margin`, avoiding obstacle bounding boxes,
`keep_out` rects and door clearance zones (`door_clearance` deep, door width + one aisle wide).
Every pair of booths is at least `min_aisle_width` apart along x or y. Non-square booths may
rotate 0/90. `fixed` pins booths; booths at or above `popular_threshold` keep
`popular_door_distance` from entrances. Objective: compactness around the hall center, plus a
heavily weighted displacement term from `previous` when given (revisions move as little as
possible). The solver uses a deterministic-time budget (`time_limit_s`) so the same request
returns the same layout. `status: "infeasible"` returns an empty booth list.

### `/validate`
Rules (`rule_id`, severity): `booth_overlap` (error), `booth_outside_hall` (error),
`wall_margin` (warning), `booth_over_obstacle` (error), `door_clearance` (error), `keep_out`
(error), `aisle_width` (error), `booth_unreachable` / `door_unreachable` / `entrance_blocked`
(error). Connectivity erodes the free floor by half the aisle width and checks that every booth
and every exit/emergency door touches the component connected to an entrance.

### `/simulate`
Walkable area = hall − booths − obstacles (gaps < 0.7 m removed). Scenarios:
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

curl -s localhost:8000/queue -H 'content-type: application/json' \
  -d '{"arrivals_per_min": 6, "service_time_s": 25, "servers": 3}'
```

## Layout

```
app/
  main.py               FastAPI app, CORS, routers
  schemas.py            shared contract (mirrored by the web app)
  geometry.py           Shapely helpers shared by all features
  layout/solver.py      CP-SAT model
  validation/rules.py   rule functions + validate()
  sim/walkable.py       walkable polygon, booth-front points, door geometry
  sim/scenarios.py      per-agent plans for entry / browse / exit
  sim/metrics.py        density grid, hotspots, travel stats
  sim/runner.py         JuPedSim loop
  registration_queue.py SimPy M/M/c
  routers/              one router per endpoint
```
