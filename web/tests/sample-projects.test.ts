import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProject, getAsset, getProject, listProjects } from "@/server/projects/store";
import { samplesDirectory, seedSampleProjects } from "@/server/projects/samples";

let directory: string, samples: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "muvilion-seed-")); vi.stubEnv("MUVILION_DATA_DIR", directory);
  samples = join(directory, "samples"); mkdirSync(join(samples, "venue"), { recursive: true });
  writeFileSync(join(samples, "venue", "hall.pdf"), "%PDF-1.7 test");
  writeFileSync(join(samples, "samples.json"), JSON.stringify({ samples: [
    { name: "Hall", file: "venue/hall.pdf", page: 3 },
    { name: "Missing", file: "venue/missing.jpg" },
  ] }));
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe("sample project seeding", () => {
  it("stores each available sample drawing as a SQLite project on first run", () => {
    expect(seedSampleProjects(samples)).toBe(1);
    const [summary] = listProjects();
    const project = getProject(summary.id);
    expect(project).toMatchObject({ name: "Hall", state: { document: null, originalDrawingPage: 3 } });
    const asset = getAsset(project.id, project.state.originalDrawingId!);
    expect(asset).toMatchObject({ name: "hall.pdf", mimeType: "application/pdf" });
    expect(Buffer.from(asset.data).toString()).toBe("%PDF-1.7 test");
  });
  it("leaves a database with projects untouched", () => {
    createProject({ name: "Mine" });
    expect(seedSampleProjects(samples)).toBe(0);
    expect(listProjects().map(item => item.name)).toEqual(["Mine"]);
  });
  it("ships a valid manifest for every tracked sample", () => {
    const empty = mkdtempSync(join(tmpdir(), "muvilion-real-")); vi.stubEnv("MUVILION_DATA_DIR", empty);
    try { expect(seedSampleProjects(samplesDirectory())).toBe(15); }
    finally { rmSync(empty, { recursive: true, force: true }); }
  });
});
