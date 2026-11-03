import { REFINE_INSTRUCTIONS, TRACE_INSTRUCTIONS } from "./prompts";
import "server-only";
import { PlanServiceError } from "./errors";
import { generateText, tool, type LanguageModel } from "ai";
import { getModel } from "@/server/agent/model";
import type { PlanDocument } from "@/lib/plans/schema";
import sharp from "sharp";
import { applyRefinement, applyTrace, decodeToolInput, needsRefinement, PlanTrace, ReferenceLocation, refinementWindow, traceEvidence, type ScaleEvidence } from "@/lib/plans/trace";

export const museTracingAvailable = async () => (await getModel()).hasKey;

export async function traceWalls(document: PlanDocument, signal: AbortSignal) {
  const model = await getModel();
  if (!model.hasKey) throw new PlanServiceError("Muse is not configured. Add a Meta API key in Settings or set MODEL_API_KEY in web/.env.local.", 503);
  signal.throwIfAborted();
  const result = await generateText({
    model: model.model,
    instructions: TRACE_INSTRUCTIONS,
    messages: [{ role: "user", content: [
      { type: "text", text: JSON.stringify(traceEvidence(document)) },
      { type: "file", data: document.preview, mediaType: "image/png" },
    ] }],
    tools: { submit_trace: tool({ description: "Submit traced wall segments in normalized image coordinates.", inputSchema: PlanTrace }) },
    toolChoice: "auto",
    temperature: 0.1,
    maxRetries: 1,
    timeout: 100_000,
    maxOutputTokens: 16000,
    abortSignal: signal,
  }).catch(() => {
    signal.throwIfAborted();
    throw new PlanServiceError("Muse could not read this drawing. Check model access and retry.", 502);
  });
  signal.throwIfAborted();
  if (result.finishReason === "length") throw new PlanServiceError("Muse could not finish reading this drawing. Try a smaller region.", 502);
  const call = result.toolCalls.find((item) => item.toolName === "submit_trace");
  if (!call) throw new PlanServiceError("Muse did not return traced walls. Please retry.", 502);
  const trace = PlanTrace.safeParse(decodeToolInput(call.input));
  if (!trace.success) throw new PlanServiceError("Muse returned an invalid drawing reading. Please retry.", 502);
  const scaleEvidence = await Promise.all(trace.data.scaleEvidence.map(item => refineReference(model.model, document, { ...item, refined: false }, signal)));
  return applyTrace(document, { ...trace.data, scaleEvidence });
}

/** Second look at a short scale bar or dimension on an enlarged crop; any failure keeps the first reading. */
async function refineReference(model: LanguageModel, document: PlanDocument, item: ScaleEvidence, signal: AbortSignal): Promise<ScaleEvidence> {
  const { width, height } = document.source;
  if (!needsRefinement(item, width, height)) return item;
  try {
    const image = Buffer.from(document.preview.slice(document.preview.indexOf(",") + 1), "base64");
    const meta = await sharp(image).metadata();
    const window = refinementWindow(item, width, height);
    const left = Math.floor(window.x * meta.width!), top = Math.floor(window.y * meta.height!);
    const crop = await sharp(image)
      .extract({ left, top, width: Math.max(1, Math.min(meta.width! - left, Math.ceil(window.width * meta.width!))), height: Math.max(1, Math.min(meta.height! - top, Math.ceil(window.height * meta.height!))) })
      .resize({ width: 1024, height: 1024, fit: "inside" }).png().toBuffer();
    const result = await generateText({
      model,
      instructions: REFINE_INSTRUCTIONS,
      messages: [{ role: "user", content: [
        { type: "text", text: JSON.stringify({ reference: { source: item.source, label: item.label, value: item.value, unit: item.unit } }) },
        { type: "file", data: `data:image/png;base64,${crop.toString("base64")}`, mediaType: "image/png" },
      ] }],
      tools: { locate_reference: tool({ description: "Report the reference's labelled ticks in normalized crop coordinates.", inputSchema: ReferenceLocation }) },
      toolChoice: "auto", temperature: 0, maxRetries: 1, timeout: 45_000, abortSignal: signal,
    });
    const call = result.toolCalls.find(entry => entry.toolName === "locate_reference");
    return call ? applyRefinement(item, window, call.input) : item;
  } catch (error) {
    if (signal.aborted) throw error;
    return item;
  }
}

