import "server-only";
import type { PlanDocument } from "@/lib/plans/schema";
import { preparePages } from "./prepare";
import { museTracingAvailable, traceWalls } from "./trace";

/** Uploads and samples share the same preview → model reading path. */
export async function extractDrawing(file: File, page = 1, options: { signal?: AbortSignal } = {}): Promise<PlanDocument> {
  const signal = AbortSignal.any([AbortSignal.timeout(150_000), ...(options.signal ? [options.signal] : [])]);
  const [document] = await preparePages(file, page, { signal });
  if (!museTracingAvailable()) return { ...document, warnings: [...document.warnings,
    "Source preview only. Add a Meta API key in Settings to read walls and text; scale is unconfirmed."] };
  const traced = await traceWalls(document, signal);
  signal.throwIfAborted();
  return traced;
}
