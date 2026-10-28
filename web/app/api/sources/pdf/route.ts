import { previewPdf } from "@/server/plans/pdf";
import { PlanServiceError } from "@/server/plans/errors";
export const maxDuration = 180;
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 21 * 1024 * 1024) return Response.json({ error: "PDF must be under 20 MB." }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024 || !/\.pdf$/i.test(file.name)) return Response.json({ error: "Choose a PDF up to 20 MB." }, { status: 400 });
    return Response.json(await previewPdf(file, request.signal));
  } catch (error) {
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "PDF preview failed. Check the file and that the Python engine is running." }, { status: 503 }); }
}
