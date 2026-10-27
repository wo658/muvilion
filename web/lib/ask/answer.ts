/**
 * Ask Muse answers, grounded in the RunDigest the client sends.
 *
 * - `stubAnswer`: deterministic answers for common intents (summary, why was X moved, is it safe,
 *   what needs approval, what if more visitors, what's still unknown) with a graceful default.
 *   Used when LIVE_AGENT is not "on", AGENT_LLM=stub, there is no key, or the model answer fails.
 * - `ASK_SYSTEM`: the model's instructions (plain language, digest only, never invent numbers).
 * - `checkAnswer`: the numbers guard for model answers. Every digit sequence must be a number of
 *   the digest (in any of the roundings people use), a percent change between two of its crowding
 *   values, a count of its lists, or a number the user wrote. Otherwise the stub answer is used.
 */
import { numberTokens, secs, unknownSubject } from "@/lib/agent/narrate";
import type { AskRequest, RunDigest } from "./contract";

export const ASK_SYSTEM = `You are Muse, a friendly assistant that helped an event organizer plan where booths go.
You answer follow-up questions about ONE planning run, described by the JSON digest below. The user is not a crowd-simulation expert.
Rules:
- Plain, warm, concise American English; 2 to 5 sentences. No jargon (no density, p/m², hotspot, solver, constraint, iteration, baseline, agent).
- Answer only from the digest. If the digest does not say, say plainly that you don't know; if it is about the site, point to the unconfirmed items ("unknowns").
- Never invent, estimate or extrapolate numbers. Use only numbers that appear in the digest (you may round them) or that the user wrote.
- "crowded_s_per_visitor" is the seconds the average visitor spent squeezed in crowds; lower is better. Iterations are rounds of changes: iteration 0 is the first layout, final_iteration is the one recommended.
- This is a planning draft, not a safety certification; say so when asked about safety.
- You may suggest what to try next in a new run, such as more visitors or a different main gate.`;

// ---------- allowed numbers ----------

function addNumber(set: Set<string>, v: number) {
  if (!Number.isFinite(v)) return;
  for (const d of [0, 1, 2]) {
    const r = Number(v.toFixed(d));
    set.add(String(r));
    set.add(r.toFixed(d));
  }
  set.add(String(v));
}

function collect(v: unknown, nums: number[], strs: string[]) {
  if (typeof v === "number") nums.push(v);
  else if (typeof v === "string") strs.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, nums, strs));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, nums, strs));
}

export function askAllowedNumbers(req: Pick<AskRequest, "digest" | "question" | "history">): Set<string> {
  const d = req.digest;
  const set = new Set<string>();
  const nums: number[] = [];
  const strs: string[] = [req.question, ...req.history.map((h) => h.text)];
  collect(d, nums, strs);
  for (const n of nums) addNumber(set, n);
  for (const s of strs) for (const t of numberTokens(s)) set.add(t);
  for (const it of d.iterations) if (it.completed_fraction !== null) addNumber(set, it.completed_fraction * 100);
  const crowded = d.iterations.map((i) => i.crowded_s_per_visitor).filter((x): x is number => x !== null);
  for (const a of crowded)
    for (const b of crowded) {
      if (a > 0 && a !== b) addNumber(set, (Math.abs(a - b) / a) * 100);
      addNumber(set, Math.abs(a - b));
    }
  addNumber(set, d.scenario.duration_s / 60);
  for (const n of [d.iterations.length, d.approvals.length, d.unknowns.length, Math.max(0, d.iterations.length - 1)]) addNumber(set, n);
  return set;
}

/** Why a model answer may not be shown (null when it passes). */
export function checkAnswer(text: string, allowed: Set<string>): string | null {
  if (!text.trim()) return "empty answer";
  const bad = numberTokens(text).filter((t) => !allowed.has(t));
  return bad.length ? `number(s) not in the run: ${bad.join(", ")}` : null;
}

// ---------- deterministic answers ----------

export type AskIntent = "approval" | "unknowns" | "safety" | "visitors" | "what_if" | "moved" | "summary" | "default";

