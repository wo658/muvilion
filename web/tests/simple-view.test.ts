import { describe, expect, it } from "vitest";
import indoorRec from "@/fixtures/replay/sample-hall.json";
import outdoorRec from "@/fixtures/replay/riverside-plaza.json";
import type { AgentEvent, AgentUIMessage, SayInfo } from "@/lib/agent/events";
import { RunDigest } from "@/lib/ask/contract";
import { approvalItems, approvalLine, approvalReducer, sayId } from "@/lib/ui/approvals";
import { FALLBACK_BY, museMessages, synthesizeSay } from "@/lib/ui/fallback-say";
import { inlineCssVars } from "@/lib/ui/export-plan";
import { eventsFromMessage } from "@/lib/ui/message-events";
import { museStatus } from "@/lib/ui/muse-status";
import { formatChange, formatSeconds, headline, nameList, shortLabel } from "@/lib/ui/plain";
import { buildRunDigest } from "@/lib/ask/digest";
import { layoutSummary } from "@/lib/ui/summary";

// The fallback is for streams without Muse's own messages, so these tests strip them.
const withoutSay = (events: AgentEvent[]) => events.filter((e) => e.type !== "say");
const indoor = withoutSay((indoorRec as { events: AgentEvent[] }).events);
const outdoor = withoutSay((outdoorRec as { events: AgentEvent[] }).events);
const JARGON = /p\/m²|CP-SAT|hotspot|iteration|run_id|OR-Tools|baseline/i;

describe("headline formatter", () => {
  it("rounds: one decimal under 10 s, whole seconds above", () => {
    expect(formatSeconds(18.22)).toBe("18 s");
    expect(formatSeconds(6.513)).toBe("6.5 s");
    expect(formatSeconds(6.04)).toBe("6 s");
    expect(formatSeconds(9.96)).toBe("10 s");
    expect(formatSeconds(0)).toBe("0 s");
  });
  it("percent change with a real minus sign, plus sign and zero", () => {
    expect(formatChange(18.22, 6.513)).toBe("−64%");
    expect(formatChange(10, 11.2)).toBe("+12%");
    expect(formatChange(10, 10.02)).toBe("±0%");
    expect(formatChange(0, 3)).toBeNull();
  });
  it("builds the one-line headline and its tone", () => {
    const h = headline(18.22, 6.513);
    expect(h.text).toBe("18 s → 6.5 s (−64%)");
    expect(h.tone).toBe("good");
    expect(headline(10, 12).tone).toBe("warn");
    expect(headline(16.82).text).toBe("17 s");
  });
  it("names booths plainly", () => {
    expect(shortLabel("Food Truck 3 (sponsor food court)")).toBe("Food Truck 3");
    expect(nameList(["Food Truck 3", "Food Truck 1", "Food Truck 2", "Food Truck 5"])).toBe("Food Trucks 1, 2, 3 and 5");
    expect(nameList(["Booth 10"])).toBe("Booth 10");
    expect(nameList(["Ticket Kiosk", "Booth 3", "Booth 17"])).toBe("the Ticket Kiosk and Booths 3 and 17");
  });
});

describe("fallback say synthesis", () => {
  it("narrates the indoor replay in plain words, numbers from the run", () => {
    const says = synthesizeSay(indoor);
    const moments = says.map((s) => s.moment);
    expect(moments[0]).toBe("intro");
    expect(moments).toContain("brief");
    expect(moments).toContain("placed");
    expect(moments).toContain("revising");
    expect(moments).toContain("revised");
    expect(moments).toContain("result");
    for (const s of says) {
      expect(s.by).toBe(FALLBACK_BY);
      expect(s.text).not.toMatch(JARGON);
    }
    const result = says.find((s) => s.moment === "result")!;
    expect(result.text).toContain("17 s");
    expect(result.text).toContain("8.5 s");
    expect(result.tone).toBe("good");
    const first = says.find((s) => s.moment === "simulated" && s.iteration === 0)!;
    expect(first.text).toContain("17 s");
    expect(first.booth_ids).toContain("B10");
    expect(first.text).toContain("Booths 3, 10 and 17");
  });

  it("asks for approval when organizer-requested spots are released (outdoor)", () => {
    const says = synthesizeSay(outdoor);
    const approval = says.filter((s) => s.needs_approval);
    expect(approval.length).toBeGreaterThan(0);
    expect(approval[0].text).toContain("Food Trucks 1, 2, 3 and 5");
    expect(approval[0].tone).toBe("warn");
    expect(approval[0].booth_ids).toEqual(expect.arrayContaining(["F1", "F2", "F3", "F5"]));
    for (const s of says) expect(s.text).not.toMatch(JARGON);
  });

  it("is used only when the stream has no say parts", () => {
    const real: SayInfo = { moment: "intro", text: "Hi", tone: "neutral", by: "muse" };
    const withSay: AgentEvent[] = [...indoor.slice(0, 3), { type: "say", data: real }];
    expect(museMessages(withSay)).toEqual([real]);
    expect(museMessages(indoor)[0].by).toBe(FALLBACK_BY);
    expect(museMessages([])).toEqual([]);
  });

  it("is a pure function of a growing prefix (streams build up messages in order)", () => {
    const half = indoor.slice(0, Math.floor(indoor.length / 2));
    const a = synthesizeSay(half);
    const b = synthesizeSay(indoor);
    expect(b.slice(0, a.length - 1).map((s) => s.moment)).toEqual(a.slice(0, -1).map((s) => s.moment));
  });
});

