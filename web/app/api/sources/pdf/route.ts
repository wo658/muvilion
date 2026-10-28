import { PlanDocumentSchema } from "@/lib/plans/schema";
export const maxDuration = 180;
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 21 * 1024 * 1024) return Response.json({ error: "PDF must be under 20 MB." }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024 || !/\.pdf$/i.test(file.name)) return Response.json({ error: "Choose a PDF up to 20 MB." }, { status: 400 });
    const base = (process.env.ENGINE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(150_000)]);
    const previews: string[] = [], texts: string[] = [];
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const body = new FormData(); body.set("file", file); body.set("page", String(page));
      const response = await fetch(`${base}/plans/extract`, { method: "POST", body, signal });
      if (!response.ok) throw new Error("PDF extraction failed");
      const plan = PlanDocumentSchema.parse(await response.json());
      pages = plan.source.pages;
      if (pages > 12) return Response.json({ error: "Planning PDFs support up to 12 pages. Split this document first." }, { status: 422 });
      previews.push(plan.preview);
      texts.push(`Page ${page}\n${plan.texts.map(item => item.text).join("\n")}`);
      if (texts.join("\n").length > 60_000 || previews.reduce((size, image) => size + image.length, 0) > 24_000_000) return Response.json({ error: "This PDF is too large to preview. Split it into smaller documents." }, { status: 422 });
    }
    return Response.json({ previews, text: texts.join("\n\n") });
  } catch { return Response.json({ error: "PDF preview failed. Check the file and that the Python engine is running." }, { status: 503 }); }
}
