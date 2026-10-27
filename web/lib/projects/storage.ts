import { Draft, type StoredProject } from "./model";

const DB_NAME = "layout-engineer-projects";
const STORE = "projects";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("이 브라우저에서는 로컬 저장을 사용할 수 없습니다."));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "draft.id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("다른 탭을 닫고 다시 시도해 주세요."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error("브라우저 저장에 실패했습니다. 백업을 내려받아 주세요.")); };
  });
}

export async function listProjects(): Promise<StoredProject[]> {
  const rows = await transaction<StoredProject[]>("readonly", (s) => s.getAll());
  return rows.map((row) => ({ draft: Draft.parse(row.draft), file: row.file })).sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt));
}
export async function saveProject(project: StoredProject): Promise<void> {
  Draft.parse(project.draft);
  await transaction("readwrite", (s) => s.put(project));
}
export async function deleteProject(id: string): Promise<void> {
  await transaction("readwrite", (s) => s.delete(id));
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportProject(project: StoredProject) {
  let file: string | null = null;
  if (project.file) {
    file = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(project.file!);
    });
  }
  download(new Blob([JSON.stringify({ format: "layout-engineer-backup", draft: project.draft, file })], { type: "application/json" }), `${project.draft.name || "project"}.layout.json`);
}

export async function importProject(file: File): Promise<StoredProject> {
  if (file.size > 50 * 1024 * 1024) throw new Error("백업 파일은 50MB 이하로 선택해 주세요.");
  const raw = JSON.parse(await file.text());
  if (raw.format !== "layout-engineer-backup") throw new Error("Layout Engineer 백업 파일을 선택해 주세요.");
  const draft = Draft.parse(raw.draft);
  let original: Blob | null = null;
  if (raw.file !== null) {
    if (typeof raw.file !== "string" || !/^data:(application\/pdf|image\/png|image\/jpeg);base64,/.test(raw.file)) throw new Error("도면 파일 형식이 올바르지 않습니다.");
    const [header, data] = raw.file.split(",");
    original = new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: header.slice(5, -7) });
  }
  // Restores are always copies: never overwrite a newer project on this device.
  return { draft: { ...draft, id: crypto.randomUUID(), name: `${draft.name} (복원)`.slice(0, 120), updatedAt: new Date().toISOString() }, file: original };
}
