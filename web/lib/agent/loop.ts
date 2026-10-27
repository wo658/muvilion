/**
 * The layout improvement loop. Control flow is fixed here; the LLM is consulted
 * only for judgment (analyze, revise, fix proposals, report prose).
 *
 *   iteration 0 (baseline) … N:
 *     generate (/layout) → validate (/validate + agent checks)
 *       └ on errors: LLM proposes constraint fixes → regenerate (≤ maxFixAttempts)
 *     simulate (/simulate, scenario locked by ScenarioGuard)
 *     compare vs previous + baseline → stop (target met / no improvement / max iterations)?
 *     analyze (LLM on summarized metrics) → revise (LLM tool call → zod → LayoutRequest with `previous`)
 *   report (code tables + LLM prose)
 */
import type { Engine } from "@/lib/engine/client";
import {
  LayoutRequest,
  defaultConstraints,
  type Layout,
  type LayoutResponse,
  type ProjectInput,
  type SimResult,
  type ValidateResponse,
} from "@/lib/engine/contract";
import {
  agentChecks,
  bestIteration,
  countViolations,
  decide,
  diffLayouts,
  mergeValidation,
  metricsOf,
  summarizeIteration,
  type IterationOutcome,
  type IterationSummary,
} from "./analysis";
import type { AgentConfig } from "./config";
import {
  stepId,
  type AnalysisInfo,
  type Decision,
  type DoneInfo,
  type Emit,
  type RevisionInfo,
  type StepName,
} from "./events";
import type { AgentLLM, AnalysisOutput, RevisionResult } from "./llm";
import { reportBody, reportHeader } from "./report";
import { applyRevision } from "./revision";
import { ScenarioGuard } from "./scenario";

export type RunOptions = {
  project: ProjectInput;
  engine: Engine;
  llm: AgentLLM;
  config: AgentConfig;
  emit: Emit;
  runId: string;
  mode?: "live" | "replay";
  signal?: AbortSignal;
  /** Injected clock for reproducible recordings. */
  now?: () => Date;
};

export type IterationRecord = {
  iteration: number;
  request: LayoutRequest;
  layout: LayoutResponse;
  validation: ValidateResponse;
  sim: SimResult;
  outcome: IterationOutcome;
  summary: IterationSummary;
};

export type RunResult = {
  done: DoneInfo;
  iterations: IterationRecord[];
  revisions: RevisionInfo[];
  report: string;
};