export function classifyQuestion(q: string): AskIntent {
  const s = q.toLowerCase();
  if (/approv|sign[- ]?off|permission|organi[sz]er|sponsor|\bok\b|okay/.test(s)) return "approval";
  if (/unknown|unconfirm|uncertain|not sure|missing|check on site|still need|to confirm|\bconfirm/.test(s)) return "unknowns";
  if (/\bsafe|safety|danger|risk|emergenc|fire|crush|evacuat/.test(s)) return "safety";
  if (/(more|fewer|less|bigger|larger|smaller|double)\s+(the\s+)?(people|visitors|crowd|attendees|guests|attendance)|\d+\s*(people|visitors|attendees|guests)|attendance/.test(s))
    return "visitors";
  if (/\bwhy\b|\bmov(e|ed|ing)\b|\bchang(e|ed|es)\b|\bwhere did\b/.test(s)) return "moved";
  if (/what if|what would happen|could (we|i)|should (we|i)|instead/.test(s)) return "what_if";
  if (/summar|overview|recap|what happened|how did|result|tl;?dr|bottom line|how (good|well)/.test(s)) return "summary";
  return "default";
}

const byIteration = (d: RunDigest, k: number | null) => (k === null ? undefined : d.iterations.find((i) => i.iteration === k));
const finalOf = (d: RunDigest) => byIteration(d, d.final_iteration) ?? [...d.iterations].reverse().find((i) => i.crowded_s_per_visitor !== null);
const baseOf = (d: RunDigest) => byIteration(d, d.baseline_iteration ?? 0);
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const noDot = (s: string) => s.replace(/\.\s*$/, "");
const plainUnknown = (u: string) => unknownSubject(u) ?? lowerFirst(noDot(u));
const venue = (d: RunDigest) => d.venue.name.replace(/\s*\([^)]*\)/g, "").trim();

function summary(d: RunDigest): string {
  const b = baseOf(d);
  const f = finalOf(d);
  if (!b || b.crowded_s_per_visitor === null) return `I haven't finished testing a layout for ${venue(d)} yet, so there's nothing to report so far.`;
  const parts = [`At ${venue(d)}, I tested each layout with ${d.scenario.agents} virtual visitors.`];
  const bs = b.crowded_s_per_visitor;
  const fs = f?.crowded_s_per_visitor ?? null;
  if (f && fs !== null && f.iteration !== b.iteration && fs < bs) {
    parts.push(`In the first layout the average visitor spent ${secs(bs)} squeezed in crowds; in the layout I recommend it's ${secs(fs)}, ${Math.round(((bs - fs) / bs) * 100)}% less.`);
  } else {
    parts.push(`In the first layout the average visitor spent ${secs(bs)} squeezed in crowds${d.iterations.length > 1 ? ", and none of my changes beat it" : ""}.`);
  }
  if (d.stop_reason) parts.push(d.stop_reason);
  if (d.approvals.length) parts.push("Some of my changes need your approval before you use the layout: ask me what needs approval.");
  else if (d.unknowns.length) parts.push("A few things on the site plan still need checking: ask me what's unconfirmed.");
  return parts.join(" ");
}

function approval(d: RunDigest): string {
  if (d.approvals.length === 0) return "Nothing needs your approval: none of my changes went against what the organizer asked for.";
  const items = d.approvals.map((a) => lowerFirst(noDot(a)));
  return `Yes, please confirm ${items.length === 1 ? "this" : "these"} with the organizer: ${items.join("; ")}. I only did it because the crowd built up around those spots.`;
}

function unknowns(d: RunDigest): string {
  if (d.unknowns.length === 0) return "The site plan didn't flag anything as unconfirmed, but it's still worth a walk-through before the event.";
  return `The site plan doesn't confirm these: ${d.unknowns.map(plainUnknown).join("; ")}. Please check them on site before the event; I didn't account for them in the layout.`;
}

