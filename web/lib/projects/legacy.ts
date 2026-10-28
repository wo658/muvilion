import { SourceLibrarySchema, type SourceLibrary } from "@/lib/sources/schema";
const DATABASE = "muvilion-sources-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readLegacySources(): Promise<SourceLibrary | null> {
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
/** Called only after the server has committed the recovered project. */
export async function clearLegacySources() {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").delete("sources");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
