import "server-only";
import { createHttpEngine, EngineError } from "@/server/engine/client";
import type { PlanDocument } from "@/lib/plans/schema";
import { museTracingAvailable, traceWalls } from "./trace";

const TRACE_BUDGET_MS = 170_000;
const RETRY_MIN_MS = 60_000;

/** Engine extraction, then Muse tracing for PDFs; engine lines remain the fallback. */
export async function extractDrawing(file: File, page: number, signal: AbortSignal): Promise<PlanDocument> {
  const engine = createHttpEngine();
  let plan: PlanDocument;
  try { plan = await engine.extract(file, page, { signal }); }
  catch (error) {
    // Dense vector PDFs exceed the engine's line budget; the rendered page is enough for Muse.
    if (!(error instanceof EngineError && error.status === 413 && /\.pdf$/i.test(file.name))) throw error;
    plan = await engine.extract(file, page, { signal, rasterPdf: true });
  }
  if (plan.source.format !== "pdf" || !museTracingAvailable()) return plan;
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    try { return await traceWalls(plan, AbortSignal.any([signal, AbortSignal.timeout(TRACE_BUDGET_MS - (Date.now() - started))])); }
    catch (error) {
      if (signal.aborted) throw error;
      console.warn("[muse-trace]", JSON.stringify({ file: file.name, page, attempt, elapsedMs: Date.now() - started, reason: error instanceof Error ? error.message.slice(0, 300) : String(error) }));
      if (attempt >= 2 || TRACE_BUDGET_MS - (Date.now() - started) < RETRY_MIN_MS) break;
    }
  }
  return { ...plan, warnings: ["Muse could not trace this drawing, so the extracted lines are shown instead.", ...plan.warnings].slice(0, 100) };
}
