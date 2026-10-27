import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import indoorRec from "@/fixtures/replay/sample-hall.json";
import outdoorRec from "@/fixtures/replay/riverside-plaza.json";
import type { AgentEvent, AgentUIMessage, MuseMetadata } from "@/lib/agent/events";
import { buildRunDigest } from "@/lib/ask/digest";
import {
  askHistory,
  askUserMessage,
  chatRequestBody,
  createChatTransport,
  latestRunMessage,
  MAX_HISTORY,
  runUserMessage,
} from "@/lib/chat/transport";
import { approvalItems, approvalKey } from "@/lib/ui/approvals";
import { buildFeed, chatErrorInfo, runSays } from "@/lib/ui/feed";
import { venueById } from "@/lib/venues";

const eventsOf = (rec: unknown) => (rec as { events: AgentEvent[] }).events;

/** An assistant run message as the encoder would build it (data parts; the report as text). */
function runMessage(id: string, events: AgentEvent[], metadata: MuseMetadata | undefined = { kind: "run" }): AgentUIMessage {
  let seq = 0;
  const report = events.flatMap((e) => (e.type === "report-delta" ? [e.delta] : [])).join("");
  const parts = events.flatMap((e) =>
    e.type === "report-delta" ? [] : [{ type: `data-${e.type}`, id: e.type === "step" ? e.data.id : `${e.type}-${seq++}`, data: e.data }],
  ) as AgentUIMessage["parts"];
  if (report) parts.push({ type: "text", text: report });
  return { id, role: "assistant", metadata, parts };
}
const user = (id: string, m: { text: string; metadata: MuseMetadata }): AgentUIMessage => ({ id, role: "user", metadata: m.metadata, parts: [{ type: "text", text: m.text }] });
const answer = (id: string, text: string): AgentUIMessage => ({ id, role: "assistant", metadata: { kind: "answer", by: "stub" }, parts: [{ type: "text", text }] });

const indoor = eventsOf(indoorRec);
const outdoor = eventsOf(outdoorRec);

