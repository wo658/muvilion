"""SimPy M/M/c registration-desk queue (Poisson arrivals, exponential service)."""

from __future__ import annotations

import random

import numpy as np
import simpy

from app.schemas import QueueRequest, QueueResult


def simulate_queue(req: QueueRequest) -> QueueResult:
    rng = random.Random(req.seed)
    env = simpy.Environment()
    desks = simpy.Resource(env, capacity=req.servers)
    horizon = req.duration_min * 60.0
    mean_gap = 60.0 / req.arrivals_per_min
    waits: list[float] = []
    waiting_since: dict[int, float] = {}  # visitors still queued, for the end-of-run tally
    stats = {"busy": 0.0, "max_queue": 0}

    def visitor(n: int):
        arrived = env.now
        waiting_since[n] = arrived
        with desks.request() as slot:
            stats["max_queue"] = max(stats["max_queue"], len(desks.queue))
            yield slot
            del waiting_since[n]
            waits.append(env.now - arrived)
            service = rng.expovariate(1.0 / req.service_time_s)
            # Only the part of the service inside the horizon counts toward utilization.
            stats["busy"] += max(0.0, min(env.now + service, horizon) - env.now)
            yield env.timeout(service)

    def arrivals():
        n = 0
        while True:
            yield env.timeout(rng.expovariate(1.0 / mean_gap))
            if env.now >= horizon:
                return
            env.process(visitor(n))
            n += 1

    env.process(arrivals())
    env.run(until=horizon)
    # Visitors still in line at the end have waited at least until the horizon.
    waits += [horizon - t for t in waiting_since.values()]

    arr = np.asarray(waits) if waits else np.zeros(1)
    return QueueResult(
        mean_wait_s=round(float(arr.mean()), 3),
        p90_wait_s=round(float(np.percentile(arr, 90)), 3),
        max_queue_len=stats["max_queue"],
        utilization=round(min(1.0, stats["busy"] / (req.servers * horizon)), 4),
    )
