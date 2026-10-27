import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import outdoorRecording from "@/fixtures/replay/riverside-plaza.json";
import indoorRecording from "@/fixtures/replay/sample-hall.json";
import type { AgentEvent } from "@/lib/agent/events";
import { JARGON, numberTokens } from "@/lib/agent/narrate";
import { recordRun } from "@/lib/agent/recording";
import { askAllowedNumbers, checkAnswer, classifyQuestion, resetAskRateLimit, stubAnswer } from "@/lib/ask/answer";
import { RunDigest, type AskRequest } from "@/lib/ask/contract";
import { buildRunDigest } from "@/lib/ask/digest";
import { venueById } from "@/lib/venues";

const fixtures = {
  "sample-hall": (indoorRecording as { events: AgentEvent[] }).events,
  "riverside-plaza": (outdoorRecording as { events: AgentEvent[] }).events,
};

// The fake model the route uses when a test sets `modelReply`.
let modelReply: string | null = null;
vi.mock("@/lib/agent/model", () => ({
  getModel: () => ({
    provider: "fake",
    modelId: "muse",
    hasKey: modelReply !== null,
    model: new MockLanguageModelV3({
      doStream: async () => ({
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: "stream-start", warnings: [] });
            c.enqueue({ type: "text-start", id: "t" });
            for (const w of (modelReply ?? "").split(/(?<= )/)) c.enqueue({ type: "text-delta", id: "t", delta: w });
            c.enqueue({ type: "text-end", id: "t" });
            c.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
            });
            c.close();
          },
        }),
      }),
    }),
  }),
}));

describe.each(Object.keys(fixtures) as (keyof typeof fixtures)[])("buildRunDigest on the %s recording", (id) => {
  const events = fixtures[id];
  const d = buildRunDigest(events);

  it("is a valid RunDigest with one entry per layout and plain change descriptions", () => {
    expect(RunDigest.parse(d)).toEqual(d);
    expect(d.venue.id).toBe(id);
    const done = events.find((e) => e.type === "done");
    expect(d.iterations).toHaveLength(done?.type === "done" ? done.data.iterations : -1);
    expect(d.iterations[0].change).toBe("");
    expect(d.iterations[0].crowded_s_per_visitor).toBeGreaterThan(0);
    for (const it of d.iterations.slice(1)) {
      expect(it.change.length).toBeGreaterThan(10);
      for (const j of JARGON) expect(it.change).not.toMatch(j);
    }
    expect(d.iterations[0].crowded_near.length).toBeGreaterThan(0);
    expect(d.stop_reason).toBeTruthy();
    expect(d.final_iteration).not.toBeNull();
    expect(d.unknowns).toEqual(venueById(id)!.project.venue.unknowns);
    // the brief is Muse's plain sentence when the recording has narration
    const sayBrief = events.find((e) => e.type === "say" && e.data.moment === "brief");
    if (sayBrief?.type === "say") expect(d.brief).toBe(sayBrief.data.text);
  });

  it("needs no `say` events (older recordings) and works on a run still in progress", () => {
    const noSay = buildRunDigest(events.filter((e) => e.type !== "say"));
    expect(noSay.iterations).toEqual(d.iterations);
    const firstSim = events.findIndex((e) => e.type === "sim");
    const partial = buildRunDigest(events.slice(0, firstSim + 1));
    expect(partial.iterations).toHaveLength(1);
    expect(partial.stop_reason).toBeNull();
    expect(partial.final_iteration).toBeNull();
  });
});

describe("digest approvals", () => {
  it("lists organizer requests given up by the changes (outdoor plaza: the pinned food court)", async () => {
    const rec = await recordRun(venueById("riverside-plaza")!.project);
    // up to the first revision: the run is still going, so every change so far counts
    const i = rec.events.findIndex((e) => e.type === "revision");
    const d = buildRunDigest(rec.events.slice(0, i + 1));
    expect(d.approvals).toHaveLength(1);
    expect(d.approvals[0]).toMatch(/organizer/);
    expect(d.approvals[0]).toMatch(/F\d/);
    expect(buildRunDigest(fixtures["sample-hall"]).approvals).toEqual([]);
  });
});

const digest = () => buildRunDigest(fixtures["riverside-plaza"]);

