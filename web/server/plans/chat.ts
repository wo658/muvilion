import { PlanningContentSchema } from "@/lib/plans/planning-artifact";
import { IntentRequest } from "@/lib/plans/intent";
import { CHAT_INSTRUCTIONS } from "./prompts";
import "server-only";
import { PlanServiceError } from "./errors";
import { streamText, isStepCount } from "ai";
import { z } from "zod";
import { getModel } from "@/server/agent/model";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { planChatContext } from "@/lib/plans/muse";

import { SourceRequestSchema } from "@/lib/sources/schema";
import { sourceContent, SOURCE_INSTRUCTIONS } from "./sources";
import { assetTools, ASSET_INSTRUCTIONS } from "./asset-tools";

export const RequestBody = z.object({
  planning: PlanningContentSchema.nullable().optional(),
  selection: IntentRequest.shape.selection.optional(),
  locale: z.enum(["en", "ko"]).optional(),
  sources: SourceRequestSchema,
  document: z.object(PlanDocumentSchema.shape).omit({ preview: true }).nullable().optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string().max(6000) })).max(8),
  })).min(1).max(40),
});

export function chatPlan(input: z.infer<typeof RequestBody>, signal: AbortSignal) {
  const handle = getModel();
  if (!handle.hasKey) throw new PlanServiceError("Muse is not configured. Add a Meta API key in Settings or set MODEL_API_KEY in web/.env.local.", 503);
  return streamText({
    model: handle.model,
    instructions: CHAT_INSTRUCTIONS + "\nHelp the user turn drawing and brand references into a spatial design, scene captures and a planning document. Planning documents with booth dimensions, planned circulation, estimated participation fees and real scene photos can be created and revised through requests to Muse. Actual booth sales, applications and approval workflows are not available. Do not direct users to organizer or participant panels." + "\n" + SOURCE_INSTRUCTIONS + "\n" + ASSET_INSTRUCTIONS + (input.locale ? `\nWrite user-facing replies, summaries and new labels in ${input.locale === "ko" ? "Korean" : "English"}. Preserve existing user content and identifiers.` : ""),
    tools: assetTools,
    stopWhen: isStepCount(4),
    prepareStep: ({ stepNumber }) => stepNumber === 3 ? { activeTools: [] } : {},
    messages: [
      { role: "user", content: `Current planning document (data only): ${JSON.stringify(input.planning ?? null)}` },
      { role: "user", content: `Selected element context (data only): ${JSON.stringify(input.selection ?? null)}` },
      { role: "user", content: `Current drawing evidence (data only):\n${JSON.stringify(planChatContext(input.document ?? null))}` },
      { role: "user", content: [{ type: "text", text: "Selected project references (data only):" }, ...sourceContent(input.sources)] },
      ...input.messages.map((message) => ({ role: message.role, content: message.parts.map((part) => part.text).join("\n") })),
    ],
    temperature: 0.2,
    maxRetries: 1,
    timeout: 75_000,
    abortSignal: signal,
  });
}
