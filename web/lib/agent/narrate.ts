/**
 * Muse's plain-language voice: what the loop tells a non-expert user at each moment of a run
 * (`say` events, see SayInfo in events.ts).
 *
 * Numbers guard ("code supplies numbers, the model chooses wording"):
 *   1. Code builds every message as a `NarrationLine`: the facts as named `slots` (already
 *      formatted strings such as "18 s", "27%", "Food Truck 3", computed from run inputs and engine
 *      results only) and a deterministic `draft` template that uses them as `{placeholders}`.
 *   2. The LLM (`AgentLLM.narrate`) returns one template per line, written with the same
 *      placeholders. The stub returns the drafts unchanged.
 *   3. `fill` substitutes the slots; an unknown placeholder or a stray brace rejects the template.
 *   4. `checkSay` rejects the filled text if any digit sequence in it is not a digit sequence of
 *      the slot values, if it spells out a number ("twice", "half", "forty" …), uses a jargon term,
 *      or is empty / too long.
 *   5. A rejected line falls back to the filled draft (`by: "stub"`), so the event is always sent.
 * Tone, iteration, booth_ids and needs_approval are always decided by code, never by the model.
 *
 * Everything here except `createNarrator` is pure and import-safe for the client (the Ask Muse
 * digest reuses the change descriptions).
 */
import type { BoothSpec, Door, Hotspot, LayoutConstraints, Venue } from "@/lib/engine/contract";
import { center, dist, doorMid, round } from "@/lib/geometry";
import type { BriefInfo, Emit, Metrics, RevisionInfo, SayInfo, SayMoment, Targets } from "./events";
import type { AgentLLM } from "./llm";
import type { AppliedAction } from "./revision";

// ---------- the line format shared with the LLM ----------

export type NarrationLine = {
  moment: SayMoment;
  /** What the message must convey (for the model). */
  purpose: string;
  /** Code-computed facts, already formatted; the only source of numbers and names. */
  slots: Record<string, string>;
  /** Deterministic wording (template over `slots`); the stub's text and the fallback. */
  draft: string;
};

export type SayMeta = Omit<SayInfo, "text" | "by" | "moment">;

// ---------- guard ----------

/** Terms the simple view must never show. */
export const JARGON: RegExp[] = [
  /p\/m(²|2)/i,
  /m²/,
  /\bhot ?spots?\b/i,
  /\bcp-?sat\b/i,
  /\bor-?tools\b/i,
  /\biterations?\b/i,
  /\bsolver\b/i,
  /\bconstraints?\b/i,
  /\bjupedsim\b/i,
  /\bshapely\b/i,
  /\bsimpy\b/i,
  /\bkeep-?outs?\b/i,
  /\bdensit(y|ies)\b/i,
  /s\/visitor/i,
  /person-s(econds)?/i,
  /\bpopularity\b/i,
  /\bthreshold\b/i,
  /\bbaseline\b/i,
  /\bagents?\b/i,
  /\bun?pin(s|ned|ning)?\b/i,
  /\bp90\b/i,
];

const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|dozens?|half|halved|twice|double[ds]?|triple[ds]?|percent)\b/i;

export const numberTokens = (s: string): string[] => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((t) => t.replace(/,/g, ""));

export function allowedNumbers(slots: Record<string, string>): Set<string> {
  return new Set(Object.values(slots).flatMap(numberTokens));
}

/** Fill `{placeholders}`; null if a placeholder is unknown or braces are left over. */
export function fill(template: string, slots: Record<string, string>): string | null {
  let bad = false;
  const out = template.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (_, k: string) => {
    if (!(k in slots)) bad = true;
    return slots[k] ?? "";
  });
  if (bad || /[{}]/.test(out)) return null;
  return out.replace(/\s+/g, " ").trim();
}

