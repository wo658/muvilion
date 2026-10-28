import { uploadOriginal, ProjectError } from "@/server/projects/store";
import { projectRoute } from "@/server/projects/http";
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return projectRoute(req, async () => {
    if (Number(req.headers.get("content-length")) > 21 * 1024 * 1024) throw new ProjectError("File exceeds 20 MB.", 413);
    const form = await req.formData(), file = form.get("file");
    if (!(file instanceof File)) throw new ProjectError("Choose a file.");
    if (file.size > 20 * 1024 * 1024) throw new ProjectError("File exceeds 20 MB.", 413);
    return { id: uploadOriginal((await context.params).id, file.name, file.type || "application/octet-stream", new Uint8Array(await file.arrayBuffer())) };
  });
}