export async function runAgentLoop(opts: RunOptions): Promise<RunResult> {
  const { project, engine, llm, config, emit, signal } = opts;
  const now = opts.now ?? (() => new Date());
  const venue = project.venue;
  const specs = project.booths;
  const guard = new ScenarioGuard(config.scenario, config.gridCell, venue, specs);
  const initialConstraints = project.constraints ?? defaultConstraints();

  emit({
    type: "run",
    data: {
      runId: opts.runId,
      mode: opts.mode ?? "live",
      startedAt: now().toISOString(),
      venue,
      booths: specs,
      initialConstraints,
      scenario: { ...guard.scenario },
      gridCell: guard.gridCell,
      scenarioFingerprint: guard.fingerprint,
      targets: config.targets,
      maxIterations: config.maxIterations,
      engine: engine.kind,
      llm: llm.name,
    },
  });

  async function step<T>(
    iteration: number,
    name: StepName,
    title: string,
    fn: () => Promise<T>,
    detail?: (r: T) => string,
    attempt = 0,
  ): Promise<T> {
    if (signal?.aborted) throw new Error("run aborted");
    const id = stepId(iteration, name, attempt);
    emit({ type: "step", data: { id, iteration, step: name, status: "running", title } });
    try {
      const r = await fn();
      emit({ type: "step", data: { id, iteration, step: name, status: "done", title, detail: detail?.(r) } });
      return r;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "step", data: { id, iteration, step: name, status: "error", title, detail: message } });
      throw err;
    }
  }

  const records: IterationRecord[] = [];
  const revisions: RevisionInfo[] = [];
  const analyses: AnalysisInfo[] = [];
  let request = LayoutRequest.parse({
    venue,
    booths: specs,
    constraints: initialConstraints,
    previous: null,
    seed: config.layoutSeed,
    time_limit_s: config.layoutTimeLimitS,
  });
  let prevLayout: Layout | null = null;
  let stop: { decision: Decision | "error"; reason: string } = { decision: "stopped", reason: "not started" };

  const revisionInfo = (
    iteration: number,
    purpose: RevisionInfo["purpose"],
    r: RevisionResult,
    translated: ReturnType<typeof applyRevision>,
  ): RevisionInfo => ({
    iteration,
    purpose,
    rationale: r.revision.rationale,
    actions: r.revision.actions,
    applied: translated.applied,
    rejected: [...r.rejected, ...translated.rejected],
    constraints: translated.request.constraints,
    keepOut: translated.request.constraints.keep_out,
    by: llm.name,
  });

  try {
    for (let it = 0; ; it++) {
      // ---- generate + validate (with bounded fix attempts) ----
      let layoutRes: LayoutResponse;
      let validation: ValidateResponse;
      let summary: IterationSummary;
      for (let attempt = 0; ; attempt++) {
        const req = request;
        layoutRes = await step(
          it,
          "generate",
          attempt === 0 ? (it === 0 ? "Generate baseline layout" : "Generate revised layout") : `Regenerate layout (fix attempt ${attempt})`,
          () => engine.layout(req),
          (r) => `${r.status}, ${r.layout.booths.length} booths, ${r.solve_time_s}s solve`,
          attempt,
        );
        emit({
          type: "layout",
          data: {
            iteration: it,
            attempt,
            constraints: req.constraints,
            hasPrevious: req.previous !== null,
            response: layoutRes,
            moves: diffLayouts(prevLayout, layoutRes.layout),
          },
        });
        const lr = layoutRes;
        validation = await step(
          it,
          "validate",
          "Validate geometry and constraints",
          async () =>
            mergeValidation(
              await engine.validate({ venue, layout: lr.layout, constraints: req.constraints }),
              agentChecks(venue, lr, specs, req.constraints),
            ),
          (v) => {
            const c = countViolations(v.violations);
            return c.errors === 0 ? `ok (${c.warnings} warning(s))` : `${c.errors} error(s), ${c.warnings} warning(s)`;
          },
          attempt,
        );
        const counts = countViolations(validation.violations);
        emit({ type: "validation", data: { iteration: it, attempt, result: validation, ...counts } });
        summary = summarizeIteration({
          iteration: it,
          venue,
          specs,
          layout: layoutRes.layout,
          constraints: req.constraints,
          sim: null,
          violations: validation.violations,
        });
        if (counts.errors === 0 || attempt >= config.maxFixAttempts) break;

        const s = summary;
        const fixed = await step(
          it,
          "revise",
          `Propose constraint fixes for ${counts.errors} violation(s)`,
          async () => {
            const r = await llm.proposeFixes({ summary: s, attempt });
            const t = applyRevision({ venue, specs, request: req, layout: lr.layout, hotspots: [] }, r.revision);
            return { r, t };
          },
          ({ t }) => `${t.applied.length} change(s) applied, ${t.rejected.length} rejected`,
          attempt,
        );
        const info = revisionInfo(it, "fix_validation", fixed.r, fixed.t);
        revisions.push(info);
        emit({ type: "revision", data: info });
        // The rejected attempt becomes the displacement anchor, so the fix changes as little as possible.
        request = fixed.t.request;
      }

      // ---- simulate under the locked scenario ----
      const lr = layoutRes;
      const sim = await step(
        it,
        "simulate",
        "Simulate pedestrians (identical scenario)",
        async () => {
          const simReq = guard.request(lr.layout);
          const res = await engine.simulate(simReq);
          guard.assertResult(res);
          return res;
        },
        (r) => `max ${r.max_density} p/m², p90 ${r.p90_travel_time_s}s, ${r.hotspots.length} hotspot(s)`,
      );
      const metrics = metricsOf(sim, validation.violations);
      emit({ type: "sim", data: { iteration: it, result: sim, metrics } });
      summary = summarizeIteration({
        iteration: it,
        venue,
        specs,
        layout: lr.layout,
        constraints: request.constraints,
        sim,
        violations: validation.violations,
      });
      const outcome: IterationOutcome = {
        iteration: it,
        metrics,
        valid: metrics.violations === 0 && lr.status !== "infeasible",
      };
      records.push({ iteration: it, request, layout: lr, validation, sim, outcome, summary });

      // ---- compare & decide (code) ----
      const history = records.map((r) => r.outcome);
      const d = await step(
        it,
        "compare",
        it === 0 ? "Record baseline" : "Compare with previous and baseline",
        async () => decide(history, config.targets, config.maxIterations),
        (r) => `${r.decision.replace(/_/g, " ")}: ${r.reason}`,
      );
      emit({
        type: "comparison",
        data: {
          iteration: it,
          metrics,
          valid: outcome.valid,
          previous: records.length > 1 ? records[records.length - 2].outcome.metrics : null,
          baseline: records[0].outcome.metrics,
          bestIteration: d.best,
          decision: d.decision,
          reason: d.reason,
        },
      });
      if (d.decision !== "continue") {
        stop = { decision: d.decision, reason: d.reason };
        break;
      }

      // ---- analyze (LLM, summarized metrics only) ----
      const s = summary;
      const prevSummary = records.length > 1 ? records[records.length - 2].summary : null;
      const analysis: AnalysisOutput = await step(
        it,
        "analyze",
        "Analyze bottlenecks",
        () => llm.analyze({ summary: s, previous: prevSummary }),
        (a) => `${a.causes.length} cause(s) identified`,
      );
      const ai: AnalysisInfo = { iteration: it, summary: analysis.summary, causes: analysis.causes, by: llm.name };
      analyses.push(ai);
      emit({ type: "analysis", data: ai });

      // ---- revise (LLM tool call → zod → next LayoutRequest) ----
      const req = request;
      const rev = await step(
        it,
        "revise",
        "Revise layout constraints",
        async () => {
          const r = await llm.revise({
            summary: s,
            analysis,
            history: revisions.map(({ iteration, purpose, rationale, applied }) => ({ iteration, purpose, rationale, applied })),
          });
          const t = applyRevision({ venue, specs, request: req, layout: lr.layout, hotspots: sim.hotspots }, r.revision);
          return { r, t };
        },
        ({ t }) => `${t.applied.length} change(s) applied, ${t.rejected.length} rejected`,
      );
      const info = revisionInfo(it, "improve", rev.r, rev.t);
      revisions.push(info);
      emit({ type: "revision", data: info });
      if (rev.t.applied.length === 0) {
        stop = { decision: "no_improvement", reason: "the reviser proposed no applicable change" };
        emit({
          type: "error",
          data: { message: "No applicable revision; stopping.", iteration: it, step: "revise", recoverable: true },
        });
        break;
      }
      request = rev.t.request;
      prevLayout = lr.layout;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stop = { decision: "error", reason: message };
    emit({ type: "error", data: { message, recoverable: false } });
  }

  // ---- report ----
  let report = "";
  const baselineIteration = 0;
  const finalIteration = records.length ? bestIteration(records.map((r) => r.outcome)) : 0;
  const baseline = records[0]?.outcome.metrics ?? null;
  const finalRec = records.find((r) => r.iteration === finalIteration);
  if (records.length > 0 && baseline && finalRec) {
    try {
      const parts = {
        venue,
        scenario: guard.scenario,
        gridCell: guard.gridCell,
        fingerprint: guard.fingerprint,
        targets: config.targets,
        engineKind: engine.kind,
        llmName: llm.name,
        stopReason: stop.decision,
        stopDetail: stop.reason,
        rows: records.map((r) => r.outcome),
        baselineIteration,
        finalIteration,
        revisions,
        analyses,
        remainingWarnings: finalRec.validation.violations
          .filter((v) => v.severity === "warning")
          .map((v) => `${v.message} [${v.rule_id}, ${v.source}]`),
      };
      report = await step(records.length, "report", "Write review report", async () => {
        const header = reportHeader(parts);
        emit({ type: "report-delta", delta: header });
        const narrative = await llm.reportNarrative(
          {
            venueName: venue.name,
            stopReason: stop.reason,
            baselineIteration,
            finalIteration,
            baseline,
            final: finalRec.outcome.metrics,
            revisions: revisions.map(({ iteration, purpose, rationale, applied }) => ({ iteration, purpose, rationale, applied })),
            analyses: analyses.map(({ iteration, summary }) => ({ iteration, summary })),
            unknowns: venue.unknowns,
          },
          (delta) => emit({ type: "report-delta", delta }),
        );
        const body = reportBody(parts);
        emit({ type: "report-delta", delta: body });
        return header + narrative.trim() + "\n" + body;
      });
      emit({ type: "report", data: { markdown: report, baselineIteration, finalIteration } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "error", data: { message: `report failed: ${message}`, step: "report", recoverable: false } });
    }
  }

  const done: DoneInfo = {
    status: stop.decision === "error" ? "error" : "completed",
    stopReason: stop.decision,
    iterations: records.length,
    baselineIteration,
    finalIteration,
    baseline,
    final: finalRec?.outcome.metrics ?? null,
  };
  emit({ type: "done", data: done });
  return { done, iterations: records, revisions, report };
}
