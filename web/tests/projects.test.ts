import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { emptyProject, ProjectState } from "@/lib/projects/schema";
import { createProject, getProject, saveProject, exportProject, uploadOriginal, getAsset, listProjects, linkMergedProject } from "@/server/projects/store";
import { withDatabase } from "@/server/database";
import { saveMetaKey } from "@/server/settings/store";
import { activateDrawing, addDrawing, drawingSources, saveDrawing } from "@/lib/projects/drawings";
import { ProjectSession } from "@/lib/projects/session";
import { POST, GET } from "@/app/api/projects/route";

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "muvilion-projects-")); vi.stubEnv("MUVILION_DATA_DIR", directory); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
function state() {
  return ProjectState.parse({ ...emptyProject(), document: {
    schemaVersion: 1, source: { name: "hall.png", format: "image", page: 1, pages: 1, width: 10, height: 10 },
    preview: "data:image/png;base64,AQID", widthMeters: 20, heightMeters: 10, scaleConfirmed: true,
    lines: [], texts: [], warnings: [], method: "opencv", floorBoundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  }, sources: { version: 1, drawingSelected: false, items: [{ id: "concept", kind: "concept", name: "Mood", selected: true, text: "", notes: "Keep blue", images: ["data:image/png;base64,AQID"] }] } });
}
describe("SQLite projects and file ownership", () => {
  it("persists drawing, sources and selection while storing images as deduplicated blobs", () => {
    const input = state();
    const p = createProject({ name: "Hall", state: input });
    expect(getProject(p.id).state).toEqual(input);
    withDatabase(db => {
      expect(db.prepare("SELECT count(*) AS n FROM assets").get()?.n).toBe(1);
      const file = db.prepare("SELECT typeof(content) AS type, content FROM assets").get()!;
      expect(file.type).toBe("blob"); expect([...file.content as Uint8Array]).toEqual([1, 2, 3]);
      expect(String(db.prepare("SELECT state_json FROM projects").get()?.state_json)).not.toContain("base64");
    });
    const updated = { ...input, sources: { ...input.sources, drawingSelected: true } };
    expect(saveProject(p.id, { name: "Renamed", revision: 0, state: updated }).revision).toBe(1);
    expect(getProject(p.id).state.sources.drawingSelected).toBe(true);
    expect(listProjects()[0].name).toBe("Renamed");
  });
  it("rejects stale writes atomically and keeps the saved state", () => {
    const p = createProject({ name: "Hall", state: state() });
    saveProject(p.id, { name: "First tab", revision: 0, state: state() });
    expect(() => saveProject(p.id, { name: "Second tab", revision: 0, state: emptyProject() })).toThrow(/another tab/);
    expect(getProject(p.id).name).toBe("First tab");
  });
  it("exports and imports original file bytes with fresh IDs, excluding app credentials", () => {
    saveMetaKey("test-secret-never-export");
    const p = createProject({ name: "Source project", state: state() });
    const original = uploadOriginal(p.id, "original.pdf", "application/pdf", new Uint8Array([37, 80, 68, 70]));
    const next = { ...p.state, originalDrawingId: original };
    saveProject(p.id, { name: p.name, revision: 0, state: next });
    const bundle = exportProject(p.id);
    expect(JSON.stringify(bundle)).not.toContain("test-secret");
    const copy = createProject(bundle);
    expect(copy.state.originalDrawingId).not.toBe(original);
    expect(getAsset(copy.id, copy.state.originalDrawingId!).data).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(copy.state.document).toEqual(p.state.document);
    expect(() => getAsset(copy.id, original)).toThrow(/not found/);
  });
  it("rolls back a project whose original file reference belongs to another project", () => {
    const p = createProject({ name: "A" });
    const id = uploadOriginal(p.id, "brief.txt", "text/plain", new Uint8Array([1]));
    expect(() => createProject({ name: "B", state: { ...emptyProject(), originalDrawingId: id } })).toThrow(/not found/);
    expect(listProjects()).toHaveLength(1);
  });
  it("rejects invalid and cross-origin HTTP writes", async () => {
    const req = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/projects", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
    expect((await POST(req({ name: "A" }))).status).toBe(200);
    expect((await POST(req({ name: "" }))).status).toBe(400);
    expect((await POST(req({ name: "B" }, "https://evil.test"))).status).toBe(403);
    expect((await GET(new Request("http://localhost:3000/api/projects"))).headers.get("cache-control")).toBe("no-store");
  });
});