describe("chat transport request body", () => {
  it("a run sends only intent, mode and venue (plus the project for live runs)", () => {
    const msgs = [user("u1", runUserMessage("replay", "riverside-plaza"))];
    expect(msgs[0].parts[0]).toMatchObject({ text: "Show me an example for the Outdoor plaza" });
    expect(chatRequestBody("c1", msgs)).toEqual({ id: "c1", intent: "run", mode: "replay", venue: "riverside-plaza" });
    const live = chatRequestBody("c1", [user("u1", runUserMessage("live", "riverside-plaza"))]);
    expect(runUserMessage("live", "riverside-plaza").text).toBe("Plan the Outdoor plaza");
    expect(live).toMatchObject({ intent: "run", mode: "live", venue: "riverside-plaza", project: venueById("riverside-plaza")!.project });
  });

  it("a question sends its text, the run's digest and a short history, never the messages", () => {
    const msgs = [
      user("u1", runUserMessage("replay", "sample-hall")),
      runMessage("a1", indoor),
      user("u2", askUserMessage("What did you change?", "sample-hall", "a1")),
      answer("a2", "I moved two booths."),
      user("u3", askUserMessage("Is it safe?", "sample-hall", "a1")),
    ];
    const body = chatRequestBody("c1", msgs);
    expect(Object.keys(body).sort()).toEqual(["digest", "history", "id", "intent", "question", "venue"]);
    expect(body).toMatchObject({ intent: "ask", question: "Is it safe?", venue: "sample-hall" });
    expect(body.intent === "ask" && body.digest).toEqual(buildRunDigest(indoor));
    expect(body.intent === "ask" && body.history).toEqual([
      { role: "user", text: "What did you change?" },
      { role: "muse", text: "I moved two booths." },
    ]);
    expect(JSON.stringify(body)).not.toContain("data-layout");
  });

  it("asks about the chosen run, or the latest one", () => {
    const msgs = [runMessage("a1", outdoor), runMessage("a3", indoor), user("u", askUserMessage("Why?", "x", "a1"))];
    const body = chatRequestBody("c", msgs);
    expect(body.intent === "ask" && body.digest.venue.id).toBe("riverside-plaza");
    expect(latestRunMessage(msgs)?.id).toBe("a3");
    expect(latestRunMessage([...msgs, answer("a4", "Hi")])?.id).toBe("a3");
    expect(() => chatRequestBody("c", [user("u", askUserMessage("Why?", "x"))])).toThrow(/plan/);
  });

  it("keeps the history short", () => {
    const msgs: AgentUIMessage[] = [];
    for (let i = 0; i < 20; i++) msgs.push(user(`q${i}`, askUserMessage(`q${i} ${"x".repeat(3000)}`, "v")), answer(`r${i}`, `a${i}`));
    const h = askHistory(msgs, msgs.length);
    expect(h).toHaveLength(MAX_HISTORY);
    expect(h[h.length - 1]).toEqual({ role: "muse", text: "a19" });
    expect(h.every((t) => t.text.length <= 2000)).toBe(true);
  });

  it("the transport posts that body to /api/chat", async () => {
    let sent: { url: string; body: unknown } | undefined;
    const fetch = (async (url: string, init?: RequestInit) => {
      sent = { url, body: JSON.parse(String(init?.body)) };
      return new Response("data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    }) as typeof globalThis.fetch;
    const t = createChatTransport({ fetch });
    const msgs = [user("u1", runUserMessage("replay", "sample-hall"))];
    await t.sendMessages({ chatId: "c9", messages: msgs, trigger: "submit-message", messageId: undefined, abortSignal: undefined });
    expect(sent).toEqual({ url: "/api/chat", body: { id: "c9", intent: "run", mode: "replay", venue: "sample-hall" } });
  });
});

describe("feed from messages", () => {
  it("renders user bubbles, run says in order, the result card and answers", () => {
    const msgs = [user("u1", runUserMessage("replay", "sample-hall")), runMessage("a1", indoor), user("u2", askUserMessage("Why?", "sample-hall")), answer("a2", "Because.")];
    const feed = buildFeed(msgs, {});
    expect(feed[0]).toEqual({ kind: "user", id: "u1", text: "Show me an example for the Indoor hall" });
    const says = feed.filter((f) => f.kind === "say");
    const own = indoor.flatMap((e) => (e.type === "say" ? [e.data] : []));
    expect(says.map((f) => f.kind === "say" && f.say)).toEqual(own);
    expect(feed.map((f) => f.kind)).toEqual(["user", ...own.map(() => "say"), "result", "user", "answer"]);
    expect(feed[feed.length - 1]).toMatchObject({ kind: "answer", text: "Because.", by: "stub" });
  });

  it("no result card while the run message is still streaming", () => {
    const feed = buildFeed([runMessage("a1", indoor)], {}, { streamingId: "a1" });
    expect(feed.some((f) => f.kind === "result")).toBe(false);
  });

  it("falls back to synthesized says for recordings without them (and /api/agent messages without metadata)", () => {
    const m = runMessage("a1", indoor.filter((e) => e.type !== "say"), undefined);
    const feed = buildFeed([m], {});
    const says = feed.filter((f) => f.kind === "say");
    expect(says.length).toBeGreaterThan(3);
    expect(says.every((f) => f.kind === "say" && f.say.by === "ui-fallback")).toBe(true);
  });

  it("keys approvals by run message, so two runs of the same venue do not share a choice", () => {
    const msgs = [runMessage("r1", outdoor), runMessage("r2", outdoor)];
    const says = runSays(msgs[0]);
    const idx = says.findIndex((s) => s.needs_approval);
    expect(idx).toBeGreaterThanOrEqual(0);
    const key = approvalKey("r1", says[idx], idx);
    const feed = buildFeed(msgs, { [key]: "approved" });
    const approvalsInFeed = feed.filter((f) => f.kind === "say" && f.say.needs_approval);
    const choices = approvalsInFeed.map((f) => f.kind === "say" && `${f.messageId}:${f.choice}`);
    expect(choices.filter((c) => c === "r1:approved")).toHaveLength(1);
    expect(choices.filter((c) => typeof c === "string" && c.startsWith("r2:")).every((c) => c === "r2:null")).toBe(true);
    expect(approvalItems(says, { [key]: "approved" }, "r1")[0]).toMatchObject({ id: key, choice: "approved" });
    expect(approvalItems(says, { [key]: "approved" }, "r2")[0].choice).toBeNull();
  });
});

describe("chat errors", () => {
  const apiError = (status: number, body: object) =>
    new APICallError({ message: JSON.stringify(body), url: "/api/chat", requestBodyValues: undefined, statusCode: status, responseBody: JSON.stringify(body) });
  it("classifies 429s, the kill switch and other failures", () => {
    expect(chatErrorInfo(apiError(429, { error: "rate_limited", message: "Too many" }))).toEqual({ kind: "busy", message: "Too many" });
    expect(chatErrorInfo(apiError(403, { error: "live_disabled", message: "off" })).kind).toBe("live_disabled");
    expect(chatErrorInfo(new Error("engine down"))).toEqual({ kind: "other", message: "engine down" });
  });
});
