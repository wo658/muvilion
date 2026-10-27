/**
 * UI-side FALLBACK for Muse's plain-language messages (`say` data parts).
 *
 * The agent loop emits `say` events itself (lib/agent, SayInfo). Older recordings and runs that
 * predate that do not, so the simple view synthesizes simple messages from the technical events
 * here — used ONLY when a stream carries no `say` parts at all (see `museMessages`). Every number
 * comes from the run's own results. Keep this file separate from the real narration so it can be
 * deleted once every stream carries `say` parts.
 */
import type { AgentEvent, RevisionInfo, RunInfo, SayInfo } from "@/lib/agent/events";
import type { RevisionAction } from "@/lib/agent/revision";
import type { BriefItem } from "@/lib/agent/brief";
import { boothNames, formatSeconds, headline, joinAnd, nameList, venueShortName } from "./plain";

export const FALLBACK_BY = "ui-fallback";

/** Muse's messages for a stream: its own `say` parts if it has any, otherwise the fallback. */
export function museMessages(events: AgentEvent[]): SayInfo[] {
  const said = events.flatMap((e) => (e.type === "say" ? [e.data] : []));
  return said.length > 0 ? said : synthesizeSay(events);
}

const DIRECTION: Record<string, string> = { north: "north", south: "south", east: "east", west: "west" };

function briefPhrase(item: BriefItem, run: RunInfo): string | null {
  const names = (ids: string[]) => nameList(boothNames(ids, run.booths));
  const door = (id: string) => run.venue.doors.find((d) => d.id === id);
  switch (item.type) {
    case "set_min_aisle_width":
      return `keep walkways at least ${item.value} m wide`;
    case "set_door_clearance":
      return `leave ${item.value} m clear in front of every ${run.venue.setting === "outdoor" ? "gate" : "door"}`;
    case "place_near_door": {
      const d = door(item.door_id);
      const where = d?.kind === "entrance" ? (run.venue.setting === "outdoor" ? "the main gate" : "the main entrance") : "a door";
      return `put ${names([item.booth_id])} next to ${where}`;
    }
    case "set_popular_door_distance":
      return "keep the most popular booths away from the entrance";
    case "keep_clear_at_door":
    case "add_keep_out":
      return "keep a busy spot clear of booths";
    default:
      return null;
  }
}

function actionPhrase(a: RevisionAction, run: RunInfo): string | null {
  const names = (ids: string[]) => nameList(boothNames(ids, run.booths));
  switch (a.type) {
    case "move_booth":
      return `move ${names([a.booth_id])} about ${Math.round(a.distance_m)} m ${DIRECTION[a.direction] ?? a.direction}`;
    case "unpin_booth":
      return `let ${names([a.booth_id])} move`;
    case "pin_booth":
      return `keep ${names([a.booth_id])} where it is`;
    case "widen_aisle_at_hotspot":
      return "keep the busiest walkway clear so it is wider";
    case "add_keep_out":
      return "keep a busy spot clear of booths";
    case "remove_keep_out":
      return "give back a spot I had kept clear";
    case "set_popular_door_distance":
      return "keep the most popular booths farther from the entrance";
    case "set_popular_threshold":
      return "treat a few more booths as popular";
    case "set_min_aisle_width":
      return `widen the walkways to ${a.value} m`;
    case "set_door_clearance":
      return `leave ${a.value} m clear at the doors`;
    default:
      return null;
  }
}

/** Booths a revision touches. */
function revisionBooths(r: RevisionInfo): string[] {
  return [...new Set(r.applied.flatMap((x) => ("booth_id" in x.action ? [x.action.booth_id] : [])))];
}

/** Organizer-requested booths (pinned in the input) that a revision releases: those need approval. */
export function releasedOrganizerPins(r: RevisionInfo, run: RunInfo): string[] {
  const pinned = run.initialConstraints.fixed ?? {};
  return r.applied.flatMap((x) => (x.action.type === "unpin_booth" && x.action.booth_id in pinned ? [x.action.booth_id] : []));
}