describe("autosave sequencing", () => {
  it("serializes edits made during an in-flight save and uses the returned revision", async () => {
    const project = createProject({ name: "A" });
    let finish!: () => void;
    const write = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ ...project, revision: 1 }); }))
      .mockResolvedValueOnce({ ...project, revision: 2 });
    const session = new ProjectSession(project, write);
    session.update(emptyProject(), "First");
    const saving = session.flush();
    session.update(emptyProject(), "Second"); finish(); await saving;
    expect(write.mock.calls[1][2]).toBe(1); expect(write.mock.calls[1][1]).toBe("Second"); expect(session.pending).toBe(false);
  });
  it("keeps unsaved data after failure and retries without overwriting the revision", async () => {
    const project = createProject({ name: "A" });
    const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...project, revision: 1 });
    const session = new ProjectSession(project, write);
    session.update(state());
    await expect(session.flush()).rejects.toThrow("offline");
    expect(session.pending).toBe(true); expect(session.state.document).not.toBeNull();
    await session.retry(); expect(session.revision).toBe(1); expect(session.pending).toBe(false);
  });
});


describe("drawing sources", () => {
  it("upgrades a legacy project and preserves independent edits, selections and PDF pages", () => {
    const legacy = state();
    const first = drawingSources(legacy)[0];
    const second = { id: "page-2", document: { ...first.document, source: { ...first.document.source, page: 2, pages: 2 }, widthMeters: 40 }, originalAssetId: null, selected: true };
    let next = addDrawing(legacy, second);
    next = saveDrawing(next, { ...next.document!, wallHeight: 7, lines: [{ id: "wall", a: { x: 0, y: 0 }, b: { x: 1, y: 1 }, kind: "wall", origin: "manual", confidence: 1 }] });
    next = activateDrawing(next, first.id);
    expect(next.document).toEqual(legacy.document);
    expect(next.sources.drawingSelected).toBe(false);
    next = saveDrawing(next, { ...next.document!, widthMeters: 25, scaleConfirmed: true });
    next = activateDrawing(next, second.id);
    expect(next.document?.wallHeight).toBe(7);
    expect(next.document?.lines[0].id).toBe("wall");
    expect(next.document?.source.page).toBe(2);
    expect(next.sources.drawingSelected).toBe(true);
    next = activateDrawing(next, first.id);
    expect(next.document?.widthMeters).toBe(25);
    expect(next.document?.lines).toEqual([]);
    expect(() => activateDrawing(next, "missing")).toThrow(/not found/);
  });
  it("persists every drawing and remaps all originals on export/import", () => {
    const p = createProject({ name: "Multi", state: state() });
    const a = uploadOriginal(p.id, "A.pdf", "application/pdf", new Uint8Array([1, 2]));
    const b = uploadOriginal(p.id, "B.pdf", "application/pdf", new Uint8Array([3, 4]));
    const initial = { ...p.state, originalDrawingId: a };
    let next = addDrawing(initial, { id: "b", document: { ...initial.document!, widthMeters: 40 }, originalAssetId: b, selected: true });
    next = saveDrawing(next, { ...next.document!, wallHeight: 8 });
    saveProject(p.id, { name: p.name, revision: 0, state: next });
    expect(getProject(p.id).state).toEqual(next);
    withDatabase(db => expect(String(db.prepare("SELECT state_json FROM projects WHERE id = ?").get(p.id)?.state_json)).not.toContain("base64"));
    const bundle = exportProject(p.id);
    expect(bundle.assets).toHaveLength(2);
    const copy = createProject(bundle);
    expect(copy.state.drawings).toHaveLength(2);
    expect(copy.state.drawings?.map(item => item.document)).toEqual(next.drawings?.map(item => item.document));
    expect(copy.state.originalDrawingId).toBe(copy.state.drawings?.[1].originalAssetId);
    const copiedA = copy.state.drawings![0].originalAssetId!;
    expect(copiedA).not.toBe(a);
    expect(getAsset(copy.id, copiedA).data).toEqual(new Uint8Array([1, 2]));
    const switched = activateDrawing(copy.state, "legacy-drawing");
    saveProject(copy.id, { name: copy.name, revision: 0, state: switched });
    expect(getProject(copy.id).state.document).toEqual(initial.document);
    expect(getProject(copy.id).state.drawings?.[1].document.wallHeight).toBe(8);
  });
  it("validates inactive asset ownership, active IDs and the drawing limit", () => {
    const a = createProject({ name: "A" });
    const foreign = uploadOriginal(a.id, "A.pdf", "application/pdf", new Uint8Array([1]));
    const multi = addDrawing({ ...state(), originalDrawingId: foreign }, { id: "b", document: state().document!, originalAssetId: null, selected: true });
    expect(() => createProject({ name: "B", state: multi })).toThrow(/not found/);
    expect(ProjectState.safeParse({ ...multi, activeDrawingId: "missing" }).success).toBe(false);
    expect(ProjectState.safeParse({ ...multi, drawings: [multi.drawings![1], multi.drawings![1]] }).success).toBe(false);
    let full = state();
    for (let i = 1; i < 12; i++) full = addDrawing(full, { id: `drawing-${i}`, document: state().document!, originalAssetId: null, selected: true });
    expect(() => addDrawing(full, { id: "overflow", document: state().document!, originalAssetId: null, selected: true })).toThrow(/12 drawings/);
    expect(ProjectState.parse(emptyProject()).document).toBeNull();
  });
});


