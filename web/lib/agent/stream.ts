/**
 * AgentEvent → AI SDK UI message stream encoding, shared by live runs and replay.
 *
 * - every event except `report-delta` becomes a typed data part `data-<type>`;
 *   `data-step` uses the step id so "running" is reconciled into "done" client-side;
 * - `report-delta` becomes text-start/text-delta/text-end chunks (id "report"),
 *   so the report renders progressively as a normal text part.
 */
import type { UIMessageStreamWriter } from "ai";
import type { AgentEvent, AgentUIMessage } from "./events";

export type Recording = {
  version: 1;
  generator: string;
  recordedAt: string;
  engine: "mock" | "http";
  llm: string;
  events: AgentEvent[];
};

export function createEventEncoder(writer: UIMessageStreamWriter<AgentUIMessage>) {
  let textOpen = false;
  let seq = 0;
  const closeText = () => {
    if (textOpen) {
      writer.write({ type: "text-end", id: "report" });
      textOpen = false;
    }
  };
  const emit = (e: AgentEvent) => {
    if (e.type === "report-delta") {
      if (!textOpen) {
        writer.write({ type: "text-start", id: "report" });
        textOpen = true;
      }
      writer.write({ type: "text-delta", id: "report", delta: e.delta });
      return;
    }
    closeText();
    const id = e.type === "step" ? e.data.id : `${e.type}-${seq++}`;
    // `e` is a discriminated union whose `type` maps 1:1 onto a data part name.
    writer.write({ type: `data-${e.type}`, id, data: e.data } as Parameters<typeof writer.write>[0]);
  };
  return Object.assign(emit, { close: closeText });
}

/** Pacing for replay so the timeline visibly streams; `speed` 0 disables delays. */
export function replayDelayMs(e: AgentEvent, speed: number): number {
  if (speed <= 0) return 0;
  const base =
    e.type === "report-delta" ? 12 : e.type === "step" ? (e.data.status === "running" ? 260 : 60) : e.type === "sim" ? 120 : 90;
  return Math.round(base / speed);
}

export function asReplay(events: AgentEvent[]): AgentEvent[] {
  return events.map((e) => (e.type === "run" ? { ...e, data: { ...e.data, mode: "replay" as const } } : e));
}
