/** Folds the streamed parts of one assistant message into a view model for the console. */
import type {
  AgentUIMessage,
  AnalysisInfo,
  BriefInfo,
  ComparisonInfo,
  DoneInfo,
  ErrorInfo,
  LayoutInfo,
  ReportInfo,
  RevisionInfo,
  RunInfo,
  SimInfo,
  StepInfo,
  ValidationInfo,
} from "@/lib/agent/events";

export type IterationView = {
  iteration: number;
  /** Accepted layout = last generate attempt of the iteration. */
  layout?: LayoutInfo;
  validation?: ValidationInfo;
  sim?: SimInfo;
  analysis?: AnalysisInfo;
  comparison?: ComparisonInfo;
  /** Revision that produced the *next* iteration. */
  revision?: RevisionInfo;
  fixes: RevisionInfo[];
};

export type RunState = {
  run?: RunInfo;
  brief?: BriefInfo;
  steps: StepInfo[];
  iterations: IterationView[];
  reportText: string;
  report?: ReportInfo;
  done?: DoneInfo;
  errors: ErrorInfo[];
};

export function emptyRunState(): RunState {
  return { steps: [], iterations: [], reportText: "", errors: [] };
}

export function deriveRunState(message: AgentUIMessage | undefined): RunState {
  const s = emptyRunState();
  if (!message) return s;
  const iters = new Map<number, IterationView>();
  const it = (n: number) => {
    let v = iters.get(n);
    if (!v) {
      v = { iteration: n, fixes: [] };
      iters.set(n, v);
    }
    return v;
  };
  for (const p of message.parts) {
    switch (p.type) {
      case "data-run":
        s.run = p.data;
        break;
      case "data-brief":
        s.brief = p.data;
        break;
      case "data-step":
        s.steps.push(p.data);
        break;
      case "data-layout":
        it(p.data.iteration).layout = p.data;
        break;
      case "data-validation":
        it(p.data.iteration).validation = p.data;
        break;
      case "data-sim":
        it(p.data.iteration).sim = p.data;
        break;
      case "data-analysis":
        it(p.data.iteration).analysis = p.data;
        break;
      case "data-comparison":
        it(p.data.iteration).comparison = p.data;
        break;
      case "data-revision":
        if (p.data.purpose === "improve") it(p.data.iteration).revision = p.data;
        else it(p.data.iteration).fixes.push(p.data);
        break;
      case "data-report":
        s.report = p.data;
        break;
      case "data-done":
        s.done = p.data;
        break;
      case "data-error":
        s.errors.push(p.data);
        break;
      case "text":
        s.reportText += p.text;
        break;
    }
  }
  s.iterations = [...iters.values()].sort((a, b) => a.iteration - b.iteration);
  return s;
}