/** Why `text` may not be shown (null when it passes): numbers ⊂ allowed, no spelled numbers, no jargon. */
export function checkSay(text: string, allowed: Set<string>): string | null {
  if (!text.trim()) return "empty";
  if (text.length > 420) return "too long";
  const bad = numberTokens(text).filter((t) => !allowed.has(t));
  if (bad.length) return `number(s) not in the run results: ${bad.join(", ")}`;
  const w = text.match(NUMBER_WORDS);
  if (w) return `spelled-out number "${w[0]}"`;
  const j = JARGON.find((r) => r.test(text));
  if (j) return `jargon ${j}`;
  return null;
}

/** Template from the model → final text, or the draft when the template is unusable. */
export function resolveLine(line: NarrationLine, template: string | undefined, by: string): { text: string; by: string; rejected?: string } {
  const draft = fill(line.draft, line.slots) ?? line.draft;
  if (template === undefined) return { text: draft, by: "stub" };
  const filled = fill(template, line.slots);
  if (filled === null) return { text: draft, by: "stub", rejected: "unknown placeholder" };
  const why = checkSay(filled, allowedNumbers(line.slots));
  if (why) return { text: draft, by: "stub", rejected: why };
  return { text: filled, by };
}

// ---------- plain names and numbers ----------

const strip0 = (n: number) => String(n);
/** Seconds as people read them: whole seconds from 10 up, one decimal below. */
export const secs = (s: number) => `${strip0(s >= 10 ? Math.round(s) : round(s, 1))} s`;
export const meters = (m: number) => `${strip0(round(m, 1))} m`;
export const percent = (f: number) => `${Math.round(f * 100)}%`;
export const minutes = (s: number) => (s % 60 === 0 ? `${s / 60} minutes` : `${Math.round(s)} seconds`);

const KIND_NAMES: Record<BoothSpec["kind"], [string, string]> = {
  booth: ["booth", "booths"],
  tent: ["market stall", "market stalls"],
  food_truck: ["food truck", "food trucks"],
  kiosk: ["ticket kiosk", "ticket kiosks"],
};

/** "Food Truck 3", "Market 4"; a label that just names the kind reads "the ticket kiosk". */
export function boothName(s: BoothSpec): string {
  const label = s.label.replace(/\s*\([^)]*\)/g, "").trim() || s.id;
  return label.toLowerCase() === KIND_NAMES[s.kind][0] ? `the ${KIND_NAMES[s.kind][0]}` : label;
}

const joinAnd = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "Food Truck 3", "Food Truck 3 and Market 4", "the food trucks", "4 of the food trucks". */
export function boothsPhrase(ids: string[], specs: BoothSpec[]): string {
  return namesPhrase(ids, specs);
}

function namesPhrase(ids: string[], specs: BoothSpec[]): string {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const list = [...new Set(ids)].map((id) => byId.get(id)).filter((s): s is BoothSpec => Boolean(s));
  if (list.length === 0) return "the booths";
  if (list.length <= 3) return joinAnd(list.map(boothName));
  const kinds = new Set(list.map((s) => s.kind));
  if (kinds.size === 1) {
    const kind = list[0].kind;
    const total = specs.filter((s) => s.kind === kind).length;
    const plural = KIND_NAMES[kind][1];
    return list.length === total ? `the ${plural}` : `${list.length} of the ${plural}`;
  }
  return `${joinAnd(list.slice(0, 2).map(boothName).concat([`${list.length - 2} others`]))}`;
}

/** "18 market stalls, 6 food trucks and a ticket kiosk". */
export function lineupPhrase(specs: BoothSpec[]): string {
  const counts = new Map<BoothSpec["kind"], number>();
  for (const s of specs) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  return joinAnd([...counts].map(([k, n]) => (n === 1 ? `a ${KIND_NAMES[k][0]}` : `${n} ${KIND_NAMES[k][1]}`)));
}

export const venueName = (v: Pick<Venue, "name">) => v.name.replace(/\s*\([^)]*\)/g, "").trim();

/** "the main gate", "the west gate", "the main entrance", "the exit". */
export function doorPhrase(door: Door, venue: Venue): string {
  const noun = venue.setting === "outdoor" ? "gate" : door.kind === "entrance" ? "entrance" : "door";
  const suffix = door.id.split("-").slice(1).join(" ").toLowerCase();
  if (["main", "north", "south", "east", "west"].includes(suffix)) return `the ${suffix} ${noun}`;
  if (door.kind === "exit") return "the exit";
  if (door.kind === "emergency") return "the emergency exit";
  return `the ${noun}`;
}

