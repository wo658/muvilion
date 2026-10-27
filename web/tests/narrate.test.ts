import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { loadAgentConfig } from "@/lib/agent/config";
import type { AgentEvent, SayInfo, SayMoment } from "@/lib/agent/events";
import { withCallCap, withFallback, type AgentLLM } from "@/lib/agent/llm";
import { createModelLLM } from "@/lib/agent/llm-model";
import { createStubLLM } from "@/lib/agent/llm-stub";
import { runAgentLoop } from "@/lib/agent/loop";
import { allowedNumbers, checkSay, fill, JARGON, numberTokens, resolveLine, type NarrationLine } from "@/lib/agent/narrate";
import { MOCK_RECORDING_ENV } from "@/lib/agent/recording";
import type { Engine } from "@/lib/engine/client";
import { createMockEngine } from "@/lib/engine/mock";
import { VENUES } from "@/lib/venues";

const MOMENTS: SayMoment[] = ["intro", "brief", "placed", "simulated", "revising", "revised", "result", "caution"];

async function run(venueId: string, llm: AgentLLM = createStubLLM(), engine: Engine = createMockEngine()) {
  const events: AgentEvent[] = [];
  const v = VENUES.find((x) => x.id === venueId)!;
  const result = await runAgentLoop({
    project: structuredClone(v.project),
    engine,
    llm,
    config: loadAgentConfig(MOCK_RECORDING_ENV),
    runId: `t-${venueId}`,
    emit: (e) => events.push(e),
    now: () => new Date(0),
  });
  return { events, result, says: events.flatMap((e) => (e.type === "say" ? [e.data] : [])) };
}

/** Every number a `say` may contain: numbers of the other events (rounded as people read them) and crowding changes. */
function numbersOfRun(events: AgentEvent[]): Set<string> {
  const set = new Set<string>();
  const add = (n: number) => {
    for (const d of [0, 1, 2]) set.add(String(Number(n.toFixed(d))));
  };
  const crowded: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number") add(v);
    else if (typeof v === "string") numberTokens(v).forEach((t) => set.add(t));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  for (const e of events) {
    if (e.type === "say" || e.type === "report-delta") continue;
    walk(e.data);
    if (e.type === "sim") crowded.push(e.data.metrics.crowded_s_per_visitor);
  }
  for (const a of crowded) for (const b of crowded) if (a > 0) add(((a - b) / a) * 100);
  return set;
}

