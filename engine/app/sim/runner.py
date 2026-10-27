"""JuPedSim run loop: spawn agents, drive booth dwell, sample density, collect metrics.

Dwell is implemented outside JuPedSim: each agent follows its own journey of waypoint stages;
when the engine sees an agent advance past a booth waypoint it sets the agent's desired speed
to 0 for the dwell time, so it stands (and takes up space) in front of the booth.

Positions are also recorded every `trajectory_dt` of simulated time for 3D replay; the extra
iterate() splits this needs leave the simulation (and so every metric) unchanged.
"""

from __future__ import annotations

import hashlib
import math
import time
from dataclasses import dataclass

import jupedsim as jps
import numpy as np

from app.schemas import AgentTrack, SimResult, SimulateRequest, Trajectories
from app.sim.metrics import DensityAccumulator, travel_stats
from app.sim.scenarios import WAYPOINT_RADIUS, AgentPlan, build_world, make_plans
from app.sim.walkable import booth_polys, build_walkable

DT = 0.01
POLL_EVERY = 20  # iterations between Python-side bookkeeping (0.2 s)
SAMPLE_EVERY = 100  # iterations between density samples (1 s)
GIVE_UP_S = 90.0  # skip a booth whose waypoint could not be reached in this time
AGENT_RADIUS = 0.2
SPAWN_GAP = 0.5
# Scattered starts are random, not crowd-formed; skip them so they don't set the peak.
WARMUP_S = 5.0


@dataclass
class _Agent:
    plan: AgentPlan
    journey_id: int
    stages: list[int]
    agent_id: int | None = None
    spawned_at: float | None = None
    idx: int = 0  # index into stages of the current target
    target_since: float = 0.0
    dwell_until: float | None = None
    done_at: float | None = None


class TrackRecorder:
    """Samples every live agent's position every `every` iterations (frame k = step k*every).

    Agents get stable small ids in spawn order. An agent is in the simulation for one
    contiguous span, so each track is a start frame plus consecutive positions.
    """

    def __init__(self, trajectory_dt: float) -> None:
        self.every = max(1, round(trajectory_dt / DT))
        self.frames = 0
        self._track_of: dict[int, int] = {}  # JuPedSim id -> track id
        self._t0: list[int] = []
        self._xy: list[list[float]] = []

    @property
    def dt(self) -> float:
        return round(self.every * DT, 6)

    @property
    def next_step(self) -> int:
        return self.frames * self.every

    def register(self, jps_id: int) -> None:
        self._track_of[jps_id] = len(self._t0)
        self._t0.append(-1)
        self._xy.append([])

    def record(self, sim: jps.Simulation) -> None:
        k = self.frames
        for agent in sim.agents():
            tid = self._track_of[agent.id]
            if self._t0[tid] < 0:
                self._t0[tid] = k
            self._xy[tid].extend(agent.position)
        self.frames += 1

    def iterate(self, sim: jps.Simulation, step: int, n: int) -> None:
        """sim.iterate(n) from `step`, stopping at sample steps inside the window to record.

        Splitting iterate() calls does not change the simulation, so metrics are unaffected.
        """
        end = step + n
        while step < end:
            nxt = min(end, self.next_step) if self.next_step > step else end
            sim.iterate(nxt - step)
            step = nxt
            if step == self.next_step and step < end:
                self.record(sim)

    def result(self, run_id: str, layout_id: str) -> Trajectories:
        agents = [
            AgentTrack(id=i, t0=t0, xy=np.round(xy, 2).tolist())
            for i, (t0, xy) in enumerate(zip(self._t0, self._xy, strict=True))
            if t0 >= 0
        ]
        return Trajectories(
            run_id=run_id, layout_id=layout_id, dt=self.dt, frames=self.frames, agents=agents
        )


def run_id_for(req: SimulateRequest) -> str:
    payload = req.model_dump_json(exclude={"max_wall_time_s"})
    return "S-" + hashlib.sha1(payload.encode()).hexdigest()[:12]


def _add_journey(sim: jps.Simulation, stages: list[int]) -> int:
    journey = jps.JourneyDescription(stages)
    for a, b in zip(stages, stages[1:], strict=False):
        journey.set_transition_for_stage(a, jps.Transition.create_fixed_transition(b))
    return sim.add_journey(journey)


def _spawn(sim: jps.Simulation, st: _Agent, pos: tuple[float, float], t: float) -> None:
    params = jps.CollisionFreeSpeedModelAgentParameters(
        position=pos,
        journey_id=st.journey_id,
        stage_id=st.stages[0],
        desired_speed=st.plan.desired_speed,
        radius=AGENT_RADIUS,
    )
    st.agent_id = sim.add_agent(params)
    st.spawned_at = t
    st.target_since = t


def _free_spawn_point(sim: jps.Simulation, spawns: list, offset: int):
    """First unoccupied spawn point, starting at a per-agent offset to spread arrivals."""
    for k in range(len(spawns)):
        p = spawns[(offset + k) % len(spawns)]
        # agents_in_range returns a lazy iterator, which is always truthy.
        if not list(sim.agents_in_range(p, SPAWN_GAP + AGENT_RADIUS)):
            return p
    return None


