/**
 * The simple view's conversation endpoint: planning runs and follow-up questions to Muse.
 *   POST /api/chat[?speed=1]  body: ChatRequest (lib/chat/contract.ts)  →  AI SDK UI message stream
 *
 * - intent "run": the same stream as POST /api/agent (lib/agent/run-stream.ts: replay pacing,
 *   live-run caps, the LIVE_AGENT kill switch), with `start` message metadata
 *   `{ kind: "run", mode, venue }`.
 * - intent "ask": the answer from lib/ask/respond.ts (model + numbers guard, or the deterministic
 *   answer). The guard checks the whole answer before release, so the validated text is then
 *   streamed as one text part in word-sized deltas (ASK_STREAM_CHUNK_MS apart, default 18), with
 *   message metadata `{ kind: "answer", by: "stub" | "<provider>:<model>" }`.
 *
 * Rejected requests (400 validation, 403 kill switch, 404, 413, 429 caps) are JSON error
 * responses `{ error, message }`; failures inside a stream become `error` chunks.
 */
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { AgentUIMessage } from "@/lib/agent/events";
import { errorResponse, startRunStream } from "@/lib/agent/run-stream";
import { admitAsk, answerAsk, answerChunks } from "@/lib/ask/respond";
import { ChatRequest } from "@/lib/chat/contract";

export const maxDuration = 300;

const MAX_BODY_BYTES = 128 * 1024;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

const bad = (message: string, status = 400, error = "bad_request") => Response.json({ error, message }, { status });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return bad("request body over 128 KB", 413, "too_large");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return bad("body must be JSON");
  }
  const parsed = ChatRequest.safeParse(json);
  if (!parsed.success) return bad(parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  const body = parsed.data;

  if (body.intent === "run") {
    const speed = new URL(req.url).searchParams.get("speed");
    const run = startRunStream(
      { mode: body.mode, speed: speed !== null ? Number(speed) : body.speed, venue: body.venue, project: body.project },
      { signal: req.signal, startMetadata: { kind: "run", venue: body.venue } },
    );
    if (!run.ok) return errorResponse(run);
    return createUIMessageStreamResponse({ stream: run.stream, headers: { "x-agent-mode": run.mode } });
  }

  const admitted = admitAsk({ question: body.question, digest: body.digest, history: body.history });
  if (!admitted.ok) return errorResponse(admitted);
  const chunkMs = Number(process.env.ASK_STREAM_CHUNK_MS ?? 18);
  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageMetadata: { kind: "answer" } });
      const answer = await answerAsk(admitted.ask, { signal: req.signal });
      writer.write({ type: "message-metadata", messageMetadata: { kind: "answer", by: answer.by } });
      writer.write({ type: "text-start", id: "answer" });
      for (const delta of answerChunks(answer.text)) {
        if (req.signal.aborted) break;
        writer.write({ type: "text-delta", id: "answer", delta });
        await sleep(Number.isFinite(chunkMs) ? chunkMs : 0, req.signal);
      }
      writer.write({ type: "text-end", id: "answer" });
      writer.write({ type: "finish" });
    },
    onError: (err) => (err instanceof Error ? err.message : String(err)),
  });
  return createUIMessageStreamResponse({ stream });
}
