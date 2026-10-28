/**
 * Typed HTTP client for the Python engine (FastAPI).
 * Every response is zod-validated against the contract mirror in ./contract.ts,
 * so contract drift fails loudly at the boundary instead of deep in the agent.
 */
import type { z } from "zod";
import {
  HealthResponse,
  LayoutResponse,
  ValidateResponse,
  type LayoutRequestInput,
  type ValidateRequestInput,
} from "./contract";

export interface Engine {
  readonly kind: "http" | "mock";
  health(): Promise<HealthResponse>;
  layout(req: LayoutRequestInput): Promise<LayoutResponse>;
  validate(req: ValidateRequestInput): Promise<ValidateResponse>;
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
  /** Default timeout (ms) for short calls (health, validate). */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export function createHttpEngine(opts: HttpEngineOptions = {}): Engine {
  const baseUrl = (opts.baseUrl ?? process.env.ENGINE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? Number(process.env.ENGINE_TIMEOUT_MS ?? 30_000);
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
  };
}
