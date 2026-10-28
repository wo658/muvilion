import "server-only";
import { ZodError } from "zod";
import { localSettingsRequest } from "@/server/settings/meta-key";
import { ProjectError } from "./store";
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function projectRoute(req: Request, action: () => unknown | Promise<unknown>): Promise<Response> {
  if (!localSettingsRequest(req)) return json({ error: "Open projects on localhost." }, 403);
  try { const result = await action(); return result instanceof Response ? result : json(result); }
  catch (error) {
    if (error instanceof ProjectError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError) return json({ error: "Invalid project data." }, 400);
    return json({ error: "Could not access the local project database. Your browser edits have been kept." }, 500);
  }
}
export async function readJson(req: Request, maxMB = 32): Promise<unknown> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ProjectError("Expected JSON.", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new ProjectError("Missing project data.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxMB * 1024 * 1024) { await reader.cancel(); throw new ProjectError(`Project exceeds ${maxMB} MB.`, 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
