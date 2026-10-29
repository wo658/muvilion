import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { emptyProject, type SampleProject, type DrawingSource } from "@/lib/projects/schema";
import { createHttpEngine } from "@/server/engine/client";
import { createProject, ProjectError } from "./store";

const Drawing = z.object({ name: z.string().min(1).max(100), file: z.string().regex(/^[\w-]+\/[\w.-]+\.(pdf|jpe?g|png)$/), page: z.number().int().positive().optional(), rasterPdf: z.boolean().optional() });
const Manifest = z.object({ projects: z.array(z.object({ id: z.string().regex(/^[\w-]+$/), name: z.string().min(1).max(100), drawings: z.array(Drawing).min(1).max(12) })) }).refine(value => new Set(value.projects.map(p => p.id)).size === value.projects.length, "Duplicate sample project IDs");
const mimeOf = (file: string) => file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".png") ? "image/png" : "image/jpeg";
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
  const runSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(240_000)]);
  const engine = createHttpEngine();
  const drawings: DrawingSource[] = [];
  const assets = [];
  for (const drawing of sample.drawings) {
    runSignal.throwIfAborted();
    const assetId = randomUUID(), mimeType = mimeOf(drawing.file), name = basename(drawing.file);
    const bytes = readFileSync(resolve(directory, drawing.file));
    let document;
    try { document = await engine.extract(new File([bytes], name, { type: mimeType }), drawing.page ?? 1, { signal: runSignal, rasterPdf: drawing.rasterPdf }); }
    catch { throw new ProjectError(`Could not read sample drawing: ${drawing.name}. Check that the Python engine is running and try again.`, 503); }
    drawings.push({ id: randomUUID(), document, originalAssetId: assetId, selected: true });
    assets.push({ id: assetId, name, mimeType, data: bytes.toString("base64") });
  }
  runSignal.throwIfAborted();
  const first = drawings[0];
  return createProject({ name: sample.name, state: { ...emptyProject(), document: first.document, drawings, activeDrawingId: first.id, originalDrawingId: first.originalAssetId }, assets });
}