/** "around Food Truck 3 and Food Truck 6 by the main gate". */
export function wherePhrase(h: Hotspot | undefined, venue: Venue, specs: BoothSpec[]): string {
  if (!h) return "in a few spots";
  const c = center(h.zone);
  const ents = venue.doors.filter((d) => d.kind === "entrance");
  const near = ents
    .map((d) => ({ d, m: dist(doorMid(d), c) }))
    .sort((a, b) => a.m - b.m)[0];
  const by = near && near.m < 12 ? ` by ${doorPhrase(near.d, venue)}` : "";
  // Name the (at most two) biggest crowd magnets next to the crowding, not every booth around it.
  const pop = new Map(specs.map((s) => [s.id, s.popularity]));
  const ids = [...h.nearby_booth_ids].sort((a, b) => (pop.get(b) ?? 0) - (pop.get(a) ?? 0)).slice(0, 2);
  return ids.length ? `around ${boothsPhrase(ids, specs)}${by}` : by ? `right${by}` : "in one part of the site";
}

// ---------- plain change descriptions (shared with the Ask Muse digest) ----------

export type ChangeContext = {
  venue: Venue;
  specs: BoothSpec[];
  /** Positions the organizer asked for (ProjectInput.constraints.fixed). */
  organizerFixed: LayoutConstraints["fixed"];
  /** Hotspots of the simulation the revision reacted to (for "open up the walkway around …"). */
  hotspots: Hotspot[];
  /** Append booth ids to names ("the food trucks (F1, F2)"); the Ask Muse digest uses this for matching. */
  withIds?: boolean;
};

const DIRS: Record<string, string> = {
  north: "north",
  south: "south",
  east: "east",
  west: "west",
  away_from_entrance: "away from the entrance",
  away_from_hotspot: "away from the crowded spot",
};

/** Plain phrases (lowercase, no final period) for the applied actions of a revision. */
export function changePhrases(applied: AppliedAction[], ctx: ChangeContext): string[] {
  const out: string[] = [];
  const boothsPhrase = (ids: string[], specs: BoothSpec[]) => {
    const p = namesPhrase(ids, specs);
    return ctx.withIds ? `${p} (${[...new Set(ids)].join(", ")})` : p;
  };
  const unpins = applied.flatMap((a) => (a.action.type === "unpin_booth" ? [a.action.booth_id] : []));
  if (unpins.length) {
    const fromOrganizer = unpins.every((id) => ctx.organizerFixed[id]);
    out.push(`let ${boothsPhrase(unpins, ctx.specs)} move away from ${fromOrganizer ? "the spots the organizer asked for" : "their fixed spots"}`);
  }
  for (const { action: a } of applied) {
    switch (a.type) {
      case "move_booth":
        out.push(`move ${boothsPhrase([a.booth_id], ctx.specs)} about ${meters(a.distance_m)} ${DIRS[a.direction]}`);
        break;
      case "pin_booth":
        out.push(`keep ${boothsPhrase([a.booth_id], ctx.specs)} where it is`);
        break;
      case "widen_aisle_at_hotspot": {
        const h = ctx.hotspots[a.hotspot_index];
        out.push(h?.nearby_booth_ids.length ? `open up the walkway around ${boothsPhrase(h.nearby_booth_ids, ctx.specs)}` : "open up the most crowded walkway");
        break;
      }
      case "add_keep_out":
        out.push("keep an extra area free of booths");
        break;
      case "remove_keep_out":
        out.push("free up an area I had kept empty");
        break;
      case "set_popular_door_distance":
        out.push(a.value > 0 ? `keep the busiest booths at least ${meters(a.value)} from the entrances` : "let the busiest booths sit near the entrances again");
        break;
      case "set_popular_threshold":
        out.push("change which booths I treat as crowd magnets");
        break;
      case "set_min_aisle_width":
        out.push(`make walkways at least ${meters(a.value)} wide`);
        break;
      case "set_door_clearance":
        out.push(`leave ${meters(a.value)} of open space inside every ${ctx.venue.setting === "outdoor" ? "gate" : "door"}`);
        break;
      case "unpin_booth":
        break;
    }
  }
  return out;
}

