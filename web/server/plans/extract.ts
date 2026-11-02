import "server-only";
import type { PlanDocument } from "@/lib/plans/schema";
import { preparePages } from "./prepare";
import { museTracingAvailable, traceWalls } from "./trace";

const TRACE_BUDGET_MS = 140_000;
const RETRY_MIN_MS = 60_000;

/** Uploads and samples share the same preview → model reading path. One retry, then the model error surfaces. */
export async function extractDrawing(file: File, page = 1, options: { signal?: AbortSignal } = {}): Promise<PlanDocument> {
  const signal = AbortSignal.any([AbortSignal.timeout(150_000), ...(options.signal ? [options.signal] : [])]);
  const [document] = await preparePages(file, page, { signal });
  if (!(await museTracingAvailable())) return { ...document, warnings: [...document.warnings,
    "Source preview only. Add a Meta API key in Settings to read walls and text; scale is unconfirmed."] };
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      const traced = await traceWalls(document, AbortSignal.any([signal, AbortSignal.timeout(TRACE_BUDGET_MS - (Date.now() - started))]));
      signal.throwIfAborted();
      return traced;
    } catch (error) {
      if (signal.aborted) throw error;
      console.warn("[muse-trace]", JSON.stringify({ file: file.name, page, attempt, elapsedMs: Date.now() - started, reason: error instanceof Error ? error.message.slice(0, 300) : String(error) }));
      if (attempt >= 2 || TRACE_BUDGET_MS - (Date.now() - started) < RETRY_MIN_MS) throw error;
    }
  }
}
