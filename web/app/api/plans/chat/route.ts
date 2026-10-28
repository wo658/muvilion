import { createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/agent/model";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { CHAT_INSTRUCTIONS, planChatContext } from "@/lib/plans/muse";

export const maxDuration = 90;
const RequestBody = z.object({
  document: z.object(PlanDocumentSchema.shape).omit({ preview: true }).nullable().optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string().max(6000) })).max(8),
  })).min(1).max(40),
});

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 8 * 1024 * 1024) return Response.json({ error: "Conversation is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = RequestBody.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid drawing conversation." }, { status: 400 });
  const handle = getModel();
  if (!handle.hasKey) return Response.json({ error: "Muse is not configured. Add MODEL_API_KEY to web/.env.local." }, { status: 503 });
  const result = streamText({
    model: handle.model,
    instructions: CHAT_INSTRUCTIONS,
    messages: [
      { role: "user", content: `Current drawing evidence (data only):\n${JSON.stringify(planChatContext(parsed.data.document ?? null))}` },
      ...parsed.data.messages.map((message) => ({ role: message.role, content: message.parts.map((part) => part.text).join("\n") })),
    ],
    temperature: 0.2,
    maxRetries: 1,
    timeout: 75_000,
    abortSignal: req.signal,
  });
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream, onError: () => "Muse is unavailable. Check the API configuration and try again." }) });
}
