/**
 * Client side of the simple view's single conversation (runs + questions on POST /api/chat).
 *
 * The user message says what it wants in its metadata (`intent`, `mode`, `venue`, `runMessageId`),
 * so `regenerate()` resends the same request. `chatRequestBody` (the transport's
 * `prepareSendMessagesRequest`) turns the conversation into a small ChatRequest: a run sends the
 * venue (and the project for live runs); a question sends its text, a digest of the run it is
 * about (built here with `buildRunDigest`) and a short text history of earlier questions. It never
 * sends the message list itself.
 */
import { DefaultChatTransport } from "ai";
import type { AgentUIMessage, MuseMetadata } from "@/lib/agent/events";
import type { AskRequest } from "@/lib/ask/contract";
import { buildRunDigest } from "@/lib/ask/digest";
import { eventsFromMessage } from "@/lib/ui/message-events";
import { runRequestBody, venueById } from "@/lib/venues";
import type { ChatBody } from "./contract";

export const MAX_HISTORY = 12;
const MAX_TURN = 2000;

export const textOf = (m: AgentUIMessage) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");

/** An assistant message that streamed a planning run (has a `data-run` part, or says so). */
export const isRunMessage = (m: AgentUIMessage) =>
  m.role === "assistant" && (m.metadata?.kind === "run" || (m.metadata?.kind !== "answer" && m.parts.some((p) => p.type === "data-run")));

/** An assistant message that answers a question. */
export const isAnswerMessage = (m: AgentUIMessage) => m.role === "assistant" && m.metadata?.kind === "answer";

/** The latest run message (with its run info), or the one with `id` when given and present. */
export function latestRunMessage(messages: AgentUIMessage[], id?: string | null): AgentUIMessage | undefined {
  if (id) {
    const m = messages.find((x) => x.id === id && isRunMessage(x));
    if (m) return m;
  }
  for (let i = messages.length - 1; i >= 0; i--) if (isRunMessage(messages[i])) return messages[i];
  return undefined;
}

/** The user message that starts a run ("Plan the Outdoor plaza" / "Show me an example for …"). */
export function runUserMessage(mode: "live" | "replay", venueId: string): { text: string; metadata: MuseMetadata } {
  const v = venueById(venueId);
  if (!v) throw new Error(`unknown venue ${venueId}`);
  return {
    text: mode === "live" ? `Plan the ${v.label}` : `Show me an example for the ${v.label}`,
    metadata: { intent: "run", mode, venue: v.id },
  };
}

/** The user message that asks Muse a question about a run. */
export function askUserMessage(question: string, venueId: string, runMessageId?: string): { text: string; metadata: MuseMetadata } {
  return { text: question, metadata: { intent: "ask", venue: venueId, ...(runMessageId ? { runMessageId } : {}) } };
}

/** Earlier question/answer turns before `uptoIndex`, oldest first, trimmed for the request. */
export function askHistory(messages: AgentUIMessage[], uptoIndex: number): AskRequest["history"] {
  const turns: AskRequest["history"] = [];
  for (let i = 0; i < uptoIndex; i++) {
    const m = messages[i];
    const isAsk = m.role === "user" && m.metadata?.intent === "ask";
    if (!isAsk && !isAnswerMessage(m)) continue;
    const text = textOf(m).trim();
    if (text) turns.push({ role: m.role === "user" ? "user" : "muse", text: text.slice(0, MAX_TURN) });
  }
  return turns.slice(-MAX_HISTORY);
}

/** The /api/chat body for the last user message of the conversation. */
export function chatRequestBody(id: string, messages: AgentUIMessage[], extra: { speed?: number } = {}): ChatBody {
  let idx = messages.length - 1;
  while (idx >= 0 && messages[idx].role !== "user") idx--;
  const user = messages[idx];
  if (!user) throw new Error("no user message to send");
  const meta = user.metadata ?? {};
  const venue = meta.venue ?? "";
  if (meta.intent === "run") {
    const run = runRequestBody(meta.mode ?? "replay", venue);
    return { id, intent: "run", ...run, ...(extra.speed !== undefined ? { speed: extra.speed } : {}) };
  }
  const started = messages.slice(0, idx).filter((m) => m.parts.some((p) => p.type === "data-run"));
  const runMsg = latestRunMessage(started, meta.runMessageId);
  if (!runMsg) throw new Error("I need a plan before I can answer questions about it.");
  return {
    id,
    intent: "ask",
    venue,
    question: textOf(user),
    digest: buildRunDigest(eventsFromMessage(runMsg)),
    history: askHistory(messages, idx),
  };
}

export function createChatTransport(opts: { api?: string; fetch?: typeof fetch } = {}) {
  return new DefaultChatTransport<AgentUIMessage>({
    api: opts.api ?? "/api/chat",
    fetch: opts.fetch,
    prepareSendMessagesRequest: ({ id, messages, body }) => ({
      body: chatRequestBody(id, messages, { speed: typeof body?.speed === "number" ? body.speed : undefined }),
    }),
  });
}
