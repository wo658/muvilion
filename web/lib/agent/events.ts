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
import type { BriefApplied, BriefItem } from "./brief";
import type { AppliedAction, RejectedAction, RevisionAction } from "./revision";

export const STEP_NAMES = ["brief", "generate", "validate", "simulate", "compare", "analyze", "revise", "report"] as const;
export type StepName = (typeof STEP_NAMES)[number];

export type Metrics = {
  /**
   * Primary metric (lower is better): seconds the average visitor spent in crowded cells
   * (density ≥ crowd_threshold), SimResult.congestion.crowded_s_per_visitor.
   */
  crowded_s_per_visitor: number;
  /** Total people × seconds in crowded cells. */
  crowded_person_s: number;
  /** Largest crowded area at any one moment (m²). */
  peak_crowded_area_m2: number;
  /** Highest run-mean density among the hotspots (p/m²). */
  worst_hotspot_mean_density: number;
  /** Density at or above which a grid cell counts as crowded (p/m²); locked per run. */
  crowd_threshold: number;
  /** Secondary: highest density any cell reached at any instant (p/m²). */
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
  /** Stop when crowded seconds per visitor is at or below this and there are no validation errors. */
  crowded_s_per_visitor: number;
  /** Relative reduction of crowded s/visitor vs best so far below which an iteration counts as "no improvement". */
  min_improvement: number;
  /**
   * An iteration whose completed fraction is more than this below the baseline's never counts as
   * better (less crowding because fewer people got in or finished is not an improvement).
   */
  max_completion_drop: number;
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
  /** SimulateRequest.crowd_threshold (p/m²); locked like the scenario. */
  crowdThreshold: number;
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
export type SimParams = { grid_cell: number; max_wall_time_s: number; trajectory_dt: number; crowd_threshold?: number };
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

/** The design brief (first step): LLM intent + the constraints code derived from it. */
export type BriefInfo = {
  rationale: string;
  items: BriefItem[];
  applied: BriefApplied[];
  rejected: RejectedAction[];
  /** Constraints of the first LayoutRequest. */
  constraints: LayoutConstraints;
  by: string;
};

export type Decision = "continue" | "target_met" | "no_improvement" | "max_iterations" | "stopped";
export type ComparisonInfo = {
  iteration: number;
  metrics: Metrics;
  valid: boolean;
  /** False when completion fell more than targets.max_completion_drop below the baseline. */
  completionOk: boolean;
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

/**
 * What Muse tells a non-expert user at a moment of the run, in plain language. The simple view
 * shows only these (plus the canvas and one headline number); everything else is behind
 * "details". Any number in `text` must come from the run's own results, never from the model.
 */
export type SayMoment = "intro" | "brief" | "placed" | "simulated" | "revising" | "revised" | "result" | "caution";
export type SayInfo = {
  moment: SayMoment;
  /** One to three short sentences, no jargon (no "p/m²", "CP-SAT", "hotspot"). */
  text: string;
  tone: "neutral" | "good" | "warn";
  /** Iteration the message is about (selects that layout on the canvas), if any. */
  iteration?: number;
  /** Booths the message points at (highlighted on the canvas). */
  booth_ids?: string[];
  /** Whether a person must approve something mentioned here (e.g. overriding an organizer request). */
  needs_approval?: boolean;
  /** Which component produced the wording: the model or the deterministic stub. */
  by: string;
};

/** Data part payloads, keyed by data part name (`data-<name>` on the wire). */
export type AgentDataParts = {
  run: RunInfo;
  step: StepInfo;
  brief: BriefInfo;
  layout: LayoutInfo;
  validation: ValidationInfo;
  sim: SimInfo;
  analysis: AnalysisInfo;
  revision: RevisionInfo;
  comparison: ComparisonInfo;
  report: ReportInfo;
  done: DoneInfo;
  error: ErrorInfo;
  say: SayInfo;
};

/**
 * Message metadata of the simple view's conversation (one `useChat` chat on /api/chat).
 * User messages say what they ask for (`intent`, plus `mode`/`venue` for runs and the run a
 * question is about); assistant messages say what they are (`kind`) and, for answers, who wrote
 * them (`by`: "stub" or the model id). Streams from /api/agent carry none.
 */
export type MuseMetadata = {
  intent?: "run" | "ask";
  mode?: "live" | "replay";
  venue?: string;
  /** Ask only: the run message the question is about (default: the latest run). */
  runMessageId?: string;
  kind?: "run" | "answer";
  by?: string;
};

export type AgentUIMessage = UIMessage<MuseMetadata, AgentDataParts>;

export type AgentEvent =
  | { [K in keyof AgentDataParts]: { type: K; data: AgentDataParts[K] } }[keyof AgentDataParts]
  | { type: "report-delta"; delta: string };

export type Emit = (e: AgentEvent) => void;

export function stepId(iteration: number, step: StepName, attempt = 0): string {
  return `step-${iteration}-${step}-${attempt}`;
}