/** Booths whose organizer-requested position this revision gives up (needs a person's approval). */
export function overriddenRequests(applied: AppliedAction[], organizerFixed: LayoutConstraints["fixed"]): string[] {
  return [
    ...new Set(
      applied.flatMap((a) =>
        (a.action.type === "unpin_booth" || a.action.type === "move_booth") && organizerFixed[a.action.booth_id] ? [a.action.booth_id] : [],
      ),
    ),
  ];
}

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const changeSlots = (phrases: string[]) => Object.fromEntries(phrases.map((p, i) => [`change_${i + 1}`, p]));
const changeRefs = (phrases: string[]) => joinAnd(phrases.map((_, i) => `{change_${i + 1}}`));

/** One plain sentence for a revision ("Let the food trucks move … and make walkways at least 4 m wide."). */
export function describeRevision(info: Pick<RevisionInfo, "applied">, ctx: ChangeContext): string {
  const p = changePhrases(info.applied, ctx);
  return p.length ? `${sentence(joinAnd(p))}.` : "";
}

// ---------- line builders (pure) ----------

export type NarrationFacts = {
  venue: Venue;
  specs: BoothSpec[];
  organizerFixed: LayoutConstraints["fixed"];
  visitors: number;
  durationS: number;
  targets: Targets;
};

export function introLine(f: NarrationFacts): NarrationLine {
  return {
    moment: "intro",
    purpose: "Greet the user and say what you are about to do for this site (lay out the booths, test them with virtual visitors, rearrange if it gets packed).",
    slots: { venue: venueName(f.venue), lineup: lineupPhrase(f.specs), visitors: String(f.visitors) },
    draft:
      "Hi, I'm Muse. I'll lay out {lineup} at {venue}, then send {visitors} virtual visitors through it to see where crowds build up. If it gets packed somewhere, I'll rearrange and test again.",
  };
}

export function briefLine(f: NarrationFacts, brief: BriefInfo): { line: NarrationLine; meta: SayMeta } {
  const slots: Record<string, string> = {};
  const parts: string[] = [];
  const booths: string[] = [];
  const doors = new Map(f.venue.doors.map((d) => [d.id, d]));
  const opening = new Set<string>();
  for (const { item } of brief.applied) {
    switch (item.type) {
      case "set_min_aisle_width":
        slots.aisle = meters(item.value);
        parts.push("keep walkways at least {aisle} wide");
        break;
      case "set_door_clearance":
        slots.clearance = meters(item.value);
        parts.push(`leave {clearance} of open space inside every ${f.venue.setting === "outdoor" ? "gate" : "door"}`);
        break;
      case "set_popular_door_distance":
        if (item.value > 0) {
          slots.distance = meters(item.value);
          parts.push("keep the busiest booths at least {distance} from the entrances");
        }
        break;
      case "keep_clear_at_door": {
        const d = doors.get(item.door_id);
        if (d && !opening.has(d.id)) {
          opening.add(d.id);
          const k = `open_${opening.size}`;
          slots[k] = doorPhrase(d, f.venue);
          parts.push(`keep an open area in front of {${k}}`);
        }
        break;
      }
      case "add_keep_out":
        parts.push("keep an extra area free of booths");
        break;
      case "place_near_door": {
        const d = doors.get(item.door_id);
        if (!d) break;
        booths.push(item.booth_id);
        const i = booths.length;
        slots[`booth_${i}`] = boothsPhrase([item.booth_id], f.specs);
        slots[`door_${i}`] = doorPhrase(d, f.venue);
        parts.push(`put {booth_${i}} right beside {door_${i}}`);
        break;
      }
      default:
        break;
    }
  }
  const fireLane = f.venue.zones.some((z) => z.kind === "fire_lane");
  const draft = parts.length
    ? `Here's my plan: I'll ${joinAnd(parts)}.${fireLane ? " The fire lane stays clear the whole time." : ""}`
    : "I'll start with standard spacing between booths and let the first visitor test show what needs to change.";
  return {
    line: {
      moment: "brief",
      purpose: "Explain the design intent for the empty site in plain words, before any booth is placed.",
      slots,
      draft,
    },
    meta: { tone: "neutral", iteration: 0, ...(booths.length ? { booth_ids: booths } : {}) },
  };
}

