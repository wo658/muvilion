import { extractDrawing } from "@/server/plans/extract";
import { PlanServiceError } from "@/server/plans/errors";

export const maxDuration = 240;
const MAX_FILE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_FILE + 64 * 1024) return Response.json({ error: "Choose a file smaller than 20 MB." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "Upload a PDF, PNG or JPG file." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a non-empty file." }, { status: 400 });
  if (file.size > MAX_FILE) return Response.json({ error: "Choose a file smaller than 20 MB." }, { status: 413 });
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) return Response.json({ error: "Supported formats: PDF, PNG, JPG. Export CAD drawings to PDF first." }, { status: 415 });
  const page = Number(form.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1) return Response.json({ error: "Choose a valid page." }, { status: 400 });
  try {
    return Response.json(await extractDrawing(file, page, { signal: request.signal }));
  } catch (error) {
    if (request.signal.aborted) return Response.json({ error: "Drawing reading cancelled." }, { status: 499 });
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Drawing reading failed or timed out. Check the file and retry." }, { status: 503 });
  }
}
