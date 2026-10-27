/**
 * Events emitted by the agent loop. Each maps 1:1 onto a typed custom data part
 * of the AI SDK UI message stream (`data-<type>`), except `report-delta`, which
 * is streamed as ordinary text parts so the report renders while it is written.
 *
 * The replay recording stores this exact event list, so live and replay runs go
 * through the same encoder and the UI cannot tell them apart.
 */
import type { UIMessage } from "ai";
import type {
  BoothSpec,
  LayoutConstraints,
  LayoutResponse,
  Point,
  Rect,
  Scenario,
  SimResult,
  ValidateResponse,
  Venue,
} from "@/lib/engine/contract";
import type { AppliedAction, RejectedAction, RevisionAction } from "./revision";

export const STEP_NAMES = ["generate", "validate", "simulate", "compare", "analyze", "revise", "report"] as const;
export type StepName = (typeof STEP_NAMES)[number];

export type Metrics = {
  max_density: number;
  p90_travel_time_s: number;
  mean_travel_time_s: number;
  completed_fraction: number;
  /** Validation errors (engine /validate + agent-side checks). */
  violations: number;
  warnings: number;
  hotspots: number;
  /** Engine hit max_wall_time_s: partial, non-reproducible, excluded from comparison. */
  truncated: boolean;
};

export type Targets = {
  /** Stop when max peak density (p/m^2) is at or below this and there are no errors. */
  max_density: number;
  /** Relative improvement in max density below which an iteration counts as "no improvement". */
  min_improvement: number;
};

export type RunInfo = {
  runId: string;
  mode: "live" | "replay";
  startedAt: string;
  venue: Venue;
  booths: BoothSpec[];
  initialConstraints: LayoutConstraints;
  /** Locked for the whole run (identical-conditions guarantee). */
  scenario: Scenario;
  gridCell: number;
  scenarioFingerprint: string;
  targets: Targets;
  maxIterations: number;
  engine: "mock" | "http";
  llm: string;
};

export type StepStatus = "running" | "done" | "error" | "skipped";
export type StepInfo = {
  id: string;
  iteration: number;
  step: StepName;
  status: StepStatus;
  title: string;
  detail?: string;
};

export type BoothMove = { booth_id: string; from: Point; to: Point };

export type LayoutInfo = {
  iteration: number;
  attempt: number;
  constraints: LayoutConstraints;
  hasPrevious: boolean;
  response: LayoutResponse;
  /** Booths whose position changed vs. the previous iteration's accepted layout. */
  moves: BoothMove[];
};

export type ValidationInfo = {
  iteration: number;
  attempt: number;
  result: ValidateResponse;
  errors: number;
  warnings: number;
};

/**
 * SimulateRequest fields not otherwise in the stream, so the UI can rebuild the exact request
 * (venue/booths from data-run, layout from data-layout, scenario from the result) and fetch the
 * matching /trajectories (same run_id). Never carries trajectories themselves.
 */
export type SimParams = { grid_cell: number; max_wall_time_s: number; trajectory_dt: number };
export type SimInfo = { iteration: number; result: SimResult; metrics: Metrics; params: SimParams };

export type HotspotCause = { hotspot_index: number; cause: string; booth_ids: string[] };
export type AnalysisInfo = { iteration: number; summary: string; causes: HotspotCause[]; by: string };

export type RevisionInfo = {
  /** Iteration whose result motivated the revision. */
  iteration: number;
  purpose: "fix_validation" | "improve";
  rationale: string;
  actions: RevisionAction[];
  applied: AppliedAction[];
  rejected: RejectedAction[];
  constraints: LayoutConstraints;
  keepOut: Rect[];
  by: string;
};

export type Decision = "continue" | "target_met" | "no_improvement" | "max_iterations" | "stopped";
export type ComparisonInfo = {
  iteration: number;
  metrics: Metrics;
  valid: boolean;
  previous: Metrics | null;
  baseline: Metrics;
  bestIteration: number;
  decision: Decision;
  reason: string;
};

export type ReportInfo = { markdown: string; baselineIteration: number; finalIteration: number };

export type DoneInfo = {
  status: "completed" | "error";
  stopReason: Decision | "error";
  iterations: number;
  baselineIteration: number;
  finalIteration: number;
  baseline: Metrics | null;
  final: Metrics | null;
};

export type ErrorInfo = { message: string; iteration?: number; step?: StepName; recoverable: boolean };

/** Data part payloads, keyed by data part name (`data-<name>` on the wire). */
export type AgentDataParts = {
  run: RunInfo;
  step: StepInfo;
  layout: LayoutInfo;
  validation: ValidationInfo;
  sim: SimInfo;
  analysis: AnalysisInfo;
  revision: RevisionInfo;
  comparison: ComparisonInfo;
  report: ReportInfo;
  done: DoneInfo;
  error: ErrorInfo;
};

export type AgentUIMessage = UIMessage<never, AgentDataParts>;

export type AgentEvent =
  | { [K in keyof AgentDataParts]: { type: K; data: AgentDataParts[K] } }[keyof AgentDataParts]
  | { type: "report-delta"; delta: string };

export type Emit = (e: AgentEvent) => void;

export function stepId(iteration: number, step: StepName, attempt = 0): string {
  return `step-${iteration}-${step}-${attempt}`;
}
