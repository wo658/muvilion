/**
 * The judgment-only interface between the code-controlled loop and an LLM.
 * Implementations: `createStubLLM` (deterministic rules, no key) and
 * `createModelLLM` (AI SDK + OpenAI-compatible provider).
 */
import { z } from "zod";
import type { IterationSummary } from "./analysis";
import type { AnalysisInfo, Metrics, RevisionInfo } from "./events";
import type { Brief, SiteSummary } from "./brief";
import type { RejectedAction, Revision } from "./revision";

export const AnalysisOutput = z.object({
  summary: z.string().describe("2-4 sentences: what limits pedestrian flow and why. No invented numbers."),
  causes: z
    .array(
      z.object({
        hotspot_index: z.number().int().min(0),
        cause: z.string().describe("Likely cause, referring to booths/doors by id"),
        booth_ids: z.array(z.string()),
      }),
    )
    .max(6),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutput>;

export type AnalyzeInput = { summary: IterationSummary; previous: IterationSummary | null };

export type ReviseInput = {
  summary: IterationSummary;
  analysis: AnalysisOutput;
  /** Earlier revisions this run, so the model does not repeat what did not help. */
  history: Pick<RevisionInfo, "iteration" | "purpose" | "rationale" | "applied">[];
};

export type FixInput = { summary: IterationSummary; attempt: number };

export type ReportNarrativeInput = {
  venueName: string;
  stopReason: string;
  baselineIteration: number;
  finalIteration: number;
  baseline: Metrics;
  final: Metrics;
  revisions: Pick<RevisionInfo, "iteration" | "purpose" | "rationale" | "applied">[];
  analyses: Pick<AnalysisInfo, "iteration" | "summary">[];
  unknowns: string[];
  /** The design brief's reasoning and the constraint choices code applied from it. */
  brief: { rationale: string; applied: string[] } | null;
};

export type RevisionResult = { revision: Revision; rejected: RejectedAction[] };

export type BriefInput = { site: SiteSummary };
export type BriefResult = { brief: Brief; rejected: RejectedAction[] };

export interface AgentLLM {
  /** Short id shown in the UI, e.g. "stub" or "meta:muse-spark-1.3". */
  readonly name: string;
  /** Read the empty site and booth list; state initial layout intent (constraints, not coordinates). */
  designBrief(input: BriefInput): Promise<BriefResult>;
  analyze(input: AnalyzeInput): Promise<AnalysisOutput>;
  revise(input: ReviseInput): Promise<RevisionResult>;
  proposeFixes(input: FixInput): Promise<RevisionResult>;
  /** Prose sections of the report. Must not state metric values; tables are inserted by code. */
  reportNarrative(input: ReportNarrativeInput, onDelta: (text: string) => void): Promise<string>;
}

/** Enforces a per-run cap on LLM calls (AGENT_MAX_LLM_CALLS). */
export function withCallCap(llm: AgentLLM, maxCalls: number): AgentLLM & { calls(): number } {
  let calls = 0;
  const tick = () => {
    calls++;
    if (calls > maxCalls) throw new Error(`LLM call cap reached (AGENT_MAX_LLM_CALLS=${maxCalls})`);
  };
  return {
    name: llm.name,
    calls: () => calls,
    designBrief: async (i) => (tick(), llm.designBrief(i)),
    analyze: async (i) => (tick(), llm.analyze(i)),
    revise: async (i) => (tick(), llm.revise(i)),
    proposeFixes: async (i) => (tick(), llm.proposeFixes(i)),
    reportNarrative: async (i, d) => (tick(), llm.reportNarrative(i, d)),
  };
}

/**
 * Falls back to `fallback` when `primary` throws (bad tool call, provider error),
 * reporting the failure so the UI can show that the rule-based reviser stepped in.
 */
export function withFallback(primary: AgentLLM, fallback: AgentLLM, onFallback: (what: string, err: unknown) => void): AgentLLM {
  const wrap =
    <A extends unknown[], R>(what: string, p: (...a: A) => Promise<R>, f: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      try {
        return await p(...a);
      } catch (err) {
        onFallback(what, err);
        return f(...a);
      }
    };
  return {
    name: primary.name,
    designBrief: wrap("designBrief", (i) => primary.designBrief(i), (i) => fallback.designBrief(i)),
    analyze: wrap("analyze", (i) => primary.analyze(i), (i) => fallback.analyze(i)),
    revise: wrap("revise", (i) => primary.revise(i), (i) => fallback.revise(i)),
    proposeFixes: wrap("proposeFixes", (i) => primary.proposeFixes(i), (i) => fallback.proposeFixes(i)),
    reportNarrative: wrap("reportNarrative", (i, d) => primary.reportNarrative(i, d), (i, d) => fallback.reportNarrative(i, d)),
  };
}
