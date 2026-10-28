import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { emptyProject } from "@/lib/projects/schema";
import { withDatabase } from "@/server/database";
import { createProject } from "./store";

const Manifest = z.object({ samples: z.array(z.object({ name: z.string().min(1).max(100), file: z.string().regex(/^[\w-]+\/[\w.-]+\.(pdf|jpe?g|png)$/), page: z.number().int().positive().optional() })) });
const mimeOf = (file: string) => file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".png") ? "image/png" : "image/jpeg";
export const samplesDirectory = () => process.env.SAMPLES_DIR ?? resolve(process.cwd(), "../data/samples");

/**
 * Seeds one project per `data/samples` drawing when the database has no projects yet.
 * Originals are stored as SQLite assets; Studio extracts each drawing when it is first opened.
 */
export function seedSampleProjects(directory = samplesDirectory()) {
  const empty = withDatabase(db => !db.prepare("SELECT 1 FROM projects LIMIT 1").get());
  if (!empty) return 0;
  let manifest: z.infer<typeof Manifest>;
  try { manifest = Manifest.parse(JSON.parse(readFileSync(resolve(directory, "samples.json"), "utf8"))); }
  catch { return 0; }
  let created = 0;
  // Newest projects list first, so insert in reverse to keep the manifest order.
  for (const sample of [...manifest.samples].reverse()) {
    let data: Buffer;
    try { data = readFileSync(resolve(directory, sample.file)); } catch { continue; }
    const id = randomUUID();
    createProject({
      name: sample.name,
      state: { ...emptyProject(), originalDrawingId: id, ...(sample.page ? { originalDrawingPage: sample.page } : {}) },
      assets: [{ id, name: basename(sample.file), mimeType: mimeOf(sample.file), data: data.toString("base64") }],
    });
    created++;
  }
  return created;
}
