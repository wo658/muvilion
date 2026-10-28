import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAsset, listProjects } from "@/server/projects/store";
import { createSampleProject, listSamples, samplesDirectory } from "@/server/projects/samples";

let directory: string, samples: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "muvilion-samples-")); vi.stubEnv("MUVILION_DATA_DIR", directory);
  samples = join(directory, "samples"); mkdirSync(join(samples, "venue"), { recursive: true });
  writeFileSync(join(samples, "venue", "hall.pdf"), "%PDF-1.7 test");
  writeFileSync(join(samples, "samples.json"), JSON.stringify({ samples: [
    { name: "Hall", file: "venue/hall.pdf", page: 3 },
    { name: "Missing", file: "venue/missing.jpg" },
  ] }));
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe("sample drawings", () => {
  it("lists only samples whose files exist", () => {
    expect(listSamples(samples)).toEqual([{ name: "Hall", file: "venue/hall.pdf", page: 3 }]);
    expect(listSamples(join(directory, "nowhere"))).toEqual([]);
  });
  it("copies only the chosen sample into SQLite as a new project", () => {
    expect(listProjects()).toHaveLength(0);
    const project = createSampleProject("venue/hall.pdf", samples);
    expect(listProjects()).toHaveLength(1);
    expect(project).toMatchObject({ name: "Hall", state: { document: null, originalDrawingPage: 3 } });
    const asset = getAsset(project.id, project.state.originalDrawingId!);
    expect(asset).toMatchObject({ name: "hall.pdf", mimeType: "application/pdf" });
    expect(Buffer.from(asset.data).toString()).toBe("%PDF-1.7 test");
  });
  it("rejects files outside the manifest", () => {
    expect(() => createSampleProject("venue/missing.jpg", samples)).toThrow(/not found/);
    expect(() => createSampleProject("../samples.json", samples)).toThrow(/not found/);
    expect(listProjects()).toHaveLength(0);
  });
  it("ships a valid manifest for every tracked sample", () => {
    expect(listSamples(samplesDirectory())).toHaveLength(15);
  });
});
