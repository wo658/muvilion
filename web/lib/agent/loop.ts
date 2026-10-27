/**
 * The layout improvement loop. Control flow is fixed here; the LLM is consulted
 * only for judgment (analyze, revise, fix proposals, report prose).
 *
 *   design brief (LLM reads the empty site → intent; code → first LayoutRequest constraints)
 *   iteration 0 (baseline) … N:
 *     generate (/layout) → validate (/validate + agent checks)
 *       └ on errors: LLM proposes constraint fixes → regenerate (≤ maxFixAttempts)
 *     simulate (/simulate, scenario locked by ScenarioGuard)
 *     compare vs previous + baseline on crowded s/visitor → stop (target met / no improvement /
 *       max iterations)? (completion guard: fewer visitors finishing never counts as better)
 *     analyze (LLM on summarized metrics) → revise (LLM tool call → zod → LayoutRequest with `previous`)
 *   report (code tables + LLM prose)
 *
 * After the events of each moment Muse says what happened in plain language (`say` events,
 * lib/agent/narrate.ts): intro after `run`, brief after `brief`, placed after the baseline's final
 * `validation`, simulated / revised after each `comparison`, revising after each applied
 * `revision`, then result and cautions right before `done`.
 */
import type { Engine } from "@/lib/engine/client";
import {
  LayoutRequest,
  defaultConstraints,
  type Layout,
  type LayoutResponse,
  type ProjectInput,
  type SimResult,
  type SimulateRequest,
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
  type BriefInfo,
  type Decision,
  type DoneInfo,
  type Emit,
  type RevisionInfo,
  type StepName,
} from "./events";
import type { AgentLLM, AnalysisOutput, RevisionResult } from "./llm";
import { reportBody, reportHeader } from "./report";
import { applyBrief, summarizeSite } from "./brief";
import { applyRevision } from "./revision";
import {
  briefLine,
  createNarrator,
  failedCaution,
  introLine,
  mockEngineCaution,
  overriddenRequests,
  placedLine,
  remainingProblemsCaution,
  resultLine,
  revisedLine,
  revisingLine,
  simulatedLine,
  truncatedCaution,
  unknownCaution,
  type NarrationFacts,
  type NarrationLine,
  type SayMeta,
} from "./narrate";
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
  const guard = new ScenarioGuard(config.scenario, config.gridCell, venue, specs, config.simMaxWallTimeS, config.crowdThreshold);
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
      crowdThreshold: guard.crowdThreshold,
      scenarioFingerprint: guard.fingerprint,
      targets: config.targets,
      maxIterations: config.maxIterations,
      engine: engine.kind,
      llm: llm.name,
    },
  });

  const say = createNarrator(llm, emit, { timeoutMs: config.narrationTimeoutMs });
  const facts: NarrationFacts = {
    venue,
    specs,
    organizerFixed: initialConstraints.fixed,
    visitors: guard.scenario.agents,
    durationS: guard.scenario.duration_s,
    targets: config.targets,
  };
  const warn = (line: NarrationLine, iteration?: number): { line: NarrationLine; meta: SayMeta } => ({
    line,
    meta: { tone: "warn", ...(iteration !== undefined ? { iteration } : {}) },
  });
  await say([{ line: introLine(facts), meta: { tone: "neutral" } }]);

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

  let brief: BriefInfo | null = null;
  try {
    // ---- design brief: Muse decides intent, code derives constraints, OR-Tools later decides coordinates ----
    const site = summarizeSite(venue, specs, guard.scenario, request.constraints);
    const initial = request;
    const b = await step(
      0,
      "brief",
      "Read the site and write the design brief",
      async () => {
        const r = await llm.designBrief({ site });
        return { r, t: applyBrief({ venue, specs, request: initial }, r.brief) };
      },
      ({ t }) => `${t.applied.length} constraint choice(s) applied, ${t.rejected.length} rejected`,
    );
    brief = {
      rationale: b.r.brief.rationale,
      items: b.r.brief.items,
      applied: b.t.applied,
      rejected: [...b.r.rejected, ...b.t.rejected],
      constraints: b.t.request.constraints,
      by: llm.name,
    };
    emit({ type: "brief", data: brief });
    await say([briefLine(facts, brief)]);
    request = b.t.request;

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
        if (it === 0 && (counts.errors === 0 || attempt >= config.maxFixAttempts)) {
          await say([
            placedLine(facts, {
              placed: layoutRes.layout.booths.length,
              total: specs.length,
              errors: counts.errors,
              aisle: req.constraints.min_aisle_width,
            }),
          ]);
        }
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
        const fixSay = revisingLine(facts, info, []);
        if (fixSay) await say([fixSay]);
        // The rejected attempt becomes the displacement anchor, so the fix changes as little as possible.
        request = fixed.t.request;
      }

      // ---- simulate under the locked scenario ----
      const lr = layoutRes;
      let simReq: SimulateRequest | undefined;
      const sim = await step(
        it,
        "simulate",
        "Simulate pedestrians (identical scenario)",
        async () => {
          simReq = guard.request(lr.layout);
          const res = await engine.simulate(simReq);
          guard.assertResult(res);
          return res;
        },
        (r) =>
          `crowded ${r.congestion.crowded_s_per_visitor} s/visitor (≥ ${r.congestion.threshold} p/m²), p90 ${r.p90_travel_time_s}s, ${r.hotspots.length} hotspot(s), max ${r.max_density} p/m²` +
          (r.truncated ? " — TRUNCATED at max_wall_time_s (not comparable)" : ""),
      );
      const metrics = metricsOf(sim, validation.violations);
      const params = {
        grid_cell: simReq!.grid_cell,
        max_wall_time_s: simReq!.max_wall_time_s,
        trajectory_dt: simReq!.trajectory_dt,
        crowd_threshold: simReq!.crowd_threshold,
      };
      emit({ type: "sim", data: { iteration: it, result: sim, metrics, params } });
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
        // Truncated runs are partial and not reproducible, so they never count for comparison.
        valid: metrics.violations === 0 && lr.status !== "infeasible" && !sim.truncated,
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
          completionOk: d.completionOk,
          previous: records.length > 1 ? records[records.length - 2].outcome.metrics : null,
          baseline: records[0].outcome.metrics,
          bestIteration: d.best,
          decision: d.decision,
          reason: d.reason,
        },
      });
      const simSays =
        it === 0
          ? [simulatedLine(facts, { iteration: it, metrics, hotspots: sim.hotspots })]
          : [
              revisedLine(facts, {
                iteration: it,
                previous: records[records.length - 2].outcome.metrics,
                current: metrics,
                valid: outcome.valid,
                completionOk: d.completionOk,
                movedBoothIds: diffLayouts(prevLayout, lr.layout).map((m) => m.booth_id),
                targetMet: d.decision === "target_met",
              }),
            ];
      if (sim.truncated) simSays.push(warn(truncatedCaution(), it));
      await say(simSays);
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
      const revSay = revisingLine(facts, info, sim.hotspots);
      if (revSay) await say([revSay]);
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
  const finalIteration = records.length ? bestIteration(records.map((r) => r.outcome), config.targets.max_completion_drop) : 0;
  const baseline = records[0]?.outcome.metrics ?? null;
  const finalRec = records.find((r) => r.iteration === finalIteration);
  if (records.length > 0 && baseline && finalRec) {
    try {
      const parts = {
        venue,
        scenario: guard.scenario,
        gridCell: guard.gridCell,
        crowdThreshold: guard.crowdThreshold,
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
        brief,
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
            targets: config.targets,
            revisions: revisions.map(({ iteration, purpose, rationale, applied }) => ({ iteration, purpose, rationale, applied })),
            analyses: analyses.map(({ iteration, summary }) => ({ iteration, summary })),
            unknowns: venue.unknowns,
            brief: brief && { rationale: brief.rationale, applied: brief.applied.map((a) => a.effect) },
          },
          (delta) => emit({ type: "report-delta", delta }),
        );
        const body = (narrative.endsWith("\n") ? "" : "\n") + reportBody(parts);
        emit({ type: "report-delta", delta: body });
        return header + narrative + body;
      });
      emit({ type: "report", data: { markdown: report, baselineIteration, finalIteration } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "error", data: { message: `report failed: ${message}`, step: "report", recoverable: false } });
    }
  }

  // ---- Muse's bottom line + cautions, right before `done` ----
  const shaping = revisions.filter((r) => (r.purpose === "improve" ? r.iteration < finalIteration : r.iteration <= finalIteration));
  const approvalBoothIds = [...new Set(shaping.flatMap((r) => overriddenRequests(r.applied, initialConstraints.fixed)))];
  const failed = stop.decision === "error";
  const closing = [
    resultLine(facts, {
      failed,
      baseline,
      final: finalRec?.outcome.metrics ?? null,
      baselineIteration,
      finalIteration,
      approvalBoothIds,
    }),
  ];
  if (failed) closing.push(warn(failedCaution(), finalIteration));
  const remaining = finalRec?.outcome.metrics.violations ?? 0;
  if (remaining > 0) closing.push(warn(remainingProblemsCaution(remaining), finalIteration));
  for (const u of venue.unknowns) closing.push(warn(unknownCaution(u)));
  if (engine.kind === "mock" && records.length > 0) closing.push(warn(mockEngineCaution()));
  await say(closing);

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
