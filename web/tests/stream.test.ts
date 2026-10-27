import { createUIMessageStream, readUIMessageStream } from "ai";
import { describe, expect, it } from "vitest";
import recording from "@/fixtures/replay/sample-run.json";
import type { AgentEvent, AgentUIMessage } from "@/lib/agent/events";
import { recordSampleRun } from "@/lib/agent/recording";
import { asReplay, createEventEncoder } from "@/lib/agent/stream";

describe("replay fixture", () => {
  it("re-recording against the mock engine is deterministic", async () => {
    const [a, b] = [await recordSampleRun(), await recordSampleRun()];
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));
  });

  // A fixture recorded from the real engine can only be re-checked with the engine running.
  it.runIf((recording as { engine: string }).engine === "mock")("is genuine loop output (re-recording reproduces it exactly)", async () => {
    const fresh = await recordSampleRun();
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(recording);
  });
});

describe("UI message stream encoding", () => {
  it("round-trips events into typed data parts and a streamed report text part", async () => {
    const events = asReplay((recording as { events: AgentEvent[] }).events);
    const stream = createUIMessageStream<AgentUIMessage>({
      execute: ({ writer }) => {
        writer.write({ type: "start" });
        const emit = createEventEncoder(writer);
        for (const e of events) emit(e);
        emit.close();
        writer.write({ type: "finish" });
      },
    });
    let last: AgentUIMessage | undefined;
    for await (const m of readUIMessageStream<AgentUIMessage>({ stream })) last = m;
    expect(last).toBeDefined();
    const parts = last!.parts;
    const run = parts.find((p) => p.type === "data-run");
    expect(run?.type === "data-run" && run.data.mode).toBe("replay");
    // step parts are reconciled by id: every step ends up "done"
    const steps = parts.filter((p) => p.type === "data-step");
    expect(steps.length).toBeGreaterThan(5);
    expect(steps.every((p) => p.type === "data-step" && p.data.status === "done")).toBe(true);
    expect(parts.filter((p) => p.type === "data-sim")).toHaveLength(3);
    const text = parts.find((p) => p.type === "text");
    const report = parts.find((p) => p.type === "data-report");
    expect(text?.type === "text" && report?.type === "data-report" && text.text === report.data.markdown).toBe(true);
    expect(parts[parts.length - 1].type).toBe("data-done");
  });
});

describe("deriveRunState", () => {
  it("folds a replayed message into per-iteration views", async () => {
    const { deriveRunState } = await import("@/lib/ui/run-state");
    const events = asReplay((recording as { events: AgentEvent[] }).events);
    const stream = createUIMessageStream<AgentUIMessage>({
      execute: ({ writer }) => {
        writer.write({ type: "start" });
        const emit = createEventEncoder(writer);
        for (const e of events) emit(e);
        emit.close();
      },
    });
    let last: AgentUIMessage | undefined;
    for await (const m of readUIMessageStream<AgentUIMessage>({ stream })) last = m;
    const s = deriveRunState(last);
    expect(s.run?.mode).toBe("replay");
    expect(s.iterations.map((i) => i.iteration)).toEqual([0, 1, 2]);
    expect(s.iterations[0].revision?.applied.length).toBeGreaterThan(0);
    expect(s.iterations[1].layout?.moves.length).toBeGreaterThan(0);
    expect(s.done?.finalIteration).toBe(2);
    expect(s.reportText).toBe(s.report?.markdown);
  });
});
