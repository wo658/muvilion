import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { withDatabase } from "@/server/database";
import { CreateProject, SaveProject, ProjectState, type Project, type ProjectSummary } from "@/lib/projects/schema";

export class ProjectError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const result = fn(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
function row(db: DatabaseSync, id: string) {
  const result = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!result) throw new ProjectError("Project not found.", 404);
  return result;
}
function summary(value: ReturnType<typeof row>): ProjectSummary {
  return { id: String(value.id), name: String(value.name), revision: Number(value.revision), updatedAt: String(value.updated_at) };
}
function asset(db: DatabaseSync, projectId: string, id: string) {
  const result = db.prepare("SELECT * FROM assets WHERE id = ? AND project_id = ?").get(id, projectId);
  if (!result) throw new ProjectError("Project file not found.", 404);
  return result;
}
function addAsset(db: DatabaseSync, projectId: string, name: string, mime: string, data: Uint8Array, kind: "image" | "original") {
  const digest = createHash("sha256").update(data).update(mime).update(kind === "original" ? name : "").digest("hex");
  const existing = db.prepare("SELECT id FROM assets WHERE project_id = ? AND digest = ? AND kind = ?").get(projectId, digest, kind);
  if (existing) return String(existing.id);
  const id = randomUUID();
  db.prepare("INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, projectId, name, mime, data, digest, kind, new Date().toISOString());
  return id;
}
function originalIds(state: ProjectState) {
  return [state.originalDrawingId, ...state.sources.items.map(item => item.originalAssetId)].filter((id): id is string => Boolean(id));
}
function pack(db: DatabaseSync, projectId: string, state: ProjectState): string {
  for (const id of originalIds(state)) asset(db, projectId, id);
  const image = (data: string, name: string) => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(data)!;
    return { assetId: addAsset(db, projectId, name, match[1], Buffer.from(match[2], "base64"), "image") };
  };
  return JSON.stringify({ ...state,
    document: state.document ? { ...state.document, preview: image(state.document.preview, "drawing-preview.png") } : null,
    sources: { ...state.sources, items: state.sources.items.map(item => ({ ...item, images: item.images.map(data => image(data, item.name)) })) },
  });
}
function unpack(db: DatabaseSync, projectId: string, json: string): ProjectState {
  const state = JSON.parse(json);
  const image = (ref: { assetId: string }) => {
    const file = asset(db, projectId, ref.assetId);
    return `data:${file.mime_type};base64,${Buffer.from(file.content as Uint8Array).toString("base64")}`;
  };
  if (state.document) state.document.preview = image(state.document.preview);
  for (const item of state.sources.items) item.images = item.images.map(image);
  return ProjectState.parse(state);
}
function load(db: DatabaseSync, id: string): Project {
  const value = row(db, id);
  return { ...summary(value), state: unpack(db, id, String(value.state_json)) };
}
export const listProjects = () => withDatabase(db => db.prepare("SELECT id, name, revision, updated_at FROM projects ORDER BY updated_at DESC, id").all().map(summary));
export const getProject = (id: string) => withDatabase(db => load(db, id));
export function createProject(input: unknown) {
  const parsed = CreateProject.parse(input);
  return withDatabase(db => transaction(db, () => {
    const id = randomUUID(), time = new Date().toISOString();
    db.prepare("INSERT INTO projects VALUES (?, ?, 0, '{}', ?, ?, ?)").run(id, parsed.name, null, time, time);
    const ids = new Map<string, string>();
    for (const file of parsed.assets) {
      const bytes = Buffer.from(file.data, "base64");
      if (bytes.length > 20 * 1024 * 1024) throw new ProjectError("An original file exceeds 20 MB.");
      ids.set(file.id, addAsset(db, id, file.name, file.mimeType, bytes, "original"));
    }
    const state = parsed.state;
    if (state.originalDrawingId) state.originalDrawingId = ids.get(state.originalDrawingId) ?? state.originalDrawingId;
    for (const item of state.sources.items) if (item.originalAssetId) item.originalAssetId = ids.get(item.originalAssetId) ?? item.originalAssetId;
    db.prepare("UPDATE projects SET state_json = ? WHERE id = ?").run(pack(db, id, state), id);
    return load(db, id);
  }));
}
export function saveProject(id: string, input: unknown) {
  const parsed = SaveProject.parse(input);
  return withDatabase(db => transaction(db, () => {
    const existing = row(db, id);
    if (Number(existing.revision) !== parsed.revision) throw new ProjectError("This project changed in another tab. Export your edits before reloading the saved version.", 409);
    db.prepare("UPDATE projects SET name = ?, state_json = ?, revision = revision + 1, updated_at = ? WHERE id = ?")
      .run(parsed.name, pack(db, id, parsed.state), new Date().toISOString(), id);
    return summary(row(db, id));
  }));
}
export function uploadOriginal(id: string, name: string, mime: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new ProjectError("Choose a file between 1 byte and 20 MB.");
  return withDatabase(db => transaction(db, () => { row(db, id); return addAsset(db, id, name.slice(0, 255), mime.slice(0, 100), bytes, "original"); }));
}
export function getAsset(id: string, assetId: string) {
  return withDatabase(db => { const file = asset(db, id, assetId); return { name: String(file.name), mimeType: String(file.mime_type), data: new Uint8Array(file.content as Uint8Array) }; });
}
export function exportProject(id: string) {
  return withDatabase(db => {
    const project = load(db, id);
    const assets = [...new Set(originalIds(project.state))].map(assetId => {
      const file = asset(db, id, assetId);
      return { id: assetId, name: String(file.name), mimeType: String(file.mime_type), data: Buffer.from(file.content as Uint8Array).toString("base64") };
    });
    return { projectVersion: 2, name: project.name, state: project.state, assets };
  });
}
