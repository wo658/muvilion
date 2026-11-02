import "server-only";
import { preparePages } from "./prepare";

/** Reference pages go directly to Muse as images; no local text/line extraction or OCR. */
export async function previewPdf(file: File, signal: AbortSignal) {
  const pages = await preparePages(file, 1, { signal, allPages: true });
  return { previews: pages.map(page => page.preview), text: "" };
}