describe("consolidated project navigation", () => {
  it("lists a project once, opens legacy links at their drawing, and retains originals for export", () => {
    const source=createProject({name:"Hall 2",state:state()});
    const targetState=addDrawing(emptyProject(),{id:"hall-1",document:state().document!,originalAssetId:null,selected:true});
    const grouped=addDrawing(targetState,{id:"hall-2",document:{...state().document!,source:{...state().document!.source,name:"second.png"}},originalAssetId:null,selected:true});
    const target=createProject({name:"Venue",state:activateDrawing(grouped,"hall-1")});
    linkMergedProject(source.id,target.id,"hall-2",source.revision,target.revision);
    expect(listProjects().map(p=>p.id)).toEqual([target.id]);
    const oldLink=getProject(source.id);
    expect(oldLink.id).toBe(target.id);expect(oldLink.state.activeDrawingId).toBe("hall-2");
    expect(getProject(target.id).state.activeDrawingId).toBe("hall-1");
    expect(exportProject(source.id).state).toEqual(source.state);
    expect(()=>saveProject(source.id,{name:source.name,revision:source.revision,state:source.state})).toThrow(/consolidated/);
    expect(()=>uploadOriginal(source.id,"x.pdf","application/pdf",new Uint8Array([1]))).toThrow(/consolidated/);
    expect(()=>linkMergedProject(target.id,source.id,"hall-1",0,0)).toThrow();
  });
  it("rejects stale plans, missing drawings and uncopied originals before hiding anything", () => {
    const source=createProject({name:"Source",state:state()});
    const id=uploadOriginal(source.id,"source.pdf","application/pdf",new Uint8Array([1,2,3]));
    saveProject(source.id,{name:source.name,revision:0,state:{...source.state,originalDrawingId:id}});
    const target=createProject({name:"Target",state:addDrawing(emptyProject(),{id:"hall",document:state().document!,originalAssetId:null,selected:true})});
    expect(()=>linkMergedProject(source.id,target.id,"hall",0,0)).toThrow(/changed/);
    expect(()=>linkMergedProject(source.id,target.id,"missing",1,0)).toThrow(/not found/);
    expect(()=>linkMergedProject(source.id,target.id,"hall",1,0)).toThrow(/Copy all/);
    expect(listProjects()).toHaveLength(2);
  });
});
