import type { ProjectDraft } from "./model";

export async function readPlan(file: Blob, name: string, page = 1): Promise<NonNullable<ProjectDraft["source"]>> {
  if (file.size > 20 * 1024 * 1024) throw new Error("도면은 20MB 이하로 선택해 주세요.");
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw new Error("PDF, PNG, JPG 파일을 선택해 주세요.");
  const canvas = document.createElement("canvas");
  let pages = 1;
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: "/pdf-assets/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdf-assets/standard_fonts/", wasmUrl: "/pdf-assets/wasm/" });
    try {
      const document = await task.promise;
      pages = document.numPages;
      const pdfPage = await document.getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: Math.min(1600 / base.width, 1600 / base.height, 2) });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await pdfPage.render({ canvas, viewport }).promise;
    } finally { await task.destroy(); }
  } else {
    const image = await createImageBitmap(file);
    const scale = Math.min(1600 / image.width, 1600 / image.height, 1);
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
  }
  return { name, type: file.type as NonNullable<ProjectDraft["source"]>["type"], page, pages, width: canvas.width, height: canvas.height, preview: canvas.toDataURL("image/png") };
}
