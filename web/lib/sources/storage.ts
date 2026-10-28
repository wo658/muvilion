import { SourceLibrarySchema, type SourceLibrary } from "./schema";
const DATABASE = "muvilion-sources-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readSources(): Promise<SourceLibrary | null> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("workspace").objectStore("workspace").get("sources");
      request.onsuccess = () => {
        const parsed = SourceLibrarySchema.safeParse(request.result);
        if (request.result === undefined) resolve(null);
        else if (parsed.success) resolve(parsed.data);
        else reject(new Error("Saved sources could not be read."));
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function writeSources(value: SourceLibrary) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      transaction.objectStore("workspace").put(value, "sources");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
