import { IntentRequest } from "@/lib/plans/intent";
import { classifyPlanIntent } from "@/server/plans/intent";
import { PlanServiceError } from "@/server/plans/errors";

export const maxDuration = 30;

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 200_000) return Response.json({ error: "Conversation is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = IntentRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid intent request." }, { status: 400 });
  try {
    return Response.json(await classifyPlanIntent(parsed.data, request.signal));
  } catch (error) {
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Muse could not determine your request. Please try again." }, { status: 502 });
  }
}
