import { PlanDocumentSchema } from "@/lib/plans/schema";

export const maxDuration = 120;
const MAX_FILE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_FILE + 64 * 1024) return Response.json({ error: "Choose a file smaller than 20 MB." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "Upload a PDF, image, or DXF file." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a non-empty file." }, { status: 400 });
  if (file.size > MAX_FILE) return Response.json({ error: "Choose a file smaller than 20 MB." }, { status: 413 });
  if (!/\.(pdf|png|jpe?g|dxf)$/i.test(file.name)) return Response.json({ error: "Supported formats: PDF, PNG, JPG, DXF." }, { status: 415 });
  const page = Number(form.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1) return Response.json({ error: "Choose a valid page." }, { status: 400 });
  const body = new FormData(); body.set("file", file); body.set("page", String(page));
  try {
    const base = (process.env.ENGINE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
    const response = await fetch(`${base}/plans/extract`, {
      method: "POST", body, signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
    });
    const data = await response.json();
    if (!response.ok) return Response.json({ error: typeof data.detail === "string" ? data.detail : "This file could not be read. Check its format and page." }, { status: response.status });
    const parsed = PlanDocumentSchema.safeParse(data);
    if (!parsed.success) return Response.json({ error: "The extraction service returned an incompatible plan." }, { status: 502 });
    return Response.json(parsed.data);
  } catch {
    return Response.json({ error: "The plan service is unavailable or timed out. Start the Python engine and try again." }, { status: 503 });
  }
}
