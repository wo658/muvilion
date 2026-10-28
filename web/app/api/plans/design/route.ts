import { DesignRequest, designPlan } from "@/server/plans/design";
import { PlanServiceError } from "@/server/plans/errors";

export const maxDuration = 90;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 32 * 1024 * 1024) return Response.json({ error: "Drawing request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = DesignRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Provide a valid drawing and design brief." }, { status: 400 });
  const { document } = parsed.data;
  if (!document.scaleConfirmed) return Response.json({ error: "Confirm the drawing scale before drafting a layout." }, { status: 400 });
  try {
    return Response.json(await designPlan(parsed.data, req.signal));
  } catch (error) {
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Muse could not draft a layout. Check the API configuration or retry; your drawing is unchanged." }, { status: 502 });
  }
}
