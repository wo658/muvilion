import type { ReferenceSource } from "./schema";
export async function compactImage(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preview is unavailable.");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.65, 0.4]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= 600_000) return data;
    }
    throw new Error("Image is too detailed. Please upload a smaller image.");
  } finally { bitmap.close(); }
}
export async function readReference(file: File, kind: "concept" | "brief"): Promise<ReferenceSource> {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Choose a non-empty file up to 20 MB.");
  const result: ReferenceSource = { id: crypto.randomUUID(), kind, name: file.name, selected: false, text: "", notes: "", images: [] };
  if (kind === "concept") {
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error("Choose a PNG, JPG or WebP concept image.");
    result.images = [await compactImage(file)];
  } else if (/\.(txt|md)$/i.test(file.name)) {
    result.text = await file.text();
    if (result.text.length > 60_000) throw new Error("Text documents support up to 60,000 characters.");
  } else if (/\.pdf$/i.test(file.name)) {
    const body = new FormData(); body.set("file", file);
    const response = await fetch("/api/sources/pdf", { method: "POST", body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "PDF could not be read.");
    result.text = data.text;
    for (const preview of data.previews as string[]) {
      result.images.push(await compactImage(await (await fetch(preview)).blob()));
    }
  } else throw new Error("Choose a PDF, TXT or Markdown planning document.");
  return result;
}

/** Workspace geometry is separate; the drawing bitmap is an opt-in reference. */
export async function selectedReferences(library: import("./schema").SourceLibrary, plan: import("../plans/schema").PlanDocument | null): Promise<ReferenceSource[]> {
  const selected = library.items.filter(item => item.selected);
  if (!plan || !library.drawingSelected) return selected;
  const image = await compactImage(await (await fetch(plan.preview)).blob());
  return [{ id: "workspace-drawing", kind: "drawing", name: plan.source.name, selected: true, text: plan.texts.map(item => item.text).join("\n").slice(0, 60_000), notes: `Current drawing page ${plan.source.page} of ${plan.source.pages}.`, images: [image] }, ...selected];
}
