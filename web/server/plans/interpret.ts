import { INTERPRET_INSTRUCTIONS } from "./prompts";
import "server-only";
import { PlanServiceError } from "./errors";
import { z } from "zod";
import { generateText, tool } from "ai";
import { getModel } from "@/server/agent/model";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { applyInterpretation, interpretationEvidence, PlanInterpretation } from "@/lib/plans/muse";

export async function interpretPlan(document: z.infer<typeof PlanDocumentSchema>, reviewMode: unknown, signal: AbortSignal) {
  const model = getModel();
  if (!model.hasKey) throw new PlanServiceError("Muse is not configured. Add MODEL_API_KEY to web/.env.local.", 503);
  const result = await generateText({
    model: model.model,
    instructions: INTERPRET_INSTRUCTIONS + (reviewMode === "global-wall-audit" ? "\nThis is a second-pass whole-plan audit of proposed walls. Inspect the ENTIRE layout before confirming each candidate. Long lines crossing an open labelled hall can be floor service trenches, tracks, grids or movable division guides, not walls. Repeated parallel floor features without enclosing room topology are not sufficient wall evidence. Confirm wall only when whole-plan context supports an actual vertical enclosure/partition; otherwise return unknown. Never promote a line just because the first pass proposed it." : ""),
    messages: [{ role: "user", content: [
      { type: "text", text: JSON.stringify(interpretationEvidence(document)) },
      { type: "file", data: document.preview, mediaType: "image/png" },
    ] }],
    tools: { submit_interpretation: tool({ description: "Submit classifications for supplied line IDs and uncertainties.", inputSchema: PlanInterpretation }) },
    toolChoice: "auto",
    temperature: 0.1,
    maxRetries: 1,
    timeout: 75_000,
    abortSignal: signal,
  });
  const call = result.toolCalls.find((item) => item.toolName === "submit_interpretation");
  if (!call) throw new PlanServiceError("Muse did not return classifications. Please retry.", 502);
  const interpretation = PlanInterpretation.parse(call.input);
  return { document: applyInterpretation(document, interpretation), summary: interpretation.summary };
}