export function describeRevision(r: RevisionInfo, run: RunInfo): string {
  const released = releasedOrganizerPins(r, run);
  const unpinned = r.applied.flatMap((x) => (x.action.type === "unpin_booth" ? [x.action.booth_id] : []));
  const phrases: string[] = [];
  if (released.length) phrases.push(`let ${nameList(boothNames(released, run.booths))} move away from the spots the organizer asked for`);
  const others = unpinned.filter((id) => !released.includes(id));
  if (others.length) phrases.push(`let ${nameList(boothNames(others, run.booths))} move too`);
  for (const x of r.applied) {
    if (x.action.type === "unpin_booth") continue;
    const p = actionPhrase(x.action, run);
    if (p && !phrases.includes(p)) phrases.push(p);
  }
  return joinAnd(phrases);
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function synthesizeSay(events: AgentEvent[]): SayInfo[] {
  const out: SayInfo[] = [];
  const run = events.find((e) => e.type === "run")?.data as RunInfo | undefined;
  if (!run) return out;
  const say = (m: Omit<SayInfo, "by">) => {
    out.push({ ...m, by: FALLBACK_BY });
    return out[out.length - 1];
  };
  const names = (ids: string[]) => nameList(boothNames(ids, run.booths));
  const visitors = run.scenario.agents;
  /** "simulated" message per iteration, extended when the analysis arrives. */
  const simMsg = new Map<number, SayInfo>();

  say({
    moment: "intro",
    text: `I'm planning ${run.booths.length} booths for ${venueShortName(run.venue.name)}. First I'll look over the space.`,
    tone: "neutral",
  });

  for (const e of events) {
    switch (e.type) {
      case "brief": {
        const phrases = [...new Set(e.data.items.map((i) => briefPhrase(i, run)).filter((p): p is string => Boolean(p)))];
        say({
          moment: "brief",
          text: phrases.length
            ? `Here's my plan: I'll ${joinAnd(phrases)}.`
            : "The space looks straightforward, so I'll start with standard walkway widths and see how people move.",
          tone: "neutral",
        });
        break;
      }
      case "layout": {
        const { iteration, moves } = e.data;
        if (iteration === 0) {
          if (e.data.attempt === 0)
            say({
              moment: "placed",
              iteration: 0,
              text: `All ${e.data.response.layout.booths.length} booths have a spot. Next I'll send ${visitors} virtual visitors through to see where it gets crowded.`,
              tone: "neutral",
            });
        } else {
          const moved = moves.map((m) => m.booth_id);
          if (!moved.length) break; // nothing visible changed (e.g. an attempt that is fixed right after)
          const who = moved.length <= 4 ? `${names(moved)} ${moved.length === 1 ? "has" : "have"} a new spot` : `${moved.length} booths have new spots`;
          const text = `Here's the new layout: ${who}. Testing it with the same ${visitors} visitors.`;
          say({ moment: "revised", iteration, text, tone: "neutral", booth_ids: moved });
        }
        break;
      }
      case "comparison": {
        const { iteration, metrics } = e.data;
        const base = e.data.baseline.crowded_s_per_visitor;
        const now = metrics.crowded_s_per_visitor;
        let text: string;
        let tone: SayInfo["tone"] = "neutral";
        if (iteration === 0) {
          text = `In this first layout, a typical visitor spends ${formatSeconds(now)} squeezed in crowds.`;
        } else {
          const h = headline(base, now);
          tone = h.tone === "good" ? "good" : h.tone === "warn" ? "warn" : "neutral";
          text =
            h.tone === "good"
              ? `Better: time in crowds is down to ${h.after} per visitor (from ${h.before}).`
              : `That didn't help: time in crowds is ${h.after} per visitor (it was ${h.before}).`;
        }
        const m = say({ moment: "simulated", iteration, text, tone });
        simMsg.set(iteration, m);
        break;
      }
      case "analysis": {
        const m = simMsg.get(e.data.iteration);
        const ids = [...new Set(e.data.causes.flatMap((c) => c.booth_ids))].slice(0, 4);
        if (m && ids.length) {
          m.text += ` It gets most crowded around ${names(ids)}.`;
          m.booth_ids = ids;
        }
        break;
      }
      case "revision": {
        const r = e.data;
        const plan = describeRevision(r, run);
        const released = releasedOrganizerPins(r, run);
        const lead =
          r.purpose === "fix_validation" ? "That version didn't quite fit, so I'll" : "To spread people out, I'd like to";
        let text = plan ? `${lead} ${plan}.` : capital(`${lead} adjust the layout.`);
        if (released.length) text += " Those spots were requested, so this needs your OK.";
        say({
          moment: "revising",
          iteration: r.iteration,
          text,
          tone: released.length ? "warn" : "neutral",
          booth_ids: revisionBooths(r),
          needs_approval: released.length > 0 || undefined,
        });
        break;
      }
      case "error": {
        if (!e.data.recoverable)
          say({ moment: "caution", text: "Something went wrong on my side, so I had to stop early. You can try again.", tone: "warn" });
        break;
      }
      case "done": {
        const d = e.data;
        if (d.status === "error" || !d.baseline) break;
        const final = d.final ?? d.baseline;
        const h = headline(d.baseline.crowded_s_per_visitor, final.crowded_s_per_visitor);
        const improved = d.finalIteration !== d.baselineIteration && h.tone === "good";
        say({
          moment: "result",
          iteration: d.finalIteration,
          text: improved
            ? `All set. Time in crowds per visitor went from ${h.before} to ${h.after} (${h.change}). This is the layout I'd use.`
            : d.stopReason === "target_met"
              ? `The first layout already works well: only ${h.before} in crowds per visitor. This is the layout I'd use.`
              : `I couldn't beat the first layout, so I'd keep it: ${h.before} in crowds per visitor.`,
          tone: improved || d.stopReason === "target_met" ? "good" : "neutral",
        });
        if (final.completed_fraction < 0.9)
          say({
            moment: "caution",
            iteration: d.finalIteration,
            text: `In the test, ${Math.round(final.completed_fraction * 100)}% of visitors finished their visit in the time given. Check that the event hours suit your crowd.`,
            tone: "warn",
          });
        if (final.warnings > 0)
          say({
            moment: "caution",
            iteration: d.finalIteration,
            text: `There ${final.warnings === 1 ? "is 1 small thing" : `are ${final.warnings} small things`} to double-check on site. Open Details to see them.`,
            tone: "warn",
          });
        break;
      }
    }
  }
  return out;
}
