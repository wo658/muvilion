/**
 * "Download plan (PNG)": rasterize the 2D site plan SVG in the browser. The plan colors are CSS
 * variables (lib/ui/tokens.ts), which a detached SVG image cannot resolve, so they are inlined first.
 */

/** Replace every `var(--name[, fallback])` with its resolved value (unknown names keep the fallback). */
export function inlineCssVars(svg: string, resolve: (name: string) => string | undefined): string {
  return svg.replace(/var\((--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name: string, fallback?: string) => {
    const v = resolve(name)?.trim();
    return v || fallback?.trim() || "currentColor";
  });
}

/** Render `svgEl` to a PNG and download it as `filename` (client only). */
export async function downloadSvgAsPng(svgEl: SVGSVGElement, filename: string, opts: { width?: number; background?: string } = {}): Promise<void> {
  const style = getComputedStyle(document.documentElement);
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const vb = svgEl.viewBox.baseVal;
  const width = opts.width ?? 2000;
  const height = Math.round((width * vb.height) / vb.width);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("class");
  const text = inlineCssVars(new XMLSerializer().serializeToString(clone), (n) => style.getPropertyValue(n));
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("could not draw the plan"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = opts.background ?? (style.getPropertyValue("--surface").trim() || "#ffffff");
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("could not create the image");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
