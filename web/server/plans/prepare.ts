import "server-only";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { z } from "zod";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { PlanServiceError } from "./errors";

const PreparedPage = z.object({ source: PlanDocumentSchema.shape.source, preview: PlanDocumentSchema.shape.preview, warnings: PlanDocumentSchema.shape.warnings });
const WorkerResult = z.object({ pages: z.array(PreparedPage).min(1).max(12) });
const MAX_FILE = 20 * 1024 * 1024;

/** A disposable worker keeps decoding off the request thread and can be terminated on cancellation. */
export async function preparePages(file: File, page = 1, options: { signal?: AbortSignal; allPages?: boolean } = {}): Promise<PlanDocument[]> {
  if (!file.size || file.size > MAX_FILE) throw new PlanServiceError("Choose a non-empty file up to 20 MB.", 413);
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) throw new PlanServiceError("Supported formats: PDF, PNG, JPG. Export CAD drawings to PDF first.", 415);
  if (!Number.isInteger(page) || page < 1) throw new PlanServiceError("Choose a valid page.", 400);
  const signal = AbortSignal.any([AbortSignal.timeout(60_000), ...(options.signal ? [options.signal] : [])]);
  signal.throwIfAborted();
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  const name = file.name.split(/[\\/]/).pop()!.slice(0, 200);
  const pages = await new Promise<z.infer<typeof PreparedPage>[]>((resolveResult, reject) => {
    const worker = new Worker(resolve(process.cwd(), "server/plans/render-worker.mjs"), {
      workerData: { bytes, name, page, allPages: options.allPages === true }, transferList: [bytes],
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const cleanup = () => { signal.removeEventListener("abort", abort); void worker.terminate(); };
    const abort = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    worker.once("message", (message: unknown) => {
      cleanup();
      const parsed = WorkerResult.safeParse(message);
      if (parsed.success) resolveResult(parsed.data.pages);
      else {
        const error = z.object({ error: z.string() }).safeParse(message);
        reject(new PlanServiceError(error.success ? error.data.error : "The document preview is invalid.", 422));
      }
    });
    worker.once("error", () => { cleanup(); reject(new PlanServiceError("Document preview failed. Check the file or export a smaller region.", 422)); });
    worker.once("exit", () => { cleanup(); reject(new PlanServiceError("Document preparation stopped before completion.", 422)); });
  });
  signal.throwIfAborted();
  return pages.map(prepared => PlanDocumentSchema.parse({ ...prepared, schemaVersion: 1, widthMeters: null, heightMeters: null,
    scaleConfirmed: false, lines: [], texts: [], method: "preview" }));
}