function safety(d: RunDigest): string {
  const f = finalOf(d);
  const parts = ["I can't tell you it's safe: this is a planning draft from a visitor simulation, not a fire-code or crowd-safety review."];
  if (f?.crowded_s_per_visitor != null)
    parts.push(`In the recommended layout the average visitor spends ${secs(f.crowded_s_per_visitor)} in crowded spots, against a goal of ${secs(d.target_crowded_s_per_visitor)} or less.`);
  if (d.unknowns.length) parts.push(`The site plan also leaves things unconfirmed, such as ${plainUnknown(d.unknowns[0])}.`);
  parts.push("Please have a qualified reviewer check it before the event.");
  return parts.join(" ");
}

function visitors(d: RunDigest, q: string): string {
  const n = q.match(/(\d[\d,]*)\s*(people|visitors|attendees|guests)/i)?.[1];
  const f = finalOf(d);
  const near = f?.crowded_near.length ? ` The first place to watch would be around ${f.crowded_near.slice(0, 2).join(" and ")}.` : "";
  return `I only tested with ${d.scenario.agents} visitors, so I can't say how ${n ? `${n} visitors` : "a bigger crowd"} would feel without a new test.${near} Try a new run with more visitors to see how the layout holds up.`;
}

function whatIf(d: RunDigest): string {
  return `I can only speak to the layouts I actually tested for ${venue(d)}, so I can't predict that change. You could try it in a new run, for example with a different main gate or more visitors, and I'll compare it the same way.`;
}

function moved(d: RunDigest, q: string): string {
  const changed = d.iterations.filter((i) => i.change);
  if (changed.length === 0) return "I didn't change anything after the first layout, so every booth is where it was first placed.";
  const tokens = (q.match(/[a-z]+[- ]?\d+|\b[a-z]{3,}\b/gi) ?? []).map((t) => t.toLowerCase().replace(/[- ]/g, ""));
  const words = new Set(tokens.filter((t) => !["why", "did", "you", "the", "was", "were", "move", "moved", "change", "changed", "what", "where"].includes(t)));
  const mentions = (text: string) => {
    const flat = text.toLowerCase().replace(/[- ]/g, "");
    return [...words].some((w) => /\d/.test(w) && flat.includes(w));
  };
  const hits = changed.filter((i) => mentions(i.change));
  const asked = [...words].some((w) => /\d/.test(w));
  // A named booth no change was about: say so, then give only the change that shaped the result.
  const pick = hits.length ? hits : asked ? changed.slice(-1) : changed;
  const lines = pick.slice(0, 2).map((i) => {
    const before = d.iterations.find((x) => x.iteration === i.iteration - 1);
    const why = before?.crowded_near.length ? `, because visitors were getting packed around ${before.crowded_near.slice(0, 2).join(" and ")}` : "";
    const effect =
      before?.crowded_s_per_visitor != null && i.crowded_s_per_visitor != null
        ? ` Crowding then went from ${secs(before.crowded_s_per_visitor)} to ${secs(i.crowded_s_per_visitor)} per visitor.`
        : "";
    return `I decided to ${lowerFirst(noDot(i.change))}${why}.${effect}`;
  });
  const prefix = asked && hits.length === 0 ? "I didn't move that booth on purpose; it may have shifted to make room for the changes I did make. " : "";
  return prefix + lines.join(" ");
}

export function stubAnswer(req: Pick<AskRequest, "question" | "digest">): string {
  const d = req.digest;
  switch (classifyQuestion(req.question)) {
    case "approval":
      return approval(d);
    case "unknowns":
      return unknowns(d);
    case "safety":
      return safety(d);
    case "visitors":
      return visitors(d, req.question);
    case "what_if":
      return whatIf(d);
    case "moved":
      return moved(d, req.question);
    case "summary":
      return summary(d);
    default:
      return `${summary(d)} You can also ask me why something moved, what needs your approval, or what's still unconfirmed.`;
  }
}

// ---------- per-instance rate limit ----------

let window: number[] = [];

/** Sliding one-minute window per server instance (ASK_RATE_LIMIT_PER_MIN, default 20). */
export function acquireAsk(limitPerMin: number, now = Date.now()): boolean {
  window = window.filter((t) => now - t < 60_000);
  if (window.length >= limitPerMin) return false;
  window.push(now);
  return true;
}

export function resetAskRateLimit() {
  window = [];
}
