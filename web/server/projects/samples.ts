import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { emptyProject, RecordedSampleBundle, SampleProject, type DrawingSource } from "@/lib/projects/schema";
import { extractDrawing } from "@/server/plans/extract";
import { PlanServiceError } from "@/server/plans/errors";
import { SourceImage, SourceLibrarySchema } from "@/lib/sources/schema";
import { createProject, ProjectError } from "./store";
import { hasDesignReferences } from "@/lib/sources/schema";

const Drawing = z.object({ name: z.string().min(1).max(100), file: z.string().regex(/^[\w-]+\/[\w.-]+\.(pdf|jpe?g|png)$/), page: z.number().int().positive().optional() });
const Manifest = z.object({ projects: z.array(SampleProject.extend({ id: z.string().regex(/^[\w-]+$/), name: z.string().min(1).max(100), drawings: z.array(Drawing).min(1).max(12) })) }).refine(value => new Set(value.projects.map(p => p.id)).size === value.projects.length, "Duplicate sample project IDs");
const mimeOf = (file: string) => file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
const SAMPLE_CONCURRENCY = 4;
export const samplesDirectory = () => process.env.SAMPLES_DIR ?? resolve(process.cwd(), "../data/samples");

/** Only offer complete projects; never silently drop a missing drawing. */
export function listSamples(directory = samplesDirectory()): SampleProject[] {
  let manifest: z.infer<typeof Manifest>;
  try { manifest = Manifest.parse(JSON.parse(readFileSync(resolve(directory, "samples.json"), "utf8"))); }
  catch { return []; }
  return manifest.projects.filter(project => project.drawings.every(drawing => existsSync(resolve(directory, drawing.file))) && (project.sources ?? []).every(source => (source.imageFiles ?? []).every(file => existsSync(resolve(directory, file)))))
    // A missing recording leaves the live sample available rather than hiding the project.
    .map(project => project.recorded && !existsSync(resolve(directory, project.recorded.file)) ? { ...project, recorded: undefined } : project);
}

/** Install a recorded run as a new, editable project; no model call is made. */
function createRecordedProject(sample: SampleProject, directory: string) {
  const recording = sample.recorded!;
  let bundle: z.infer<typeof RecordedSampleBundle>;
  try { bundle = RecordedSampleBundle.parse(JSON.parse(readFileSync(resolve(directory, recording.file), "utf8"))); }
  catch { throw new ProjectError(`Invalid recorded sample: ${sample.name}.`, 422); }
  const assets = bundle.assets.map(asset => "file" in asset
    ? { id: asset.id, name: asset.name, mimeType: asset.mimeType, data: readFileSync(resolve(directory, asset.file)).toString("base64") }
    : asset);
  const state = { ...bundle.state, autoDesignPending: undefined, recordedDemo: { sampleId: sample.id, recordedAt: recording.recordedAt }, openReportOnLoad: Boolean(bundle.state.planningArtifacts?.length) || undefined };
  return createProject({ name: sample.name, state, assets });
}

/** Extract every drawing before the atomic SQLite create, preserving each original and PDF page. */
export async function createSampleProject(id: string, directory = samplesDirectory(), signal?: AbortSignal, live = false) {
  const sample = listSamples(directory).find(item => item.id === id);
  if (!sample) throw new ProjectError("Sample project not found.", 404);
  if (sample.recorded && !live) return createRecordedProject(sample, directory);
  const failed = new AbortController();
  const runSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(1_200_000), failed.signal]);
  const briefAssets: { id: string; name: string; mimeType: string; data: string }[] = [];
  const sources = emptyProject().sources;
  sources.items = (sample.sources ?? []).map(source => {
    const { imageFiles, ...content } = source;
    const images = (imageFiles ?? []).map(file => {
      const path = resolve(directory, file);
      if (statSync(path).size > 449_000) throw new ProjectError(`Invalid sample reference image: ${file}.`, 422);
      const bytes = readFileSync(path);
      const mime = mimeOf(file);
      const valid = mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === "image/webp" ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!valid || bytes.length > 449_000) throw new ProjectError(`Invalid sample reference image: ${file}.`, 422);
      return SourceImage.parse(`data:${mime};base64,${bytes.toString("base64")}`);
    });
    const reference = { ...content, images: [...content.images, ...images], id: randomUUID() };
    if (source.kind !== "brief") return reference;
    const originalAssetId = randomUUID();
    briefAssets.push({ id: originalAssetId, name: `${source.name.slice(0, 251)}.txt`, mimeType: "text/plain", data: Buffer.from(source.text, "utf8").toString("base64") });
    return { ...reference, originalAssetId };
  });
  SourceLibrarySchema.parse(sources);
  runSignal.throwIfAborted();
  const drawings: DrawingSource[] = new Array(sample.drawings.length);
  const assets: { id: string; name: string; mimeType: string; data: string }[] = new Array(sample.drawings.length);
  // Muse reads each drawing; a few at a time keeps a large sample responsive.
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < sample.drawings.length; index = next++) {
      runSignal.throwIfAborted();
      const drawing = sample.drawings[index];
      const assetId = randomUUID(), mimeType = mimeOf(drawing.file), name = basename(drawing.file);
      const bytes = readFileSync(resolve(directory, drawing.file));
      let document;
      try { document = await extractDrawing(new File([bytes], name, { type: mimeType }), drawing.page ?? 1, { signal: runSignal }); }
      catch (error) {
        runSignal.throwIfAborted();
        failed.abort();
        throw new ProjectError(`Could not read sample drawing: ${drawing.name}. ${error instanceof PlanServiceError ? error.message : "Check the file and retry."}`, error instanceof PlanServiceError ? error.status : 503);
      }
      drawings[index] = { id: randomUUID(), document, originalAssetId: assetId, selected: true };
      assets[index] = { id: assetId, name, mimeType, data: bytes.toString("base64") };
    }
  };
  await Promise.all(Array.from({ length: Math.min(SAMPLE_CONCURRENCY, sample.drawings.length) }, worker));
  runSignal.throwIfAborted();
  const first = drawings[0];
  return createProject({ name: sample.name, state: { ...emptyProject(), sources, document: first.document, drawings, activeDrawingId: first.id, originalDrawingId: first.originalAssetId, ...(hasDesignReferences(sources) ? { autoDesignPending: true } : {}) }, assets: [...assets, ...briefAssets] });
}
