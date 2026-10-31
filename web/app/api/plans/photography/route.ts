import { translate } from "@/lib/i18n/messages";
import { PhotographyRequestSchema } from "@/lib/plans/photography";
import { photographPlan } from "@/server/plans/photography";
import { PlanServiceError } from "@/server/plans/errors";

export const maxDuration = 90;
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 22_000_000) return Response.json({ error: "Photography request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = PhotographyRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid photography request." }, { status: 400 });
  try {
    return Response.json(await photographPlan(parsed.data, request.signal));
  } catch (error) {
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: translate(parsed.data.locale, "Photography failed. Please try again.") }, { status: 502 });
  }
}
