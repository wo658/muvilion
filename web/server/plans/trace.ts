import { TRACE_INSTRUCTIONS } from "./prompts";
import "server-only";
import { PlanServiceError } from "./errors";
import { generateText, tool } from "ai";
import { getModel } from "@/server/agent/model";
import type { PlanDocument } from "@/lib/plans/schema";
import { applyTrace, PlanTrace, traceEvidence } from "@/lib/plans/trace";

export const museTracingAvailable = () => getModel().hasKey;

export async function traceWalls(document: PlanDocument, signal: AbortSignal) {
  const model = getModel();
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
  try { return applyTrace(document, call.input); }
  catch (error) {
    console.warn("[muse-trace] invalid", error instanceof Error ? error.message.slice(0, 300) : String(error));
    throw new PlanServiceError("Muse returned an invalid drawing reading. Please retry.", 502);
  }
}
