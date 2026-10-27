/**
 * The Muse feed, straight from the conversation's messages (pure, so it is unit-tested):
 *   user message    → a small user bubble with its text;
 *   run message     → its Muse messages in order (`data-say` parts, or the fallback for
 *                     recordings without them), then a result card once the run completed;
 *   answer message  → one Muse bubble with the answer text (growing while it streams).
 * Approvals are keyed by run message id + say id (approvalKey), so two runs never share one.
 */
import type { AgentUIMessage, SayInfo } from "@/lib/agent/events";
import { isAnswerMessage, isRunMessage, textOf } from "@/lib/chat/transport";
import { approvalKey, type ApprovalChoice, type ApprovalState } from "./approvals";
import { museMessages } from "./fallback-say";
import { eventsFromMessage } from "./message-events";

export type FeedItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "say"; id: string; messageId: string; say: SayInfo; choice: ApprovalChoice | null }
  | { kind: "answer"; id: string; messageId: string; text: string; by?: string }
  | { kind: "result"; id: string; messageId: string };

/** Muse's messages of one run message (its own `say` parts, or the fallback). */
export const runSays = (m: AgentUIMessage | undefined): SayInfo[] => (m ? museMessages(eventsFromMessage(m)) : []);

export function buildFeed(messages: AgentUIMessage[], approvals: ApprovalState, opts: { streamingId?: string } = {}): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const text = textOf(m);
      if (text) out.push({ kind: "user", id: m.id, text });
    } else if (isRunMessage(m)) {
      runSays(m).forEach((say, i) => {
        const id = approvalKey(m.id, say, i);
        out.push({ kind: "say", id, messageId: m.id, say, choice: say.needs_approval ? (approvals[id] ?? null) : null });
      });
      const done = m.parts.find((p) => p.type === "data-done");
      if (done?.type === "data-done" && done.data.status === "completed" && opts.streamingId !== m.id) {
        out.push({ kind: "result", id: `${m.id}/result`, messageId: m.id });
      }
    } else if (isAnswerMessage(m)) {
      const text = textOf(m);
      if (text) out.push({ kind: "answer", id: m.id, messageId: m.id, text, by: m.metadata?.by });
    }
  }
  return out;
}

export type ChatErrorInfo = { kind: "busy" | "live_disabled" | "other"; message: string };

/**
 * What went wrong, from `useChat`'s `error`: a rejected request is an APICallError whose message
 * is the JSON body `{ error, message }` (statusCode on the error); a failure inside the stream is
 * a plain Error with the stream's error text.
 */
export function chatErrorInfo(error: Error): ChatErrorInfo {
  const status = (error as { statusCode?: number }).statusCode;
  let code: string | undefined;
  let message = error.message;
  try {
    const body = JSON.parse(error.message) as { error?: string; message?: string };
    code = body.error;
    if (body.message) message = body.message;
  } catch {
    // not a JSON error body
  }
  if (status === 429 || code === "rate_limited" || code === "cap_reached") return { kind: "busy", message };
  if (status === 403 || code === "live_disabled") return { kind: "live_disabled", message };
  return { kind: "other", message };
}
