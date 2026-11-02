import { PlanningRequestSchema, editPlanningDocument } from "@/server/plans/planning";
import { PlanServiceError } from "@/server/plans/errors";
export const maxDuration = 150;
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 32 * 1024 * 1024) return Response.json({ error: "Drawing request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = PlanningRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Provide a valid planning document and request." }, { status: 400 });
  try { return Response.json(await editPlanningDocument(parsed.data, req.signal)); }
  catch (error) {
    return Response.json({ error: error instanceof PlanServiceError ? error.message : "Muse could not revise the planning document. Try again." }, { status: error instanceof PlanServiceError ? error.status : 502 });
  }
}