describe("approval reducer", () => {
  it("decides, changes, undoes and resets", () => {
    let s = approvalReducer({}, { type: "decide", id: "a", choice: "approved" });
    expect(s).toEqual({ a: "approved" });
    expect(approvalReducer(s, { type: "decide", id: "a", choice: "approved" })).toBe(s);
    s = approvalReducer(s, { type: "decide", id: "a", choice: "kept" });
    expect(s).toEqual({ a: "kept" });
    s = approvalReducer(s, { type: "decide", id: "b", choice: "approved" });
    expect(approvalReducer(s, { type: "undo", id: "a" })).toEqual({ b: "approved" });
    expect(approvalReducer(s, { type: "reset" })).toEqual({});
  });
  it("lists approval items with their choices for the summary", () => {
    const says = synthesizeSay(outdoor);
    const idx = says.findIndex((m) => m.needs_approval);
    const id = sayId(says[idx], idx);
    const items = approvalItems(says, { [id]: "kept" });
    expect(items[0]).toMatchObject({ id, choice: "kept" });
    expect(approvalLine(items[0])).toMatch(/^Kept the original: /);
    const text = layoutSummary({ venueName: "Riverside Park Plaza", boothCount: 25, visitors: 300, before: 18.22, after: 6.513, approvals: items, cautions: [] });
    expect(text).toContain("18 s → 6.5 s (−64%)");
    expect(text).toContain("Kept the original");
  });
});

describe("stream helpers", () => {
  it("rebuilds events from message parts and builds a valid digest", () => {
    const message = {
      id: "m",
      role: "assistant",
      parts: [
        ...indoor.filter((e) => e.type !== "report-delta").map((e) => ({ type: `data-${e.type}`, id: "x", data: (e as { data: unknown }).data })),
        { type: "text", text: "report" },
      ],
    } as unknown as AgentUIMessage;
    const events = eventsFromMessage(message);
    expect(events.find((e) => e.type === "run")).toBeTruthy();
    expect(events.at(-1)).toEqual({ type: "report-delta", delta: "report" });
    const digest = RunDigest.parse(buildRunDigest(events));
    expect(digest.iterations.map((i) => i.iteration)).toEqual([0, 1, 2]);
    expect(digest.final_iteration).toBe(2);
    expect(digest.iterations[2].change).not.toBe("");
    const outdoorDigest = RunDigest.parse(buildRunDigest(outdoor));
    expect(outdoorDigest.approvals.length).toBeGreaterThan(0);
  });
  it("gives a plain status for the running step", () => {
    const run = indoor.find((e) => e.type === "run")!.data as never;
    expect(museStatus([{ id: "s", iteration: 0, step: "simulate", status: "running", title: "" }], run)).toMatch(/^Sending \d+ virtual visitors through…$/);
    expect(museStatus([{ id: "s", iteration: 0, step: "generate", status: "running", title: "" }], run)).toBe("Placing booths…");
  });
  it("inlines CSS variables for the PNG export", () => {
    const out = inlineCssVars('<rect fill="var(--accent)" stroke="var(--nope, #000)" style="font-family: var(--font-inter), sans"/>', (n) =>
      n === "--accent" ? " #1F5F5B" : n === "--font-inter" ? "Inter" : "",
    );
    expect(out).toBe('<rect fill="#1F5F5B" stroke="#000" style="font-family: Inter, sans"/>');
  });
});
