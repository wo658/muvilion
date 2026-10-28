import { PlanDocumentSchema } from "@/lib/plans/schema";
import { interpretPlan } from "@/server/plans/interpret";
import { PlanServiceError } from "@/server/plans/errors";

export const maxDuration = 90;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 8 * 1024 * 1024) return Response.json({ error: "Drawing request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = PlanDocumentSchema.safeParse((body as { document?: unknown } | null)?.document);
  if (!parsed.success) return Response.json({ error: "Invalid drawing document." }, { status: 400 });
  const document = parsed.data;
  if (!document.lines.some((line) => line.kind === "unknown")) return Response.json({ error: "No unclassified lines to review." }, { status: 400 });
  if (document.lines.filter(line => line.kind === "unknown").length > 600) return Response.json({ error: "Use regional analysis for more than 600 candidates." }, { status: 422 });
  try {
    return Response.json(await interpretPlan(document, (body as { reviewMode?: unknown }).reviewMode, req.signal));
  } catch (error) {
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Muse could not interpret this drawing. Check the API configuration or retry; your drawing is unchanged." }, { status: 502 });
  }
}
