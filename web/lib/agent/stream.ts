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

/** Time the console spends on the empty site → placed layout animation (components/placement). */
export const PLACEMENT_PAUSE_MS = 4200;

/**
 * Pacing for replay so the timeline visibly streams; `speed` 0 disables delays. `prev` is the
 * event just sent: the stream lingers on the empty site while the brief is written and after the
 * first layout so the placement animation plays before the simulation results arrive.
 */
export function replayDelayMs(e: AgentEvent, speed: number, prev?: AgentEvent): number {
  if (speed <= 0) return 0;
  let base =
    e.type === "report-delta" ? 12 : e.type === "step" ? (e.data.status === "running" ? 260 : 60) : e.type === "sim" ? 120 : 90;
  if (e.type === "step" && e.data.step === "brief" && e.data.status === "done") base = 1400;
  if (prev?.type === "layout" && prev.data.iteration === 0 && prev.data.attempt === 0 && prev.data.response.steps.length > 0) base = PLACEMENT_PAUSE_MS;
  return Math.round(base / speed);
}

export function asReplay(events: AgentEvent[]): AgentEvent[] {
  return events.map((e) => (e.type === "run" ? { ...e, data: { ...e.data, mode: "replay" as const } } : e));
}
