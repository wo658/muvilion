import "server-only";
import sharp from "sharp";
import { generateText, tool } from "ai";
import type { z } from "zod";
import { getModel } from "@/server/agent/model";
import type { PlanDocument } from "@/lib/plans/schema";
import { PlanMeasure, ScaleBar, refinedMarks, scaleCrop } from "@/lib/plans/measure";
import { decodeToolInput } from "@/lib/plans/trace";
import { MEASURE_INSTRUCTIONS, SCALE_BAR_INSTRUCTIONS } from "./prompts";

const ZOOM_EDGE = 1400;

async function callTool<T>(instructions: string, text: string, image: string, name: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T | null> {
  const result = await generateText({
    model: getModel().model,
    instructions,
    messages: [{ role: "user", content: [{ type: "text", text }, { type: "file", data: image, mediaType: "image/png" }] }],
    tools: { [name]: tool({ description: `Submit ${name.replace("submit_", "")}.`, inputSchema: schema }) },
    toolChoice: "auto",
    temperature: 0.1,
    maxRetries: 1,
    timeout: 90_000,
    maxOutputTokens: 16000,
    abortSignal: signal,
  });
  const call = result.toolCalls.find(item => item.toolName === name);
  return call ? schema.parse(decodeToolInput(call.input)) : null;
}

/** Coordinate grid so Muse reads positions instead of estimating them; evidence image only, never shown in the UI. */
function gridOverlay(width: number, height: number) {
  let svg = "";
  for (let i = 0; i <= 40; i++) {
    const v = i / 40, major = i % 4 === 0, stroke = major ? "#dd0000" : "#ff9999", weight = major ? 2 : 1;
    svg += `<line x1="0" y1="${v * height}" x2="${width}" y2="${v * height}" stroke="${stroke}" stroke-width="${weight}" opacity="0.7"/><line x1="${v * width}" y1="0" x2="${v * width}" y2="${height}" stroke="${stroke}" stroke-width="${weight}" opacity="0.7"/>`;
    if (major) svg += `<text x="4" y="${v * height - 3}" font-size="22" fill="#dd0000">${v.toFixed(1)}</text><text x="${v * width + 3}" y="22" font-size="22" fill="#dd0000">${v.toFixed(1)}</text>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svg}</svg>`);
}

/** Zoom into the scale reference with a grid and read its bar twice; keep the first estimate if this pass fails. */
async function refineScale(document: PlanDocument, scale: NonNullable<PlanMeasure["scale"]>, signal: AbortSignal) {
  const size = { width: document.source.width, height: document.source.height };
  const png = Buffer.from(document.preview.split(",")[1], "base64");
  const meta = await sharp(png).metadata();
  if (meta.width !== size.width || meta.height !== size.height) return scale;
  const box = scaleCrop(size, scale);
  const factor = Math.min(4, ZOOM_EDGE / Math.max(box.width, box.height));
  const width = Math.round(box.width * factor), height = Math.round(box.height * factor);
  const crop = await sharp(png).extract(box).resize(width, height, { kernel: "lanczos3" }).composite([{ input: gridOverlay(width, height) }]).png().toBuffer();
  const image = `data:image/png;base64,${crop.toString("base64")}`;
  const text = JSON.stringify({ reference: scale.evidence, meters: scale.meters });
  const bars = (await Promise.all([0, 1].map(() => callTool(SCALE_BAR_INSTRUCTIONS, text, image, "submit_bar", ScaleBar, signal)
    .catch(error => { signal.throwIfAborted(); console.warn("[muse-measure] refine", error instanceof Error ? error.message.slice(0, 200) : error); return null; }))))
    .filter((bar): bar is ScaleBar => bar !== null);
  const marks = refinedMarks(size, box, bars, scale);
  return marks ? { ...scale, ...marks } : scale;
}

/** Scale reference and usable floor from the page image. Failures leave scale and floor to the user. */
export async function measureDrawing(document: PlanDocument, signal: AbortSignal): Promise<PlanMeasure | null> {
  try {
    const measure = await callTool(MEASURE_INSTRUCTIONS, JSON.stringify({ source: document.source, texts: document.texts.slice(0, 200) }), document.preview, "submit_measure", PlanMeasure, signal);
    if (!measure?.scale) return measure;
    return { ...measure, scale: await refineScale(document, measure.scale, signal) };
  } catch (error) {
    signal.throwIfAborted();
    console.warn("[muse-measure]", error instanceof Error ? error.message.slice(0, 300) : String(error));
    return null;
  }
}
