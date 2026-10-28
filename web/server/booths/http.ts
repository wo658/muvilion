import "server-only";
import { z } from "zod";
import { BoothError } from "./service";
export { BoothError } from "./service";

export function bearer(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (header === null) return undefined;
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) throw new BoothError(403, "Invalid access key.");
  return header.slice(7);
}
export async function readBoothBody<T extends z.ZodType>(request: Request, schema: T, maxBytes = 16 * 1024 * 1024): Promise<z.infer<T>> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new BoothError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new BoothError(400, "A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new BoothError(413, "Request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let data: unknown;
  try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new BoothError(400, "Invalid JSON."); }
  return schema.parse(data);
}
export async function boothHttp(action: () => unknown | Promise<unknown>, successStatus = 200): Promise<Response> {
  try { return Response.json(await action(), { status: successStatus, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); }
  catch (error) {
    const status = error instanceof BoothError ? error.status : error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof BoothError ? error.message : error instanceof z.ZodError ? "Invalid booth request. Check the required fields." : "The booth service could not complete this request.";
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
