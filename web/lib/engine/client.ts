/**
 * Typed HTTP client for the Python engine (FastAPI).
 * Every response is zod-validated against the contract mirror in ./contract.ts,
 * so contract drift fails loudly at the boundary instead of deep in the agent.
 */
import type { z } from "zod";
import {
  HealthResponse,
  LayoutResponse,
  QueueResult,
  SimResult,
  Trajectories,
  ValidateResponse,
  type LayoutRequestInput,
  type QueueRequestInput,
  type SimulateRequestInput,
  type ValidateRequestInput,
} from "./contract";

export interface Engine {
  readonly kind: "http" | "mock";
  health(): Promise<HealthResponse>;
  layout(req: LayoutRequestInput): Promise<LayoutResponse>;
  validate(req: ValidateRequestInput): Promise<ValidateResponse>;
  simulate(req: SimulateRequestInput): Promise<SimResult>;
  /** Per-agent position tracks for the same request (same run_id as simulate). */
  trajectories(req: SimulateRequestInput): Promise<Trajectories>;
  queue(req: QueueRequestInput): Promise<QueueResult>;
}

export class EngineError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export interface HttpEngineOptions {
  baseUrl?: string;
  /** Default timeout (ms) for short calls (health, validate, queue). */
  timeoutMs?: number;
  /**
   * Minimum timeout (ms) for /simulate. The effective timeout is
   * max(this, (max_wall_time_s + 30) s). Measured on the fixture (200 agents, 300 s):
   * entry ~4 s, browse ~11 s, exit ~0.3 s; layout ~3.6 s.
   */
  simulateTimeoutMs?: number;
  /**
   * Minimum timeout (ms) for /trajectories (re-runs the simulation and serializes every
   * track). Effective timeout is max(this, (max_wall_time_s + 60) s); default 120 s.
   */
  trajectoriesTimeoutMs?: number;
  fetch?: typeof fetch;
}

export function createHttpEngine(opts: HttpEngineOptions = {}): Engine {
  const baseUrl = (opts.baseUrl ?? process.env.ENGINE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? Number(process.env.ENGINE_TIMEOUT_MS ?? 30_000);
  const simulateTimeoutMs = opts.simulateTimeoutMs ?? Number(process.env.ENGINE_SIMULATE_TIMEOUT_MS ?? 90_000);
  const trajectoriesTimeoutMs =
    opts.trajectoriesTimeoutMs ?? Number(process.env.ENGINE_TRAJECTORIES_TIMEOUT_MS ?? 120_000);
  const doFetch = opts.fetch ?? fetch;

  async function call<S extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    schema: S,
    body: unknown,
    ms: number,
  ): Promise<z.infer<S>> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(ms),
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === "TimeoutError" ? `timed out after ${ms}ms` : String(err);
      throw new EngineError(`engine ${path} request failed: ${reason}`, path);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new EngineError(`engine ${path} returned HTTP ${res.status}`, path, res.status, text.slice(0, 2000));
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new EngineError(`engine ${path} returned non-JSON body`, path, res.status, text.slice(0, 2000));
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new EngineError(
        `engine ${path} response does not match contract: ${parsed.error.message}`,
        path,
        res.status,
        text.slice(0, 2000),
      );
    }
    return parsed.data;
  }

  return {
    kind: "http",
    health: () => call("GET", "/health", HealthResponse, undefined, Math.min(timeoutMs, 5_000)),
    // Solver time limit plus network/serialization headroom.
    layout: (req) => call("POST", "/layout", LayoutResponse, req, (req.time_limit_s ?? 10) * 1000 + timeoutMs),
    validate: (req) => call("POST", "/validate", ValidateResponse, req, timeoutMs),
    // The engine stops at max_wall_time_s (truncated=true); leave headroom for setup + serialization.
    simulate: (req) =>
      call("POST", "/simulate", SimResult, req, Math.max(simulateTimeoutMs, ((req.max_wall_time_s ?? 60) + 30) * 1000)),
    trajectories: (req) =>
      call(
        "POST",
        "/trajectories",
        Trajectories,
        req,
        Math.max(trajectoriesTimeoutMs, ((req.max_wall_time_s ?? 60) + 60) * 1000),
      ),
    queue: (req) => call("POST", "/queue", QueueResult, req, timeoutMs),
  };
}