export function placedLine(
  f: NarrationFacts,
  args: { placed: number; total: number; errors: number; aisle: number },
): { line: NarrationLine; meta: SayMeta } {
  const ok = args.errors === 0 && args.placed === args.total;
  return {
    line: {
      moment: "placed",
      purpose: "Say that the first layout is placed and whether everything fits.",
      slots: { placed: String(args.placed), total: String(args.total), aisle: meters(args.aisle), problems: String(args.errors) },
      draft: ok
        ? args.total === 1
          ? "The booth fits, with walkways at least {aisle} wide."
          : "All {placed} booths fit, with walkways at least {aisle} wide."
        : "I placed {placed} of {total} booths, but the layout still breaks {problems} of the site rules. I'll show you where.",
    },
    meta: { tone: ok ? "good" : "warn", iteration: 0 },
  };
}

type SimFacts = { iteration: number; metrics: Metrics; hotspots: Hotspot[] };

export function simulatedLine(f: NarrationFacts, s: SimFacts): { line: NarrationLine; meta: SayMeta } {
  const top = s.hotspots[0];
  const crowded = s.metrics.crowded_s_per_visitor > f.targets.crowded_s_per_visitor;
  const slots = {
    visitors: String(f.visitors),
    crowded: secs(s.metrics.crowded_s_per_visitor),
    where: wherePhrase(top, f.venue, f.specs),
  };
  return {
    line: {
      moment: "simulated",
      purpose: "Describe what the virtual visitors experienced in the first layout, in human terms: where it got packed and how long the average visitor spent squeezed in crowds.",
      slots,
      draft: crowded
        ? "With {visitors} visitors, the area {where} gets packed: the average visitor spends {crowded} squeezed in crowds."
        : "With {visitors} visitors, people move around freely: the average visitor spends only {crowded} in crowded spots.",
    },
    meta: { tone: crowded ? "warn" : "good", iteration: s.iteration, ...(top && crowded ? { booth_ids: top.nearby_booth_ids } : {}) },
  };
}

export function revisingLine(
  f: NarrationFacts,
  info: RevisionInfo,
  hotspots: Hotspot[],
): { line: NarrationLine; meta: SayMeta } | null {
  const ctx: ChangeContext = { venue: f.venue, specs: f.specs, organizerFixed: f.organizerFixed, hotspots };
  const phrases = changePhrases(info.applied, ctx);
  if (phrases.length === 0) return null;
  const overridden = overriddenRequests(info.applied, f.organizerFixed);
  const slots: Record<string, string> = { ...changeSlots(phrases), where: wherePhrase(hotspots[0], f.venue, f.specs) };
  let draft =
    info.purpose === "fix_validation"
      ? `That layout didn't fit the site rules, so I'll ${changeRefs(phrases)}.`
      : info.applied.every((x) => x.action.type === "widen_aisle_at_hotspot")
        ? `Next, I'll ${changeRefs(phrases)}, where the crowd still builds up.`
        : `Next, I'll ${changeRefs(phrases)}, because the crowd builds up {where}.`;
  if (overridden.length) {
    const unpinned = new Set(info.applied.flatMap((a) => (a.action.type === "unpin_booth" ? [a.action.booth_id] : [])));
    if (overridden.length === unpinned.size && overridden.every((id) => unpinned.has(id))) {
      draft += " The organizer asked for those spots, so this needs your approval.";
    } else {
      slots.requested = boothsPhrase(overridden, f.specs);
      draft += " The organizer asked for fixed spots for {requested}, so this needs your approval.";
    }
  }
  const booths = [
    ...new Set(
      info.applied.flatMap((a) => ("booth_id" in a.action ? [a.action.booth_id] : [])),
    ),
  ];
  return {
    line: {
      moment: "revising",
      purpose:
        info.purpose === "fix_validation"
          ? "Explain that the layout broke a site rule and what you will loosen to make it fit."
          : "Say what you will change next and why (where the crowd builds up).",
      slots,
      draft,
    },
    meta: {
      tone: overridden.length ? "warn" : "neutral",
      iteration: info.iteration,
      ...(booths.length ? { booth_ids: booths } : {}),
      ...(overridden.length ? { needs_approval: true } : {}),
    },
  };
}

