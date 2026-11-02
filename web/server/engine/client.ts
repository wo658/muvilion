import "server-only";
/**
 * Typed HTTP client for the Python engine (FastAPI).
 * Every response is zod-validated against lib/plans/schema.ts,
 * so contract drift fails loudly at the boundary instead of deep in the agent.
 */
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import type { z } from "zod";
export interface EngineRequestOptions { signal?: AbortSignal; timeoutMs?: number }

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
  /** Default timeout (ms) for document extraction. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface HttpEngine {
  extract(file: File, page?: number, options?: EngineRequestOptions & { rasterPdf?: boolean }): Promise<PlanDocument>;
}

export function createHttpEngine(opts: HttpEngineOptions = {}): HttpEngine {
  const baseUrl = (opts.baseUrl ?? process.env.ENGINE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? Number(process.env.ENGINE_TIMEOUT_MS ?? 90_000);
  const doFetch = opts.fetch ?? fetch;

  async function call<S extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    schema: S,
    body: unknown,
    ms: number,
    options: EngineRequestOptions = {},
  ): Promise<z.infer<S>> {
    let res: Response;
    let text: string;
    const multipart = body instanceof FormData;
    const effectiveTimeoutMs = options.timeoutMs ?? ms;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: body === undefined || multipart ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
        signal: AbortSignal.any([AbortSignal.timeout(effectiveTimeoutMs), ...(options.signal ? [options.signal] : [])]),
        cache: "no-store",
      });
      text = await res.text();
    } catch (err) {
      const reason = err instanceof Error && err.name === "TimeoutError" ? `timed out after ${effectiveTimeoutMs}ms` : String(err);
      throw new EngineError(`engine ${path} request failed: ${reason}`, path);
    }
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
    extract: (file, page = 1, options) => {
      const body = new FormData();
      body.set("file", file);
      body.set("page", String(page));
      if (options?.rasterPdf) body.set("raster_pdf", "true");
      return call("POST", "/plans/extract", PlanDocumentSchema, body, timeoutMs, options);
    },
  };
}
