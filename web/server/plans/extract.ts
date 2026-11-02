import "server-only";
import type { PlanDocument } from "@/lib/plans/schema";
import { applyMeasure } from "@/lib/plans/trace";
import { measureDrawing } from "./measure";
import { preparePages } from "./prepare";
import { museTracingAvailable, traceWalls } from "./trace";

const TRACE_BUDGET_MS = 140_000;
const RETRY_MIN_MS = 60_000;

/** Each step is a complete document the client commits as its own operation: source preview, walls, then measured scale/floor. */
export type ReadingStep = { type: "preview" | "walls" | "measured"; document: PlanDocument };

async function traceWithRetry(document: PlanDocument, file: File, page: number, signal: AbortSignal) {
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

/** Uploads and samples share the same preview → model reading path. Wall reading retries once, then its error surfaces;
 * scale/floor measurement runs in parallel and its failure leaves them to the user. */
export async function extractDrawing(file: File, page = 1, options: { signal?: AbortSignal; onStep?: (step: ReadingStep) => void } = {}): Promise<PlanDocument> {
  const signal = AbortSignal.any([AbortSignal.timeout(150_000), ...(options.signal ? [options.signal] : [])]);
  const [prepared] = await preparePages(file, page, { signal });
  if (!museTracingAvailable()) {
    const preview = { ...prepared, warnings: [...prepared.warnings, "Source preview only. Add a Meta API key in Settings to read walls and text; scale is unconfirmed."] };
    options.onStep?.({ type: "preview", document: preview });
    return preview;
  }
  options.onStep?.({ type: "preview", document: prepared });
  const measuring = measureDrawing(prepared, signal).catch(() => null);
  const walls = await traceWithRetry(prepared, file, page, signal);
  options.onStep?.({ type: "walls", document: walls });
  const measured = applyMeasure(walls, await measuring);
  signal.throwIfAborted();
  if (measured !== walls) options.onStep?.({ type: "measured", document: measured });
  return measured;
}
