/**
 * Turns the parts of one streamed assistant message back into the AgentEvent list the agent loop
 * emitted (data-<type> parts → events, text parts → one report-delta). The simple view derives
 * everything (Muse messages, the run digest for Ask Muse) from this list, so live runs and replays
 * are handled the same way.
 */
import type { AgentDataParts, AgentEvent, AgentUIMessage } from "@/lib/agent/events";

export function eventsFromMessage(message: AgentUIMessage | undefined): AgentEvent[] {
  if (!message) return [];
  const out: AgentEvent[] = [];
  for (const p of message.parts) {
    if (p.type === "text") {
      if (p.text) out.push({ type: "report-delta", delta: p.text });
      continue;
    }
    if (p.type.startsWith("data-")) {
      const type = p.type.slice(5) as keyof AgentDataParts;
      out.push({ type, data: (p as { data: unknown }).data } as AgentEvent);
    }
  }
  return out;
}
