import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { emptyProject, ProjectState } from "@/lib/projects/schema";
import { createProject, getProject, saveProject, exportProject, uploadOriginal, getAsset, listProjects } from "@/server/projects/store";
import { withDatabase } from "@/server/database";
import { saveMetaKey } from "@/server/settings/store";
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
  it("recovers browser data idempotently without replacing existing projects", () => {
    createProject({ name: "Existing" });
    const a = createProject({ name: "Recovered", state: state(), legacy: true });
    const b = createProject({ name: "Recovered", state: state(), legacy: true });
    expect(a.id).toBe(b.id); expect(listProjects()).toHaveLength(2);
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
