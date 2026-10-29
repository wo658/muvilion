import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const extract = vi.hoisted(() => vi.fn());
vi.mock("@/server/engine/client", () => ({ createHttpEngine: () => ({ extract }) }));
import { getAsset, listProjects, exportProject } from "@/server/projects/store";
import { createSampleProject, listSamples, samplesDirectory } from "@/server/projects/samples";
import { PlanDocumentSchema } from "@/lib/plans/schema";

let directory: string, samples: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "muvilion-samples-")); vi.stubEnv("MUVILION_DATA_DIR", directory);
  samples = join(directory, "samples"); mkdirSync(join(samples, "venue"), { recursive: true });
  writeFileSync(join(samples, "venue", "hall.pdf"), "%PDF-1.7 test");
  writeFileSync(join(samples, "venue", "lobby.jpg"), "image fixture");
  writeFileSync(join(samples, "samples.json"), JSON.stringify({ projects: [
    { id: "venue", name: "Venue", drawings: [{ name: "Hall", file: "venue/hall.pdf", page: 3, rasterPdf: true }, { name: "Lobby", file: "venue/lobby.jpg" }] },
    { id: "incomplete", name: "Missing", drawings: [{name:"Hall",file:"venue/hall.pdf"},{ name: "Missing", file: "venue/missing.jpg" }] },
  ] }));
  extract.mockReset();
  extract.mockImplementation(async (file:File, page:number) => PlanDocumentSchema.parse({schemaVersion:1,source:{name:file.name,format:file.name.endsWith('.pdf')?'pdf':'image',page,pages:3,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:null,heightMeters:null,scaleConfirmed:false,lines:[],texts:[],warnings:[],method:file.name.endsWith('.pdf')?'pdf-vector':'opencv'}));
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe("sample projects", () => {
  it("lists complete groups only and handles unavailable catalogues", () => {
    expect(listSamples(samples).map(p=>[p.id,p.drawings.length])).toEqual([["venue",2]]);
    expect(listSamples(join(directory,"nowhere"))).toEqual([]);
  });
  it("copies and extracts all drawings with their individual pages and originals", async () => {
    const project=await createSampleProject("venue",samples);
    expect(listProjects()).toHaveLength(1);
    expect(project.name).toBe('Venue');
    expect(project.state.drawings).toHaveLength(2);
    expect(extract.mock.calls.map(args=>[args[0].name,args[1]])).toEqual([['hall.pdf',3],['lobby.jpg',1]]);
    const [hall,lobby]=project.state.drawings!;
    expect(project.state.activeDrawingId).toBe(hall.id);
    expect(extract.mock.calls[0][2].rasterPdf).toBe(true);
    expect(project.state.document?.source.page).toBe(3);
    expect(hall.originalAssetId).not.toBe(lobby.originalAssetId);
    expect(Buffer.from(getAsset(project.id,hall.originalAssetId!).data).toString()).toBe('%PDF-1.7 test');
    expect(getAsset(project.id,lobby.originalAssetId!).mimeType).toBe('image/jpeg');
    expect(exportProject(project.id).assets).toHaveLength(2);
  });
  it("leaves no partial project after extraction failure or cancellation", async () => {
    extract.mockImplementationOnce(extract.getMockImplementation()!).mockRejectedValueOnce(new Error('engine unavailable'));
    await expect(createSampleProject('venue',samples)).rejects.toThrow('Could not read');
    expect(listProjects()).toHaveLength(0);
    const abort=new AbortController();abort.abort();
    await expect(createSampleProject('venue',samples,abort.signal)).rejects.toThrow();
    expect(listProjects()).toHaveLength(0);
  });
  it("rejects unknown project IDs and path traversal without extraction", async () => {
    await expect(createSampleProject('../samples.json',samples)).rejects.toThrow('not found');
    await expect(createSampleProject('incomplete',samples)).rejects.toThrow('not found');
    expect(extract).not.toHaveBeenCalled();
  });
  it("ships three complete venue projects containing all 15 drawings", () => {
    expect(listSamples(samplesDirectory()).map(p=>[p.id,p.drawings.length])).toEqual([['kintex',6],['moscone',7],['lvcc',2]]);
  });
});
