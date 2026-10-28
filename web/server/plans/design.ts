import { DESIGN_INSTRUCTIONS } from "./prompts";
import "server-only";
import { PlanServiceError } from "./errors";
import { generateText, tool } from "ai";
import { z } from "zod";
import { getModel } from "@/server/agent/model";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { applyDesignProposal, PlanDesignProposal, planChatContext } from "@/lib/plans/muse";

import { SourceRequestSchema } from "@/lib/sources/schema";
import { sourceContent, SOURCE_INSTRUCTIONS } from "./sources";

export const DesignRequest = z.object({ sources: SourceRequestSchema, drawingSelected: z.boolean().default(true), document: PlanDocumentSchema, brief: z.string().trim().min(1).max(6000) });

export async function designPlan(input: z.infer<typeof DesignRequest>, signal: AbortSignal) {
  const { document, brief } = input;
  const model = getModel();
  if (!model.hasKey) throw new PlanServiceError("Muse is not configured. Add a Meta API key in Settings or set MODEL_API_KEY in web/.env.local.", 503);
  const result = await generateText({
    model: model.model,
    instructions: DESIGN_INSTRUCTIONS + "\n" + SOURCE_INSTRUCTIONS,
    messages: [{ role: "user", content: [{ type: "text", text: JSON.stringify({ brief, context: planChatContext({ ...document, texts: input.drawingSelected ? document.texts : [] }), wallLines: document.lines.filter(line => line.kind === "wall") }) }, ...sourceContent(input.sources)] }],
    tools: { submit_design: tool({ description: "Submit editable space zones, physical installations with heights, and assumptions for user review. Existing source and ceiling conditions remain unchanged.", inputSchema: PlanDesignProposal }) },
    toolChoice: "auto",
    temperature: 0.2, maxRetries: 1, timeout: 75_000, abortSignal: signal,
  });
  const call = result.toolCalls.find(item => item.toolName === "submit_design");
  if (!call) throw new PlanServiceError("Muse did not return a design. Please retry.", 502);
  const proposal = PlanDesignProposal.parse(call.input);
  return { document: applyDesignProposal(document, proposal), summary: proposal.summary };
}
