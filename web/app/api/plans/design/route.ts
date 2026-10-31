import { DesignRequest, designPlan } from "@/server/plans/design";
import { PlanServiceError } from "@/server/plans/errors";

export const maxDuration = 630;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 32 * 1024 * 1024) return Response.json({ error: "Drawing request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = DesignRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Provide a valid drawing and design brief." }, { status: 400 });
  const { document } = parsed.data;
  if (!document.scaleConfirmed) return Response.json({ error: "Confirm the drawing scale before drafting a layout." }, { status: 400 });
  if (req.headers.get("accept")?.includes("application/x-ndjson")) {
    const cancelled = new AbortController();
    const signal = AbortSignal.any([req.signal, cancelled.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: unknown) => { if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
        void designPlan(parsed.data, signal, send, send).then(result => send({ type: "complete", result })).catch(error => {
          send({ type: "error", error: error instanceof PlanServiceError ? error.message : "Muse could not draft a layout. Your drawing is unchanged." });
        }).finally(() => { if (!cancelled.signal.aborted) controller.close(); });
      },
      cancel() { cancelled.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  }
  try {
    return Response.json(await designPlan(parsed.data, req.signal));
  } catch (error) {
    if (error instanceof PlanServiceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Muse could not draft a layout. Check the API configuration or retry; your drawing is unchanged." }, { status: 502 });
  }
}
