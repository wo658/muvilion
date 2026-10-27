/**
 * Client for "Ask Muse": POST /api/ask (lib/ask/contract.ts) and stream the plain-text answer.
 * A 404 means the endpoint is not on this server yet; the view shows a friendly note instead.
 */
import type { AskRequest } from "@/lib/ask/contract";

export type AskTurn = { role: "user" | "muse"; text: string };
export type AskResult =
  | { status: "ok"; text: string; by: string | null }
  | { status: "unavailable" }
  | { status: "busy" }
  | { status: "error"; message: string; text: string };

export const MAX_HISTORY = 12;
const MAX_TURN = 2000;

/** The short history sent with a question: last MAX_HISTORY non-empty turns, each capped. */
export function trimHistory(turns: AskTurn[]): AskRequest["history"] {
  return turns
    .filter((t) => t.text.trim())
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_TURN) }));
}

export async function askMuse(
  request: AskRequest,
  onText: (textSoFar: string) => void,
  opts: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<AskResult> {
  const f = opts.fetch ?? fetch;
  let text = "";
  try {
    const res = await f("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: opts.signal,
    });
    if (res.status === 404) return { status: "unavailable" };
    if (res.status === 429) return { status: "busy" };
    const by = res.headers.get("x-ask-by");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { status: "error", message: body?.message ?? `HTTP ${res.status}`, text };
    }
    if (!res.body) {
      text = await res.text();
      onText(text);
      return { status: "ok", text, by };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onText(text);
    }
    text += decoder.decode();
    onText(text);
    return { status: "ok", text, by };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e), text };
  }
}
