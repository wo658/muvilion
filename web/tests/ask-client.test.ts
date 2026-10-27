import { describe, expect, it } from "vitest";
import type { AskRequest } from "@/lib/ask/contract";
import { askMuse, MAX_HISTORY, trimHistory } from "@/lib/ui/ask-client";

const req = { question: "Why?", digest: {} as AskRequest["digest"], history: [] } satisfies AskRequest;

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe("ask client", () => {
  it("reports 'unavailable' on 404", async () => {
    const f = (async () => new Response("not found", { status: 404 })) as typeof fetch;
    expect(await askMuse(req, () => {}, { fetch: f })).toEqual({ status: "unavailable" });
  });
  it("streams the answer, appending chunks", async () => {
    const seen: string[] = [];
    let sent: unknown;
    const f = (async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(streamOf(["Because ", "the food ", "court crowds."]), { status: 200 });
    }) as typeof fetch;
    const res = await askMuse(req, (t) => seen.push(t), { fetch: f });
    expect(res).toEqual({ status: "ok", text: "Because the food court crowds.", by: null });
    expect(seen.slice(0, 3)).toEqual(["Because ", "Because the food ", "Because the food court crowds."]);
    expect(sent).toMatchObject({ question: "Why?" });
  });
  it("reports 'busy' on 429 and reads the x-ask-by header", async () => {
    const limited = (async () => Response.json({ message: "rate" }, { status: 429 })) as typeof fetch;
    expect(await askMuse(req, () => {}, { fetch: limited })).toEqual({ status: "busy" });
    const ok = (async () => new Response("Yes.", { status: 200, headers: { "x-ask-by": "stub" } })) as typeof fetch;
    expect(await askMuse(req, () => {}, { fetch: ok })).toEqual({ status: "ok", text: "Yes.", by: "stub" });
  });
  it("returns errors with the server message", async () => {
    const f = (async () => Response.json({ message: "bad question" }, { status: 400 })) as typeof fetch;
    expect(await askMuse(req, () => {}, { fetch: f })).toMatchObject({ status: "error", message: "bad question" });
    const boom = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await askMuse(req, () => {}, { fetch: boom })).toMatchObject({ status: "error", message: "offline" });
  });
  it("keeps the history short", () => {
    const turns = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? ("muse" as const) : ("user" as const), text: `t${i}` }));
    const h = trimHistory([...turns, { role: "muse", text: "  " }, { role: "user", text: "x".repeat(3000) }]);
    expect(h).toHaveLength(MAX_HISTORY);
    expect(h.at(-1)!.text).toHaveLength(2000);
  });
});