def _advance(sim: jps.Simulation, st: _Agent, agent: jps.Agent, t: float) -> None:
    """Bookkeeping for one live agent at time t."""
    plan, n_visits = st.plan, len(st.plan.visits)
    if st.dwell_until is not None:
        if t >= st.dwell_until:
            agent.model.desired_speed = plan.desired_speed
            st.dwell_until = None
            st.target_since = t
        return
    if st.idx < n_visits and agent.stage_id != st.stages[st.idx]:
        # JuPedSim moved the agent on to the next stage: it reached the booth.
        agent.model.desired_speed = 0.0
        st.dwell_until = t + plan.visits[st.idx].dwell_s
        st.idx += 1
        return
    if st.idx < n_visits and t - st.target_since > GIVE_UP_S:
        st.idx += 1
        sim.switch_agent_journey(st.agent_id, st.journey_id, st.stages[st.idx])
        st.target_since = t
        return
    at_end = st.idx == n_visits and plan.final_kind == "point"
    if at_end and math.dist(agent.position, plan.final_point) <= WAYPOINT_RADIUS:
        sim.mark_agent_for_removal(st.agent_id)
        st.done_at = t


def run_simulation(req: SimulateRequest) -> SimResult:
    return simulate_with_tracks(req)[0]


def simulate_with_tracks(req: SimulateRequest) -> tuple[SimResult, Trajectories]:
    wall0 = time.perf_counter()
    sc = req.scenario
    walkable = build_walkable(req.venue, req.layout)
    sim = jps.Simulation(model=jps.CollisionFreeSpeedModel(), geometry=walkable, dt=DT)
    world = build_world(sim, walkable, req.venue, req.layout, req.booths)
    plans = make_plans(world, sc)

    agents = []
    for plan in plans:
        stages = [v.stage_id for v in plan.visits] + [plan.final_stage]
        agents.append(_Agent(plan, _add_journey(sim, stages), stages))
    by_id: dict[int, _Agent] = {}
    pending = list(range(len(agents)))  # already ordered by spawn_time
    spawns = world.entrance_spawns
    density = DensityAccumulator(
        req.venue.width,
        req.venue.height,
        req.grid_cell,
        walkable,
        crowd_threshold=req.crowd_threshold,
        sample_dt=SAMPLE_EVERY * DT,
    )
    tracks = TrackRecorder(req.trajectory_dt)

    total_steps = math.ceil(sc.duration_s / DT)
    truncated = False
    step = 0
    while step < total_steps:
        t = sim.elapsed_time()
        # Spawn agents whose time has come (scattered ones at t=0, entry ones at the door).
        while pending and agents[pending[0]].plan.spawn_time <= t + 1e-9:
            st = agents[pending[0]]
            if st.plan.position is not None:
                pos = st.plan.position
            else:
                pos = _free_spawn_point(sim, spawns, offset=pending[0] * 7)
                if pos is None:
                    break  # entrance is congested; retry next poll
            _spawn(sim, st, pos, t)
            by_id[st.agent_id] = st
            tracks.register(st.agent_id)
            pending.pop(0)

        positions = []
        alive = set()
        for agent in sim.agents():
            alive.add(agent.id)
            positions.append(agent.position)
            st = by_id[agent.id]
            if st.done_at is None:
                _advance(sim, st, agent, t)
        for aid in [a for a in by_id if a not in alive]:
            st = by_id.pop(aid)
            if st.done_at is None:  # removed by an exit stage
                st.done_at = t

        if step == tracks.next_step:
            tracks.record(sim)

        warm = sc.kind == "entry" or t >= WARMUP_S
        if step % SAMPLE_EVERY == 0 and warm:
            density.add(np.asarray(positions, dtype=float).reshape(-1, 2))
        if not pending and not by_id:
            break
        if time.perf_counter() - wall0 > req.max_wall_time_s:
            truncated = True
            break
        tracks.iterate(sim, step, POLL_EVERY)
        step += POLL_EVERY
    if step == tracks.next_step:  # loop ran out of steps: capture the final state
        tracks.record(sim)

    times = [a.done_at - a.spawned_at for a in agents if a.done_at is not None]
    mean_t, p90_t = travel_stats(times)
    run_id = run_id_for(req)
    hotspots = density.hotspots(booth_polys(req.layout))
    entered = sum(1 for a in agents if a.spawned_at is not None)
    result = SimResult(
        run_id=run_id,
        scenario=sc,
        layout_id=req.layout.id,
        completed_fraction=round(len(times) / sc.agents, 4),
        mean_travel_time_s=mean_t,
        p90_travel_time_s=p90_t,
        max_density=round(float(density.peak.max(initial=0.0)), 4),
        congestion=density.congestion(entered, hotspots),
        hotspots=hotspots,
        grid=density.grid(),
        sim_time_s=round(sim.elapsed_time(), 3),
        wall_time_s=round(time.perf_counter() - wall0, 3),
        truncated=truncated,
    )
    return result, tracks.result(run_id, req.layout.id)