export function revisedLine(
  f: NarrationFacts,
  args: { iteration: number; previous: Metrics; current: Metrics; valid: boolean; completionOk: boolean; movedBoothIds: string[]; targetMet: boolean },
): { line: NarrationLine; meta: SayMeta } {
  const b = args.previous.crowded_s_per_visitor;
  const a = args.current.crowded_s_per_visitor;
  const slots: Record<string, string> = { before: secs(b), after: secs(a), target: secs(f.targets.crowded_s_per_visitor) };
  let draft: string;
  let tone: SayInfo["tone"];
  if (!args.valid) {
    slots.problems = String(args.current.violations);
    draft = args.current.truncated
      ? "The visitor test of this layout was cut short, so I can't compare it fairly."
      : "This layout still breaks {problems} of the site rules, so I won't count it.";
    tone = "warn";
  } else if (!args.completionOk) {
    draft = "Crowding went from {before} to {after} per visitor, but fewer visitors made it through, so that doesn't count as better.";
    tone = "warn";
  } else if (a < b) {
    slots.drop = b > 0 ? percent((b - a) / b) : "0%";
    draft = "That helped: crowding dropped from {before} to {after} per visitor ({drop} less).";
    if (args.targetMet) draft += " That meets the goal of {target} or less.";
    tone = "good";
  } else {
    draft = "That didn't help: crowding went from {before} to {after} per visitor.";
    tone = "warn";
  }
  return {
    line: {
      moment: "revised",
      purpose: "Tell the effect of the last change, before and after, in plain numbers.",
      slots,
      draft,
    },
    meta: { tone, iteration: args.iteration, ...(args.movedBoothIds.length ? { booth_ids: args.movedBoothIds } : {}) },
  };
}

export function resultLine(
  f: NarrationFacts,
  args: {
    failed: boolean;
    baseline: Metrics | null;
    final: Metrics | null;
    baselineIteration: number;
    finalIteration: number;
    approvalBoothIds: string[];
  },
): { line: NarrationLine; meta: SayMeta } {
  const slots: Record<string, string> = { target: secs(f.targets.crowded_s_per_visitor) };
  let draft: string;
  let tone: SayInfo["tone"] = "good";
  const { baseline: b, final: fm } = args;
  if (!b || !fm) {
    draft = "Something went wrong before I could test a layout, so there's no result yet. Please try again.";
    tone = "warn";
  } else {
    slots.before = secs(b.crowded_s_per_visitor);
    slots.after = secs(fm.crowded_s_per_visitor);
    const met = fm.crowded_s_per_visitor <= f.targets.crowded_s_per_visitor && fm.violations === 0;
    const prefix = args.failed ? "Something went wrong partway through, so I stopped early. " : "";
    if (args.finalIteration !== args.baselineIteration && fm.crowded_s_per_visitor < b.crowded_s_per_visitor) {
      slots.drop = percent((b.crowded_s_per_visitor - fm.crowded_s_per_visitor) / b.crowded_s_per_visitor);
      draft = `${prefix}Crowding dropped {drop} ({before} → {after} per visitor).`;
      draft += met ? " This layout is ready for your review." : " It's still above the goal of {target}, so look it over closely before you use it.";
    } else if (met) {
      draft = `${prefix}The first layout already works well: the average visitor spends only {after} in crowds. It's ready for your review.`;
    } else {
      draft = `${prefix}I couldn't improve on the first layout ({before} in crowds per visitor). You could try another gate as the main entrance or fewer booths near it.`;
      tone = "warn";
    }
    if (args.failed) tone = "warn";
  }
  const meta: SayMeta = { tone, iteration: args.finalIteration };
  if (args.approvalBoothIds.length) {
    slots.requested = boothsPhrase(args.approvalBoothIds, f.specs);
    draft += " Before you use it, please approve moving {requested} away from the spots the organizer asked for.";
    meta.needs_approval = true;
    meta.booth_ids = args.approvalBoothIds;
  }
  return {
    line: { moment: "result", purpose: "Give the bottom line of the whole run and what the user should do next.", slots, draft },
    meta,
  };
}

