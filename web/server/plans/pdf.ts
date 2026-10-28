import "server-only";
import { createHttpEngine } from "@/server/engine/client";
import { PlanServiceError } from "./errors";

export async function previewPdf(file: File, signal: AbortSignal) {
  const engine = createHttpEngine();
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(150_000)]);
  const previews: string[] = [], texts: string[] = [];
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const plan = await engine.extract(file, page, { signal: deadline, timeoutMs: 150_000 });
    pages = plan.source.pages;
    if (pages > 12) throw new PlanServiceError("Planning PDFs support up to 12 pages. Split this document first.", 422);
    previews.push(plan.preview);
    texts.push(`Page ${page}\n${plan.texts.map(item => item.text).join("\n")}`);
    if (texts.join("\n").length > 60_000 || previews.reduce((size, image) => size + image.length, 0) > 24_000_000) throw new PlanServiceError("This PDF is too large to preview. Split it into smaller documents.", 422);
  }
  return { previews, text: texts.join("\n\n") };
}
