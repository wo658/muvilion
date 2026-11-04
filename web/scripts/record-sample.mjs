#!/usr/bin/env node
// Save a finished project export as a sample's recorded Muse run.
// Usage: node scripts/record-sample.mjs <export.json> <sample-id> [note]
// Drawing originals identical to the sample's files are stored as file references, so the
// recording does not repeat them. samples.json gets the `recorded` entry for the sample.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [exportPath, sampleId, note = "Recorded from a live Muse design and planning run, then reviewed. Open it to edit, or design from scratch to run Muse live."] = process.argv.slice(2);
if (!exportPath || !sampleId) { console.error("Usage: node scripts/record-sample.mjs <export.json> <sample-id> [note]"); process.exit(1); }
const samples = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/samples");
const manifestPath = resolve(samples, "samples.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const sample = manifest.projects.find(project => project.id === sampleId);
if (!sample) throw new Error(`Unknown sample: ${sampleId}`);

const bundle = JSON.parse(readFileSync(exportPath, "utf8"));
if (bundle.projectVersion !== 2) throw new Error("Expected a project export (projectVersion 2).");
const files = sample.drawings.map(drawing => ({ file: drawing.file, data: readFileSync(resolve(samples, drawing.file)).toString("base64") }));
const assets = bundle.assets.map(asset => {
  const match = files.find(file => file.data === asset.data);
  return match ? { id: asset.id, name: asset.name, mimeType: asset.mimeType, file: match.file } : asset;
});
// Run state belongs to the original session, not the recording.
const { autoDesignPending, openReportOnLoad, recordedDemo, ...state } = bundle.state;
void autoDesignPending; void openReportOnLoad; void recordedDemo;

const file = `${sampleId}/recorded.json`;
writeFileSync(resolve(samples, file), JSON.stringify({ projectVersion: 2, name: sample.name, state, assets }) + "\n");
sample.recorded = { file, recordedAt: new Date().toISOString().slice(0, 10), note };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
const referenced = assets.filter(asset => asset.file).length;
console.log(`Wrote data/samples/${file} (${referenced} of ${assets.length} assets referenced from sample files).`);
