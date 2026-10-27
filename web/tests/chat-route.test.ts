import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema, type UIMessageChunk } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import indoorRecording from "@/fixtures/replay/sample-hall.json";
import type { AgentEvent, AgentUIMessage } from "@/lib/agent/events";
import { stubAnswer, resetAskRateLimit } from "@/lib/ask/answer";
import { buildRunDigest } from "@/lib/ask/digest";

const digest = () => buildRunDigest((indoorRecording as { events: AgentEvent[] }).events);

function chunksOf(res: Response): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({ stream: res.body!, schema: uiMessageChunkSchema }).pipeThrough(
    new TransformStream({ transform: (c, ctl) => (c.success ? ctl.enqueue(c.value as UIMessageChunk) : undefined) }),
  );
}

async function lastMessage(res: Response): Promise<AgentUIMessage | undefined> {
  let last: AgentUIMessage | undefined;
  for await (const m of readUIMessageStream<AgentUIMessage>({ stream: chunksOf(res) as never })) last = m;
  return last;
}

const post = async (body: unknown, query = "") => {
  const { POST } = await import("@/app/api/chat/route");
  return POST(new Request(`http://localhost/api/chat${query}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
};

describe("POST /api/chat", () => {
  beforeEach(() => {
    resetAskRateLimit();
    vi.stubEnv("ASK_STREAM_CHUNK_MS", "0");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("intent run (replay): the same parts as /api/agent, plus run metadata", async () => {
    const res = await post({ id: "c1", intent: "run", mode: "replay", venue: "sample-hall", speed: 0 });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-agent-mode")).toBe("replay");
    const m = await lastMessage(res);
    expect(m?.metadata).toEqual({ kind: "run", venue: "sample-hall", mode: "replay" });
    expect(m?.parts.some((p) => p.type === "data-run")).toBe(true);
    expect(m?.parts.filter((p) => p.type === "data-say").length).toBeGreaterThan(0);

    const { POST } = await import("@/app/api/agent/route");
    const agent = await lastMessage(await POST(new Request("http://localhost/api/agent?speed=0", { method: "POST", body: JSON.stringify({ mode: "replay", venue: "sample-hall" }) })));
    expect(agent?.metadata).toBeUndefined();
    expect(m?.parts).toEqual(agent?.parts);
  });

  it("intent ask: the stub answer as streamed text parts with answer metadata", async () => {
    vi.stubEnv("LIVE_AGENT", "off");
    const q = "What needs my approval?";
    const res = await post({ id: "c1", intent: "ask", venue: "sample-hall", question: q, digest: digest(), history: [] });
    expect(res.status).toBe(200);
    const chunks: UIMessageChunk[] = [];
    for await (const c of chunksOf(res.clone()) as unknown as AsyncIterable<UIMessageChunk>) chunks.push(c);
    expect(chunks.filter((c) => c.type === "text-delta").length).toBeGreaterThan(1);
    expect(chunks.some((c) => c.type === "message-metadata")).toBe(true);
    const m = await lastMessage(res);
    const text = m?.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
    expect(text).toBe(stubAnswer({ question: q, digest: digest() }));
    expect(m?.metadata).toEqual({ kind: "answer", by: "stub" });
  });

  it("rejects bad requests with 400", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ intent: "dance", venue: "sample-hall" })).status).toBe(400);
    expect((await post({ intent: "run", venue: "nowhere", mode: "replay" })).status).toBe(400);
    const res = await post({ intent: "ask", venue: "sample-hall", question: "", digest: digest() });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
    expect((await post({ intent: "ask", venue: "sample-hall", question: "Hi", digest: { venue: { id: "x" } } })).status).toBe(400);
  });

  it("rate-limits questions with 429", async () => {
    vi.stubEnv("ASK_RATE_LIMIT_PER_MIN", "1");
    const q = { intent: "ask", venue: "sample-hall", question: "Summary?", digest: digest() };
    expect((await post(q)).status).toBe(200);
    const res = await post(q);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("live runs honor the kill switch (403) and the live-run caps (429)", async () => {
    vi.stubEnv("LIVE_AGENT", "off");
    const off = await post({ intent: "run", mode: "live", venue: "sample-hall" });
    expect(off.status).toBe(403);
    expect((await off.json()).error).toBe("live_disabled");

    vi.stubEnv("LIVE_AGENT", "on");
    vi.stubEnv("AGENT_DAILY_RUN_CAP", "0");
    const capped = await post({ intent: "run", mode: "live", venue: "sample-hall" });
    expect(capped.status).toBe(429);
    expect((await capped.json()).error).toBe("cap_reached");
  });

  it("a live run streams the loop with run metadata", async () => {
    vi.stubEnv("LIVE_AGENT", "on");
    vi.stubEnv("ENGINE_MOCK", "1");
    vi.stubEnv("AGENT_LLM", "stub");
    vi.stubEnv("AGENT_MAX_ITERATIONS", "0");
    const res = await post({ intent: "run", mode: "live", venue: "riverside-plaza" });
    expect(res.headers.get("x-agent-mode")).toBe("live");
    const m = await lastMessage(res);
    expect(m?.metadata).toMatchObject({ kind: "run", mode: "live" });
    expect(m?.parts.some((p) => p.type === "data-done")).toBe(true);
  });
});