/** "Ground slope and drainage not shown on site plan" → "ground slope and drainage". */
function unknownSubject(u: string): string | null {
  const m = u.match(/^(.*?)\s+(?:not shown on (?:the )?(?:site )?plan|unconfirmed|not specified|not confirmed|unknown)\.?$/i);
  if (!m) return null;
  return m[1][0].toLowerCase() + m[1].slice(1);
}

export function unknownCaution(u: string): NarrationLine {
  const subject = unknownSubject(u);
  return {
    moment: "caution",
    purpose: "Point out something the site plan does not confirm, and ask the user to check it on site.",
    slots: subject ? { item: subject } : { item: u.replace(/\.$/, "") },
    draft: subject ? "The site plan doesn't confirm {item}. Please check it before the event." : "Still to confirm: {item}. Please check it before the event.",
  };
}

export const truncatedCaution = (): NarrationLine => ({
  moment: "caution",
  purpose: "Warn that one visitor test ran out of time, so its numbers are left out of the comparison.",
  slots: {},
  draft: "One of the visitor tests ran out of time before it finished, so I left its numbers out of the comparison.",
});

export const failedCaution = (): NarrationLine => ({
  moment: "caution",
  purpose: "Warn that the run stopped because of a technical problem, so the result is incomplete.",
  slots: {},
  draft: "This run stopped because of a technical problem, so the result is incomplete. Please run it again before relying on it.",
});

export const remainingProblemsCaution = (n: number): NarrationLine => ({
  moment: "caution",
  purpose: "Warn that the final layout still breaks some site rules.",
  slots: { problems: String(n) },
  draft: "The final layout still breaks {problems} of the site rules. Please review those spots before you use it.",
});

export const mockEngineCaution = (): NarrationLine => ({
  moment: "caution",
  purpose: "Say that these numbers come from a quick stand-in for the visitor simulation, not the full one.",
  slots: {},
  draft: "These numbers come from a quick stand-in for the visitor test, not the full simulation, so treat them as a rough preview.",
});

// ---------- the narrator the loop uses ----------

/**
 * Sends lines to the LLM in one call, resolves each template through the numbers guard and emits
 * one `say` per line, in order. Never throws: any model failure (error, timeout, call cap, wrong
 * count) uses the drafts.
 */
export function createNarrator(llm: AgentLLM, emit: Emit, opts: { timeoutMs?: number } = {}) {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  return async function say(items: { line: NarrationLine; meta: SayMeta }[]): Promise<SayInfo[]> {
    if (items.length === 0) return [];
    let templates: string[] | undefined;
    let by = "stub";
    try {
      const res = await Promise.race([
        llm.narrate({ lines: items.map((i) => i.line) }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("narration timed out")), timeoutMs).unref?.()),
      ]);
      if (res.templates.length === items.length) {
        templates = res.templates;
        by = res.by;
      }
    } catch {
      // drafts below
    }
    const out: SayInfo[] = [];
    items.forEach(({ line, meta }, i) => {
      const r = resolveLine(line, templates?.[i], by);
      const info: SayInfo = { moment: line.moment, text: r.text, ...meta, by: r.by };
      out.push(info);
      emit({ type: "say", data: info });
    });
    return out;
  };
}
