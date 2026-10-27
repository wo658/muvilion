/**
 * Trajectory proxy.
 *   POST /api/trajectories[?expect=<run_id>]   body: SimulateRequest (as rebuilt by lib/trajectory/request.ts)
 *   → Trajectories from the engine's POST /trajectories (or the in-process mock with ENGINE_MOCK=1).
 *
 * Re-running a simulation costs engine time, so this follows the live-agent conventions:
 * LIVE_AGENT=on is required (replay mode uses the static files under /replay/traj instead),
 * scenario.agents is capped (TRAJECTORY_MAX_AGENTS, default 1000) and concurrent requests are
 * capped per server instance (TRAJECTORY_MAX_CONCURRENT, default 2). It does not count against the
 * daily live-run cap: it serves tracks for a run the user already has. Results are kept in a small
 * in-memory LRU keyed by the request, so toggling views does not re-run the engine.
 * With `expect`, a run_id that differs from the expected one is a 409 (the request was not the
 * one the SimResult came from).
 */
import { liveAgentEnabled } from "@/lib/agent/config";
import { getEngine } from "@/lib/engine";
import { EngineError } from "@/lib/engine/client";
import { SimulateRequest, type Trajectories } from "@/lib/engine/contract";
import { hashString } from "@/lib/geometry";

export const maxDuration = 180;

const CACHE_SIZE = 8;
const cache = new Map<string, Trajectories>();
let active = 0;

const err = (status: number, error: string, message: string) => Response.json({ error, message }, { status });

export async function POST(req: Request) {
  const env = process.env;
  if (!liveAgentEnabled(env)) {
    return err(403, "live_disabled", 'Trajectories need a live engine (LIVE_AGENT is not "on"); replay mode reads /replay/traj/<run_id>.json.');
  }
  const body = await req.json().catch(() => undefined);
  const parsed = SimulateRequest.safeParse(body);
  if (!parsed.success) return err(400, "bad_request", parsed.error.message);
  const simReq = parsed.data;
  const maxAgents = Number(env.TRAJECTORY_MAX_AGENTS ?? 1000);
  if (simReq.scenario.agents > maxAgents) {
    return err(400, "too_many_agents", `scenario.agents ${simReq.scenario.agents} exceeds TRAJECTORY_MAX_AGENTS=${maxAgents}`);
  }
  const expect = new URL(req.url).searchParams.get("expect");

  const key = hashString(JSON.stringify(simReq));
  let traj = cache.get(key);
  if (traj) {
    cache.delete(key);
    cache.set(key, traj);
  } else {
    const maxConcurrent = Number(env.TRAJECTORY_MAX_CONCURRENT ?? 2);
    if (active >= maxConcurrent) {
      return err(429, "cap_reached", `too many concurrent trajectory requests (TRAJECTORY_MAX_CONCURRENT=${maxConcurrent})`);
    }
    active++;
    try {
      traj = await getEngine(env).trajectories(simReq);
    } catch (e) {
      const status = e instanceof EngineError && e.status && e.status < 500 ? 422 : 502;
      return err(status, "engine_error", e instanceof Error ? e.message : String(e));
    } finally {
      active--;
    }
    cache.set(key, traj);
    while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  }
  if (expect && traj.run_id !== expect) {
    return err(409, "run_mismatch", `engine returned run ${traj.run_id}, expected ${expect}`);
  }
  return Response.json(traj, { headers: { "cache-control": "private, max-age=3600" } });
}
