/**
 * AgentLLM backed by a real model through the AI SDK (v7).
 *
 * - Structured outputs (analysis, revision) use a *forced function tool*
 *   (`toolChoice: { type: 'tool', toolName }`, no `execute`) and read
 *   `result.toolCalls[0].input`. This only needs OpenAI-style function calling,
 *   which the Meta Model API supports, rather than json_schema response formats.
 *   Inputs are validated by the tool's zod schema and again by our own schemas.
 * - The report prose streams via `streamText(...).textStream`.
 */
import { generateText, streamText, tool, type LanguageModel, type ToolSet } from "ai";
import { DesignBriefToolInput, normalizeBrief } from "./brief";
import { AnalysisOutput, type AgentLLM } from "./llm";
import { normalizeRevision, RevisionToolInput } from "./revision";

const SYSTEM = `You are the layout reviewer inside an autonomous event-layout tool.
A deterministic engine generates booth layouts, validates them, and simulates pedestrians.
You only exercise judgment: explain likely causes of congestion and propose constraint-level changes.
Rules:
- Never invent or estimate metrics; every number you see comes from the engine. Do not restate numbers you were not given.
- Units are meters and seconds; coordinates have origin at the hall's bottom-left, y up.
- Prefer few, targeted changes that keep the rest of the layout stable.
- Booths and doors are referred to by id.`;

const REVISION_GUIDE = `Available actions (use the "type" field and only the fields that action needs):
- move_booth {booth_id, direction: away_from_entrance|away_from_hotspot|north|south|east|west, distance_m 1..20, hotspot_index?}: shift a booth's anchor; the solver places it as close as feasible.
- pin_booth {booth_id} / unpin_booth {booth_id}: keep a booth where it is / release it.
- widen_aisle_at_hotspot {hotspot_index, margin_m 0..3}: keep the hotspot zone (plus margin) free of booths.
- add_keep_out {rect:{x,y,w,h}} / remove_keep_out {index}
- set_popular_door_distance {value m}: popular booths (popularity >= popular_threshold) must stay this far from entrances.
- set_popular_threshold {value 0..1}, set_min_aisle_width {value 1.2..6 m}, set_door_clearance {value 0..15 m}`;

const BRIEF_GUIDE = `You are writing the design brief for an EMPTY site, before any layout exists.
State intent only; a CP-SAT solver (OR-Tools) computes every booth coordinate from your constraints.
Fields (all optional except rationale; omit what should stay at the default):
- min_aisle_width (1.2..6 m), door_clearance (0..15 m)
- popular_threshold (0..1) and popular_door_distance (0..40 m): popular booths stay that far from entrances
- keep_clear_at_doors [{door_id, depth_m 1..20, width_m 1..40}]: open areas in front of doors/gates (arrival plazas, queue space)
- keep_out [{x,y,w,h}]: other areas no booth may use (meters, origin bottom-left, y up)
- place_near_door [{booth_id, door_id}]: booths that belong beside a door, e.g. a ticket kiosk at the main gate
Unbuildable zones (e.g. fire lanes) are enforced by the engine already. Prefer few, well-justified choices.`;

export function createModelLLM(model: LanguageModel, name: string, opts: { timeoutMs?: number } = {}): AgentLLM {
  const timeout = opts.timeoutMs ?? 60_000;

  const analysisTool = tool({
    description: "Submit your bottleneck analysis of the latest simulation.",
    inputSchema: AnalysisOutput,
  });
  const revisionTool = tool({
    description: "Submit the constraint/layout changes for the next iteration.",
    inputSchema: RevisionToolInput,
  });

  const briefTool = tool({
    description: "Submit the design brief: initial layout constraints for the empty site.",
    inputSchema: DesignBriefToolInput,
  });

  async function forcedToolCall(toolName: "submit_analysis" | "propose_revision" | "submit_design_brief", prompt: string): Promise<unknown> {
    const tools: ToolSet =
      toolName === "submit_analysis"
        ? { submit_analysis: analysisTool }
        : toolName === "submit_design_brief"
          ? { submit_design_brief: briefTool }
          : { propose_revision: revisionTool };
    const result = await generateText({
      model,
      instructions: SYSTEM,
      prompt,
      tools,
      toolChoice: { type: "tool", toolName },
      temperature: 0.2,
      maxRetries: 2,
      timeout,
    });
    const call = result.toolCalls.find((c) => c.toolName === toolName);
    if (!call) throw new Error(`model did not call ${toolName} (finishReason=${result.finishReason})`);
    return call.input;
  }

  return {
    name,

    async designBrief({ site }) {
      const input = await forcedToolCall(
        "submit_design_brief",
        [
          "Site and booths to place (computed by code from the venue file):",
          JSON.stringify(site),
          BRIEF_GUIDE,
          "Write the design brief. Call submit_design_brief.",
        ].join("\n\n"),
      );
      return normalizeBrief(input);
    },

    async analyze({ summary, previous }) {
      const input = await forcedToolCall(
        "submit_analysis",
        [
          "Latest iteration (engine output, summarized):",
          JSON.stringify(summary),
          previous ? `Previous iteration for comparison:\n${JSON.stringify(previous)}` : "This is the baseline iteration.",
          "Explain the likely causes of each hotspot (by index), naming the booths and doors involved. Call submit_analysis.",
        ].join("\n\n"),
      );
      return AnalysisOutput.parse(input);
    },

    async revise({ summary, analysis, history }) {
      const input = await forcedToolCall(
        "propose_revision",
        [
          "Latest iteration (engine output, summarized):",
          JSON.stringify(summary),
          `Your analysis:\n${JSON.stringify(analysis)}`,
          history.length ? `Changes already tried this run:\n${JSON.stringify(history)}` : "No changes tried yet.",
          REVISION_GUIDE,
          "Propose 1-3 changes most likely to lower peak density without creating validation errors. Do not repeat a change that did not help. Call propose_revision.",
        ].join("\n\n"),
      );
      return normalizeRevision(input);
    },

    async proposeFixes({ summary, attempt }) {
      const input = await forcedToolCall(
        "propose_revision",
        [
          `The generated layout failed validation (fix attempt ${attempt + 1}).`,
          JSON.stringify(summary),
          REVISION_GUIDE,
          "Propose the smallest constraint changes that resolve the error-severity violations (e.g. unpin a conflicting booth, remove a keep-out that makes the problem infeasible, relax popular_door_distance). zone_unbuildable / fire_lane_blocked mean a booth stands on an unbuildable zone or breaks the fire lane: unpin it or free up buildable room. Call propose_revision.",
        ].join("\n\n"),
      );
      return normalizeRevision(input);
    },

    async reportNarrative(input, onDelta) {
      const result = streamText({
        model,
        instructions: SYSTEM,
        prompt: [
          "Write the Summary section (2-3 short paragraphs, markdown, no heading) of a layout review report for a human reviewer.",
          "Explain what the agent found, what it changed and why, and what the reviewer should double-check.",
          "Do NOT include any numbers or metric values: the before/after table, iteration history and assumptions are inserted by code right after your text.",
          `Context:\n${JSON.stringify({ ...input, baseline: undefined, final: undefined })}`,
        ].join("\n\n"),
        temperature: 0.3,
        maxRetries: 2,
        timeout,
        onError: ({ error }) => {
          streamError = error;
        },
      });
      let streamError: unknown = null;
      let text = "";
      for await (const delta of result.textStream) {
        text += delta;
        onDelta(delta);
      }
      if (streamError) throw streamError instanceof Error ? streamError : new Error(String(streamError));
      if (!text.trim()) throw new Error("model returned an empty report narrative");
      return text;
    },
  };
}
