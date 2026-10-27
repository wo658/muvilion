/**
 * Ask Muse (plain text). SUPERSEDED by POST /api/chat with `intent: "ask"`, which the simple
 * view uses (one conversation for runs and questions). Kept as a thin wrapper over the same
 * functions for scripts and tests.
 *
 *   POST /api/ask  body: AskRequest {question, digest, history}  →  text/plain stream (the answer)
 *
 * The answer comes from the digest only (lib/ask/respond.ts: model + numbers guard, or the
 * deterministic answer). Header `x-ask-by` says which one answered. The request body is limited
 * to 64 KB.
 */
import { errorResponse } from "@/lib/agent/run-stream";
import { admitAsk, answerAsk, answerChunks } from "@/lib/ask/respond";

export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;

function textStream(text: string, by: string): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of answerChunks(text)) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ask-by": by } });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "too_large", message: "request body over 64 KB" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_request", message: "body must be JSON" }, { status: 400 });
  }
  const admitted = admitAsk(body);
  if (!admitted.ok) return errorResponse(admitted);
  const answer = await answerAsk(admitted.ask, { signal: req.signal });
  return textStream(answer.text, answer.by);
}
