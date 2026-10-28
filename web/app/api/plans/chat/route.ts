import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { RequestBody, chatPlan } from "@/server/plans/chat";
import { PlanServiceError } from "@/server/plans/errors";
export const maxDuration = 90;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 32 * 1024 * 1024) return Response.json({ error: "Conversation is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = RequestBody.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid drawing conversation." }, { status: 400 });
  try {
    const result = chatPlan(parsed.data, req.signal);
    return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream, onError: () => "Muse is unavailable. Check the API configuration and try again." }) });
  } catch (error) {
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Muse is unavailable. Check the API configuration and try again." }, { status: 502 });
  }
}