/** A model whose narrate tool call rewrites every draft with `rewrite`. */
function fakeNarrationModel(rewrite: (draft: string) => string) {
  return new MockLanguageModelV3({
    doGenerate: async (options) => {
      const user = options.prompt.find((m) => m.role === "user");
      const text = user && Array.isArray(user.content) ? user.content.map((p) => (p.type === "text" ? p.text : "")).join("") : "";
      const lines = JSON.parse(text.split("\n\n")[1]) as { draft: string }[];
      return {
        content: [
          {
            type: "tool-call",
            toolCallId: "c1",
            toolName: "write_messages",
            input: JSON.stringify({ messages: lines.map((l) => ({ text: rewrite(l.draft) })) }),
          },
        ],
        finishReason: { unified: "tool-calls", raw: "tool_calls" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}

/** Stub decisions, model-path narration (createModelLLM over a fake model). */
function withModelNarration(rewrite: (draft: string) => string): AgentLLM {
  const model = createModelLLM(fakeNarrationModel(rewrite), "fake:muse");
  return { ...createStubLLM(), name: "fake:muse", narrate: (i) => model.narrate(i) };
}

describe("narration guard", () => {
  const line: NarrationLine = { moment: "revised", purpose: "", slots: { before: "18 s", after: "6.5 s", drop: "64%" }, draft: "Crowding dropped {drop} ({before} → {after})." };

  it("fills placeholders and rejects unknown ones", () => {
    expect(fill(line.draft, line.slots)).toBe("Crowding dropped 64% (18 s → 6.5 s).");
    expect(fill("Down {nope}.", line.slots)).toBeNull();
    expect(fill("Down {drop", line.slots)).toBeNull();
  });

  it("allows only numbers of the slots, no spelled numbers, no jargon", () => {
    const allowed = allowedNumbers(line.slots);
    expect(checkSay("Crowding fell from 18 s to 6.5 s.", allowed)).toBeNull();
    expect(checkSay("Crowding fell 70%.", allowed)).toMatch(/70/);
    expect(checkSay("Crowding fell by half.", allowed)).toMatch(/half/);
    expect(checkSay("The hotspot shrank to 6.5 s.", allowed)).toMatch(/jargon/);
    expect(checkSay("Peak 2.1 p/m² at 18 s.", allowed)).not.toBeNull();
  });

  it("a rejected template falls back to the draft, worded by the stub", () => {
    expect(resolveLine(line, "Great news: {drop} less crowding!", "m")).toEqual({ text: "Great news: 64% less crowding!", by: "m" });
    const bad = resolveLine(line, "Crowding dropped 90% — {after} now.", "m");
    expect(bad.by).toBe("stub");
    expect(bad.text).toBe("Crowding dropped 64% (18 s → 6.5 s).");
    expect(bad.rejected).toMatch(/90/);
  });
});

describe.each(VENUES.map((v) => v.id))("narration in the loop (%s, stub)", (venueId) => {
  it("every say is plain language with numbers only from the run", async () => {
    const { events, says } = await run(venueId);
    expect(says.length).toBeGreaterThan(5);
    const allowed = numbersOfRun(events);
    for (const s of says) {
      expect(s.by).toBe("stub");
      expect(s.text.length).toBeGreaterThan(10);
      for (const j of JARGON) expect(s.text, `${s.moment}: ${s.text}`).not.toMatch(j);
      for (const t of numberTokens(s.text)) expect(allowed.has(t), `${t} in "${s.text}"`).toBe(true);
    }
  });

  it("each say lands right after the event it describes", async () => {
    const { events } = await run(venueId);
    const kinds = events.filter((e) => e.type !== "step" && e.type !== "report-delta");
    const at = (i: number) => kinds[i];
    kinds.forEach((e, i) => {
      if (e.type !== "say") return;
      const prev = at(i - 1);
      const m = e.data.moment;
      if (m === "intro") expect(prev.type).toBe("run");
      if (m === "brief") expect(prev.type).toBe("brief");
      if (m === "placed") expect(prev.type).toBe("validation");
      if (m === "simulated" || m === "revised") {
        expect(prev.type).toBe("comparison");
        expect(prev.type === "comparison" && prev.data.iteration).toBe(e.data.iteration);
      }
      if (m === "revising") {
        expect(prev.type).toBe("revision");
        expect(prev.type === "revision" && prev.data.iteration).toBe(e.data.iteration);
      }
      if (m === "result") expect(["report", "comparison", "error", "say"]).toContain(prev.type);
      if (m === "caution" && e.data.iteration === undefined) expect(["say"]).toContain(prev.type);
    });
    // result and cautions close the run, then done
    const sayResult = kinds.findIndex((e) => e.type === "say" && e.data.moment === "result");
    const done = kinds.findIndex((e) => e.type === "done");
    expect(sayResult).toBeGreaterThan(0);
    expect(kinds.slice(sayResult, done).every((e) => e.type === "say")).toBe(true);
    // every simulation is followed by a simulated/revised say for that iteration
    const sims = events.filter((e) => e.type === "sim").length;
    const told = kinds.filter((e) => e.type === "say" && (e.data.moment === "simulated" || e.data.moment === "revised")).length;
    expect(told).toBe(sims);
  });
});

describe("narration moments", () => {
  it("both venues together cover every moment; organizer overrides need approval", async () => {
    const all: SayInfo[] = [];
    for (const v of VENUES) all.push(...(await run(v.id)).says);
    for (const m of MOMENTS) expect(all.some((s) => s.moment === m), m).toBe(true);
    const outdoor = (await run("riverside-plaza")).says;
    const revising = outdoor.find((s) => s.moment === "revising" && s.needs_approval);
    expect(revising?.booth_ids?.length).toBeGreaterThan(0);
    expect(revising?.text).toMatch(/approval/);
    // the outdoor plaza's unknowns become one caution each
    const unknowns = VENUES.find((v) => v.id === "riverside-plaza")!.project.venue.unknowns;
    expect(outdoor.filter((s) => s.moment === "caution" && /site plan/.test(s.text))).toHaveLength(unknowns.length);
  });

  it("a failed run still says what happened", async () => {
    const inner = createMockEngine();
    const engine: Engine = { ...inner, simulate: async () => Promise.reject(new Error("engine down at 10.0.0.7:8000")) };
    const { says, result } = await run("sample-hall", createStubLLM(), engine);
    expect(result.done.status).toBe("error");
    const r = says.find((s) => s.moment === "result");
    expect(r?.tone).toBe("warn");
    expect(r?.text).not.toMatch(/10\.0|8000/);
    expect(says.some((s) => s.moment === "caution" && /technical problem/.test(s.text))).toBe(true);
  });
});

describe("model-path narration", () => {
  it("uses the model's wording when it only uses the given values", async () => {
    const { says } = await run("riverside-plaza", withModelNarration((d) => `Quick update: ${d}`));
    expect(says.length).toBeGreaterThan(5);
    for (const s of says) {
      expect(s.by).toBe("fake:muse");
      expect(s.text.startsWith("Quick update: ")).toBe(true);
    }
  });

  it("rejects a model that injects a number not in the results and falls back to the stub wording", async () => {
    const stub = (await run("riverside-plaza")).says;
    const { says, events } = await run("riverside-plaza", withModelNarration((d) => `${d} That beats last year's fair by 1234 visitors.`));
    const allowed = numbersOfRun(events);
    expect(allowed.has("1234")).toBe(false);
    expect(says.map((s) => s.text)).toEqual(stub.map((s) => s.text));
    expect(says.every((s) => s.by === "stub")).toBe(true);
  });

  it("rejects jargon and unknown placeholders", async () => {
    const { says } = await run("sample-hall", withModelNarration((d) => `${d} The hotspot is at {hotspot_xy}.`));
    expect(says.every((s) => s.by === "stub" && !/hotspot/.test(s.text))).toBe(true);
  });

  it("a failing model or the narration budget never stops the run", async () => {
    const broken: AgentLLM = { ...createStubLLM(), name: "broken", narrate: async () => Promise.reject(new Error("boom")) };
    const fallbacks: string[] = [];
    const llm = withCallCap(withFallback(broken, createStubLLM(), (what) => fallbacks.push(what)), 100, 2);
    const { says, result } = await run("sample-hall", llm);
    expect(result.done.status).toBe("completed");
    expect(says.every((s) => s.by === "stub")).toBe(true);
    expect(fallbacks.filter((w) => w === "narrate")).toHaveLength(2);
  });
});
