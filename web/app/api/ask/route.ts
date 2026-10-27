/**
 * Ask Muse.
 *   POST /api/ask  body: AskRequest {question, digest, history}  →  text/plain stream (the answer)
 *
 * The answer comes from the digest only (lib/ask/answer.ts). With LIVE_AGENT="on", AGENT_LLM not
 * "stub" and a model key, the configured Meta model writes it (streamText); the full answer is
 * checked against the digest's numbers before it is streamed out, and any failure (error,
 * timeout, number not in the digest) sends the deterministic answer instead. Otherwise the
 * deterministic answer is sent directly. Header `x-ask-by` says which one answered.
 *
 * Caps: ASK_MAX_OUTPUT_TOKENS per answer, ASK_RATE_LIMIT_PER_MIN per server instance,
 * ASK_TIMEOUT_MS per model call; the request body is limited to 64 KB.
 */
import { streamText } from "ai";
import { liveAgentEnabled } from "@/lib/agent/config";
import { getModel } from "@/lib/agent/model";
import { acquireAsk, ASK_SYSTEM, askAllowedNumbers, checkAnswer, stubAnswer } from "@/lib/ask/answer";
import { AskRequest } from "@/lib/ask/contract";

export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;

function textStream(text: string, by: string): Response {
  const chunks = text.match(/\S+\s*/g) ?? [text];
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ask-by": by } });
}

const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

export async function POST(req: Request) {
  const env = process.env;
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "too_large", message: "request body over 64 KB" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_request", message: "body must be JSON" }, { status: 400 });
  }
  const parsed = AskRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "bad_request", message: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  if (!acquireAsk(num(env.ASK_RATE_LIMIT_PER_MIN, 20))) {
    return Response.json({ error: "rate_limited", message: "Too many questions right now; try again in a minute." }, { status: 429 });
  }

  const ask = parsed.data;
  const fallback = stubAnswer(ask);
  const m = getModel(env);
  if (!liveAgentEnabled(env) || env.AGENT_LLM === "stub" || !m.hasKey) return textStream(fallback, "stub");

  const name = `${m.provider}:${m.modelId}`;
  try {
    let streamError: unknown = null;
    const result = streamText({
      model: m.model,
      instructions: `${ASK_SYSTEM}\n\nDigest:\n${JSON.stringify(ask.digest)}`,
      messages: [
        ...ask.history.map((h) => ({ role: h.role === "user" ? ("user" as const) : ("assistant" as const), content: h.text })),
        { role: "user" as const, content: ask.question },
      ],
      maxOutputTokens: Math.max(64, num(env.ASK_MAX_OUTPUT_TOKENS, 400)),
      temperature: 0.3,
      maxRetries: 1,
      timeout: num(env.ASK_TIMEOUT_MS, 20_000),
      abortSignal: req.signal,
      onError: ({ error }) => {
        streamError = error;
      },
    });
    let text = "";
    for await (const delta of result.textStream) text += delta;
    if (streamError) throw streamError instanceof Error ? streamError : new Error(String(streamError));
    const why = checkAnswer(text, askAllowedNumbers(ask));
    if (why) return textStream(fallback, "stub");
    return textStream(text.trim(), name);
  } catch {
    return textStream(fallback, "stub");
  }
}
