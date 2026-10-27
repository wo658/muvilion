/**
 * Server-side Ask Muse flow, shared by POST /api/ask (plain text) and the `intent: "ask"` branch
 * of POST /api/chat (UI message stream).
 *
 * - `admitAsk`: validates an AskRequest and takes a rate-limit slot (ASK_RATE_LIMIT_PER_MIN).
 * - `answerAsk`: with LIVE_AGENT="on", AGENT_LLM not "stub" and a model key, the configured
 *   model writes the answer (streamText, ASK_MAX_OUTPUT_TOKENS, ASK_TIMEOUT_MS). The full answer
 *   is checked against the digest's numbers before it is released; any failure (error, timeout,
 *   number not in the digest) returns the deterministic stub answer instead. `by` says which.
 */
import { streamText } from "ai";
import { liveAgentEnabled } from "@/lib/agent/config";
import { getModel } from "@/lib/agent/model";
import type { StreamError } from "@/lib/agent/run-stream";
import type { Env } from "@/lib/env";
import { acquireAsk, ASK_SYSTEM, askAllowedNumbers, checkAnswer, stubAnswer } from "./answer";
import { AskRequest } from "./contract";

const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

export function admitAsk(body: unknown, env: Env = process.env): { ok: true; ask: AskRequest } | StreamError {
  const parsed = AskRequest.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "bad_request",
      message: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
    };
  }
  if (!acquireAsk(num(env.ASK_RATE_LIMIT_PER_MIN, 20))) {
    return { ok: false, status: 429, error: "rate_limited", message: "Too many questions right now; try again in a minute." };
  }
  return { ok: true, ask: parsed.data };
}

export type Answer = { text: string; by: string };

export async function answerAsk(ask: AskRequest, opts: { signal?: AbortSignal; env?: Env } = {}): Promise<Answer> {
  const env = opts.env ?? process.env;
  const fallback: Answer = { text: stubAnswer(ask), by: "stub" };
  const m = getModel(env);
  if (!liveAgentEnabled(env) || env.AGENT_LLM === "stub" || !m.hasKey) return fallback;

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
      abortSignal: opts.signal,
      onError: ({ error }) => {
        streamError = error;
      },
    });
    let text = "";
    for await (const delta of result.textStream) text += delta;
    if (streamError) throw streamError instanceof Error ? streamError : new Error(String(streamError));
    if (checkAnswer(text, askAllowedNumbers(ask))) return fallback;
    return { text: text.trim(), by: `${m.provider}:${m.modelId}` };
  } catch {
    return fallback;
  }
}

/** Word-sized pieces of an answer, so a validated answer can still be streamed out. */
export const answerChunks = (text: string): string[] => text.match(/\S+\s*/g) ?? [text];