describe("stub answers", () => {
  it.each([
    ["Can you summarize the result?", "summary"],
    ["What needs my approval?", "approval"],
    ["What's still unconfirmed?", "unknowns"],
    ["Is this layout safe?", "safety"],
    ["What if 500 visitors come?", "visitors"],
    ["Why did you move F3?", "moved"],
    ["What if we used the west gate instead?", "what_if"],
    ["hello", "default"],
  ])("%s → %s", (q, intent) => {
    expect(classifyQuestion(q)).toBe(intent);
    const req: AskRequest = { question: q, digest: digest(), history: [] };
    const a = stubAnswer(req);
    expect(a.length).toBeGreaterThan(20);
    expect(checkAnswer(a, askAllowedNumbers(req))).toBeNull();
    for (const j of JARGON) expect(a, a).not.toMatch(j);
  });

  it("grounds specific answers in the digest", () => {
    const d = digest();
    expect(stubAnswer({ question: "What's still unknown?", digest: d })).toMatch(/ground slope/);
    expect(stubAnswer({ question: "What if 500 people show up?", digest: d })).toMatch(new RegExp(`${d.scenario.agents} visitors.*500 visitors`));
    expect(stubAnswer({ question: "Is it safe?", digest: d })).toMatch(/qualified reviewer/);
    const moved = d.iterations.find((i) => i.change);
    if (moved) expect(stubAnswer({ question: "Why was anything changed?", digest: d })).toMatch(/I decided to/);
  });

  it("the numbers guard rejects numbers that are not in the digest", () => {
    const req = { question: "How did it go?", digest: digest(), history: [] };
    const allowed = askAllowedNumbers(req);
    const b = req.digest.iterations[0].crowded_s_per_visitor!;
    expect(checkAnswer(`It started at ${Math.round(b)} s per visitor.`, allowed)).toBeNull();
    expect(checkAnswer("It will handle 1234 visitors easily.", allowed)).toMatch(/1234/);
  });
});

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/ask/route");
  return POST(new Request("http://localhost/api/ask", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
};

describe("POST /api/ask", () => {
  beforeEach(() => {
    resetAskRateLimit();
    modelReply = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("answers from the digest as a plain text stream (stub when LIVE_AGENT is off)", async () => {
    vi.stubEnv("LIVE_AGENT", "off");
    modelReply = "This must not be used.";
    const res = await post({ question: "What needs my approval?", digest: digest(), history: [] });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    expect(res.headers.get("x-ask-by")).toBe("stub");
    expect(await res.text()).toBe(stubAnswer({ question: "What needs my approval?", digest: digest() }));
  });

  it("falls back to a graceful default for anything else", async () => {
    const text = await (await post({ question: "Tell me something nice", digest: digest() })).text();
    expect(text).toMatch(/You can also ask me/);
  });

  it("rejects bad requests", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ digest: digest() })).status).toBe(400);
    expect((await post({ question: "", digest: digest() })).status).toBe(400);
    expect((await post({ question: "x".repeat(501), digest: digest() })).status).toBe(400);
    const bad = await post({ question: "Hi", digest: { ...digest(), venue: { id: "x" } } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).message).toMatch(/digest\.venue/);
  });

  it("rate-limits per instance", async () => {
    vi.stubEnv("ASK_RATE_LIMIT_PER_MIN", "2");
    const q = { question: "Summary?", digest: digest() };
    expect((await post(q)).status).toBe(200);
    expect((await post(q)).status).toBe(200);
    expect((await post(q)).status).toBe(429);
  });

  it("with the model on: streams a grounded model answer, and replaces one with an invented number", async () => {
    vi.stubEnv("LIVE_AGENT", "on");
    vi.stubEnv("AGENT_LLM", "");
    const d = digest();
    const agents = d.scenario.agents;
    modelReply = `I tested it with ${agents} visitors. It looks good.`;
    let res = await post({ question: "How did it go?", digest: d });
    expect(res.headers.get("x-ask-by")).toBe("fake:muse");
    expect(await res.text()).toBe(modelReply);

    modelReply = "It would easily handle 1234 visitors.";
    res = await post({ question: "How did it go?", digest: d });
    expect(res.headers.get("x-ask-by")).toBe("stub");
    const text = await res.text();
    expect(text).toBe(stubAnswer({ question: "How did it go?", digest: d }));
    expect(numberTokens(text)).not.toContain("1234");
  });
});
