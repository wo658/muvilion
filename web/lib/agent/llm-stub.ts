/**
 * Deterministic rule-based "LLM" (AGENT_LLM=stub). Used for tests, for recording
 * the replay fixture, and as a fallback when the live model misbehaves.
 * It only ever emits the same structured outputs a real model would.
 */
import { normalizeBrief, ruleBasedBrief } from "./brief";
import type { AgentLLM, AnalysisOutput } from "./llm";
import { normalizeRevision, type RevisionToolInput } from "./revision";

type RawAction = RevisionToolInput["actions"][number];

function chunks(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

export function createStubLLM(): AgentLLM {
  return {
    name: "stub",

    async designBrief({ site }) {
      return normalizeBrief(ruleBasedBrief(site));
    },

    async analyze({ summary }) {
      const hs = summary.hotspots;
      if (hs.length === 0) {
        return { summary: "No crowding hotspots above the engine threshold were reported for this layout.", causes: [] };
      }
      const causes: AnalysisOutput["causes"] = hs.slice(0, 3).map((h) => {
        const popular = h.nearby_booths.filter((b) => (b.popularity ?? 0) >= summary.constraints.popular_threshold);
        const busy = h.nearby_booths.filter((b) => (b.popularity ?? 0) >= 0.6);
        const nearEntrance = h.distance_to_entrance_m < 10;
        const cause =
          popular.length > 0
            ? `High-attraction booth ${popular.map((b) => b.id).join(", ")} draws visitors into this zone${nearEntrance ? " right where the entrance inflow arrives, so arriving and browsing crowds overlap" : ""}.`
            : busy.length > 0
              ? `Moderately popular booths ${busy.map((b) => b.id).join(", ")} border the same aisle, so their visitor queues stack up.`
              : nearEntrance
                ? "Entrance inflow concentrates here before visitors disperse into the aisles."
                : "Several booths share a narrow aisle segment here.";
        return { hotspot_index: h.index, cause, booth_ids: (popular.length ? popular : busy).map((b) => b.id) };
      });
      const top = hs[0];
      return {
        summary: `The worst congestion is hotspot #0${top.distance_to_entrance_m < 10 ? ", close to the main entrance" : ""}. ${causes[0].cause}`,
        causes,
      };
    },

    async revise({ summary, history }) {
      const c = summary.constraints;
      const top = summary.hotspots[0];
      const actions: RawAction[] = [];
      const movedBefore = new Set(
        history.flatMap((h) => h.applied.flatMap((a) => (a.action.type === "move_booth" ? [a.action.booth_id] : []))),
      );
      const popularNearTop = top?.nearby_booths.filter((b) => (b.popularity ?? 0) >= c.popular_threshold) ?? [];
      let rationale = "";
      const pinnedNearTop = popularNearTop.filter((b) => b.pinned);
      const popularPinned = summary.popular_booths.filter((b) => b.pinned).map((b) => b.id);
      const ids = popularNearTop.map((b) => b.id).join(", ");
      if (top && pinnedNearTop.length > 0) {
        // Pinned popular booths crowd the hotspot: only release their pins and let the solver
        // re-place them. No entrance-distance rule in the same step (on the real engine, adding it
        // pushed the released booths into a worse arrangement), so the remaining pins stay feasible.
        const release = pinnedNearTop.map((b) => b.id);
        for (const id of release) actions.push({ type: "unpin_booth", booth_id: id });
        rationale = `High-attraction booth${popularNearTop.length > 1 ? "s" : ""} ${ids} ${popularNearTop.length > 1 ? "are" : "is"} pinned where the hotspot forms; releasing the pin${release.length > 1 ? "s" : ""} lets the solver spread their visitor crowds. This releases the requested positions of ${release.join(", ")} (pinned by the input constraints), so it needs the organizer's approval.`;
      } else if (top && popularNearTop.length > 0 && c.popular_door_distance < 12) {
        // The entrance-distance rule applies to every popular booth, so popular booths pinned by the
        // input elsewhere must be released with it or the layout is infeasible.
        for (const id of popularPinned) actions.push({ type: "unpin_booth", booth_id: id });
        actions.push({ type: "set_popular_door_distance", value: 12 });
        rationale = `High-attraction booth${popularNearTop.length > 1 ? "s" : ""} ${ids} sit${popularNearTop.length > 1 ? "" : "s"} in the entrance inflow; requiring popular booths to keep a distance from entrances separates arriving visitors from booth crowds.`;
        if (popularPinned.length > 0) {
          rationale += ` This releases the requested positions of ${popularPinned.join(", ")} (pinned by the input constraints), so it needs the organizer's approval.`;
        }
      } else if (top) {
        const busy = [...top.nearby_booths]
          .filter((b) => !b.pinned && (b.popularity ?? 0) >= 0.6)
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        const pick = busy.find((b) => !movedBefore.has(b.id));
        if (pick && pick.position) {
          // Choose the compass direction that puts the booth farthest from the other popular booths.
          const others = summary.popular_booths.filter((b) => b.id !== pick.id && b.position).map((b) => b.position!);
          const dirs = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] } as const;
          let bestDir: keyof typeof dirs = "north";
          let bestScore = -Infinity;
          for (const [name, [dx, dy]] of Object.entries(dirs) as [keyof typeof dirs, readonly [number, number]][]) {
            const x = Math.min(Math.max(pick.position.x + dx * 6, 1), summary.hall.width_m - 4);
            const y = Math.min(Math.max(pick.position.y + dy * 6, 1), summary.hall.height_m - 4);
            const sep = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - x, o.y - y))) : 0;
            const moved = Math.hypot(x - pick.position.x, y - pick.position.y);
            const score = sep + moved * 0.5;
            if (score > bestScore) {
              bestScore = score;
              bestDir = name;
            }
          }
          actions.push({ type: "move_booth", booth_id: pick.id, direction: bestDir, distance_m: 6 });
          rationale = `Hotspot #0 persists next to ${pick.id}, which shares the zone with other high-attraction booths; moving it ${bestDir} separates their visitor crowds.`;
        } else {
          actions.push({ type: "widen_aisle_at_hotspot", hotspot_index: 0, margin_m: 0.5 });
          rationale = "No movable popular booth remains near hotspot #0, so the aisle around it is kept clear to widen it.";
        }
      } else {
        actions.push({ type: "set_min_aisle_width", value: Math.min(6, c.min_aisle_width + 0.5) });
        rationale = "No hotspot reported; widening aisles slightly for margin.";
      }
      return normalizeRevision({ rationale: rationale.trim(), actions });
    },

    async proposeFixes({ summary }) {
      const c = summary.constraints;
      const errors = summary.violations.filter((v) => v.severity === "error");
      const actions: RawAction[] = [];
      const pinned = new Set(Object.keys(c.fixed));
      for (const id of new Set(errors.flatMap((v) => v.booth_ids))) {
        if (pinned.has(id)) actions.push({ type: "unpin_booth", booth_id: id });
      }
      // Booths on an unbuildable zone / blocking the fire lane: pinned ones were unpinned above;
      // otherwise the constraints left too little buildable room, so relax like an infeasible solve.
      const zoneConflict = errors.some((v) => (v.rule_id === "zone_unbuildable" || v.rule_id === "fire_lane_blocked") && !v.booth_ids.some((b) => pinned.has(b)));
      const infeasible = zoneConflict || errors.some((v) => v.rule_id === "layout_infeasible" || v.rule_id === "booth_missing");
      if (infeasible || errors.some((v) => v.rule_id === "keep_out")) {
        if (c.keep_out.length > 0) actions.push({ type: "remove_keep_out", index: c.keep_out.length - 1 });
        else if (c.popular_door_distance > 0) actions.push({ type: "set_popular_door_distance", value: Math.max(0, c.popular_door_distance - 4) });
        else if (c.min_aisle_width > 2.4) actions.push({ type: "set_min_aisle_width", value: Math.max(2.4, c.min_aisle_width - 0.3) });
      }
      if (errors.some((v) => v.rule_id === "popular_door_distance") && c.popular_door_distance > 0) {
        actions.push({ type: "set_popular_door_distance", value: Math.max(0, c.popular_door_distance - 2) });
      }
      if (actions.length === 0) actions.push({ type: "set_min_aisle_width", value: Math.max(1.2, c.min_aisle_width - 0.2) });
      return normalizeRevision({
        rationale: `Relax or remove the constraints implicated in: ${errors.map((e) => e.rule_id).join(", ") || "none"}.`,
        actions: actions.slice(0, 8),
      });
    },

    async reportNarrative(input, onDelta) {
      const moved = input.revisions.filter((r) => r.purpose === "improve");
      const text = [
        (input.brief ? `Design brief: ${input.brief.rationale} ` : "") +
          `The solver placed the booths of ${input.venueName} under those constraints and the layout was simulated under one fixed scenario. ` +
          `${input.analyses[0]?.summary ?? "No hotspot analysis was needed."}`,
        "",
        moved.length > 0
          ? `Across ${moved.length} revision${moved.length > 1 ? "s" : ""} it kept the layout as stable as possible and changed only what the simulation pointed at: ` +
            moved.map((r) => r.rationale.replace(/\.$/, "")).join("; then ") +
            ". Each revised layout was re-validated and re-simulated with the identical scenario, so the before/after comparison below reflects layout changes only."
          : "No revision was applied.",
        "",
        `The run stopped because: ${input.stopReason}. Treat the result as a planning draft for human review; ` +
          "the items under Unconfirmed must be checked on site before the plan is relied on.",
      ].join("\n");
      for (const c of chunks(text)) onDelta(c);
      return text;
    },
  };
}
