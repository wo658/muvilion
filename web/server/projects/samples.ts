import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { emptyProject, SampleProject, type DrawingSource } from "@/lib/projects/schema";
import { extractDrawing } from "@/server/plans/extract";
import { createProject, ProjectError } from "./store";

const Drawing = z.object({ name: z.string().min(1).max(100), file: z.string().regex(/^[\w-]+\/[\w.-]+\.(pdf|jpe?g|png)$/), page: z.number().int().positive().optional(), rasterPdf: z.boolean().optional() });
const Manifest = z.object({ projects: z.array(SampleProject.extend({ id: z.string().regex(/^[\w-]+$/), name: z.string().min(1).max(100), drawings: z.array(Drawing).min(1).max(12) })) }).refine(value => new Set(value.projects.map(p => p.id)).size === value.projects.length, "Duplicate sample project IDs");
const mimeOf = (file: string) => file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".png") ? "image/png" : "image/jpeg";
const SAMPLE_CONCURRENCY = 4;
export const samplesDirectory = () => process.env.SAMPLES_DIR ?? resolve(process.cwd(), "../data/samples");

/** Only offer complete projects; never silently drop a missing drawing. */
export function listSamples(directory = samplesDirectory()): SampleProject[] {
  let manifest: z.infer<typeof Manifest>;
  try { manifest = Manifest.parse(JSON.parse(readFileSync(resolve(directory, "samples.json"), "utf8"))); }
  catch { return []; }
  return manifest.projects.filter(project => project.drawings.every(drawing => existsSync(resolve(directory, drawing.file))));
}

/** Extract every drawing before the atomic SQLite create, preserving each original and PDF page. */
export async function createSampleProject(id: string, directory = samplesDirectory(), signal?: AbortSignal) {
  const sample = listSamples(directory).find(item => item.id === id);
  if (!sample) throw new ProjectError("Sample project not found.", 404);
  const failed = new AbortController(), budget = AbortSignal.timeout(290_000);
  const runSignal = AbortSignal.any([...(signal ? [signal] : []), budget, failed.signal]);
  const drawings: DrawingSource[] = new Array(sample.drawings.length);
  const assets: { id: string; name: string; mimeType: string; data: string }[] = new Array(sample.drawings.length);
  // Muse traces each drawing; a few at a time keeps a large sample within the request budget.
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < sample.drawings.length; index = next++) {
      runSignal.throwIfAborted();
      const drawing = sample.drawings[index];
      const assetId = randomUUID(), mimeType = mimeOf(drawing.file), name = basename(drawing.file);
      const bytes = readFileSync(resolve(directory, drawing.file));
      let document;
      try { document = await extractDrawing(new File([bytes], name, { type: mimeType }), drawing.page ?? 1, runSignal, { rasterPdf: drawing.rasterPdf }); }
      catch {
        failed.abort();
        if (budget.aborted) throw new ProjectError("Opening this sample took too long. Please try again.", 504);
        throw new ProjectError(`Could not read sample drawing: ${drawing.name}. Check that the Python engine is running and try again.`, 503);
      }
      drawings[index] = { id: randomUUID(), document, originalAssetId: assetId, selected: true };
      assets[index] = { id: assetId, name, mimeType, data: bytes.toString("base64") };
    }
  };
  await Promise.all(Array.from({ length: Math.min(SAMPLE_CONCURRENCY, sample.drawings.length) }, worker));
  runSignal.throwIfAborted();
  const sources = emptyProject().sources;
  sources.items = (sample.sources ?? []).map(source => {
    const reference = { ...source, id: randomUUID() };
    if (source.kind !== "brief") return reference;
    const originalAssetId = randomUUID();
    assets.push({ id: originalAssetId, name: `${source.name.slice(0, 251)}.txt`, mimeType: "text/plain", data: Buffer.from(source.text, "utf8").toString("base64") });
    return { ...reference, originalAssetId };
  });
  const first = drawings[0];
  return createProject({ name: sample.name, state: { ...emptyProject(), sources, document: first.document, drawings, activeDrawingId: first.id, originalDrawingId: first.originalAssetId }, assets });
}
