import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { emptyProject } from "@/lib/projects/schema";
import type { SampleDrawing } from "@/lib/projects/schema";
import { createProject, ProjectError } from "./store";

const Manifest = z.object({ samples: z.array(z.object({ name: z.string().min(1).max(100), file: z.string().regex(/^[\w-]+\/[\w.-]+\.(pdf|jpe?g|png)$/), page: z.number().int().positive().optional() })) });
const mimeOf = (file: string) => file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".png") ? "image/png" : "image/jpeg";
export const samplesDirectory = () => process.env.SAMPLES_DIR ?? resolve(process.cwd(), "../data/samples");

/** Sample drawings listed in `data/samples/samples.json` whose files exist in this checkout. */
export function listSamples(directory = samplesDirectory()): SampleDrawing[] {
  let manifest: z.infer<typeof Manifest>;
  try { manifest = Manifest.parse(JSON.parse(readFileSync(resolve(directory, "samples.json"), "utf8"))); }
  catch { return []; }
  return manifest.samples.filter(sample => existsSync(resolve(directory, sample.file)));
}

/** Copies one sample drawing into SQLite as a new project; Studio extracts it on first open. */
export function createSampleProject(file: string, directory = samplesDirectory()) {
  const sample = listSamples(directory).find(item => item.file === file);
  if (!sample) throw new ProjectError("Sample drawing not found.", 404);
  const id = randomUUID();
  return createProject({
    name: sample.name,
    state: { ...emptyProject(), originalDrawingId: id, ...(sample.page ? { originalDrawingPage: sample.page } : {}) },
    assets: [{ id, name: basename(sample.file), mimeType: mimeOf(sample.file), data: readFileSync(resolve(directory, sample.file)).toString("base64") }],
  });
}
