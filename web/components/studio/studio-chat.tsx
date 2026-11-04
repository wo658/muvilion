"use client";
import { MUVI_OPERATION_LABELS, type MuviOperation } from "@/lib/muvi/operations";
import { SECTION_LABELS, type PlanningContent } from "@/lib/plans/planning-artifact";
import { DESIGN_BUDGET } from "@/lib/plans/design-budget";
import { IntentDecision } from "@/lib/plans/intent";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputButton, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { ArrowUpIcon, PanelRightCloseIcon, CheckIcon, LoaderCircleIcon, MessageCircleIcon, PaperclipIcon, SquareIcon, XIcon } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { useEffect, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { planRegions, regionDocument, combineRegionalResults } from "@/lib/plans/regions";
import { runRegionalBatches, globalWallAuditBatches, applyGlobalWallAudit, type RegionalProgress } from "@/lib/plans/regional-client";
import { emptySources, type SourceLibrary } from "@/lib/sources/schema";
import { selectedReferences } from "@/lib/sources/files";
import { DesignReviewSchema } from "@/lib/plans/design-review";
import type { z } from "zod";
import { DesignArtifactsSchema, type DesignArtifact } from "@/lib/plans/design-artifacts";
import { readDesignStream, previewDocument } from "@/lib/plans/design-stream";
import Image from "next/image";
import { getModelAsset, getMaterialAsset } from "@/lib/assets/catalog";
import Link from "next/link";
import { MuviAvatar } from "@/components/muvi/muvi-avatar";
import { MuviGreeting } from "@/components/muvi/muvi";
/** Line review results remain a reviewed proposal; design runs commit operations live. */
type Proposal = {
    sources: SourceLibrary;
    document: PlanDocument;
    summary: string;
    base: PlanDocument;
};
/** One Muse design run: each operation is already saved; the run can be undone as a whole or continued after a stop. */
type DesignRun = {
    base: PlanDocument;
    last: PlanDocument;
    operations: number;
    brief: string;
    status: "running" | "complete" | "partial";
    label?: string;
    summary?: string;
    artifacts?: DesignArtifact[];
    designReview?: z.infer<typeof DesignReviewSchema>;
};
export function StudioChat({ autoDesign = null, onAutoDesignStart, onOperation, document, onDocumentChange, sources = emptySources(), onSources, selection, onClearSelection, onCollapse, onMuviOperation, onPhotography, onPlanning, onPlanningCancel, planningContext, planningBusy = false }: {
    onPlanningCancel?: () => void;
    autoDesign?: { brief: string } | null;
    /** Called after each committed design operation with the element IDs it changed; an empty list means the whole space. */
    onOperation?: (ids: string[]) => void;
    onAutoDesignStart?: () => void;
    onPlanning?: (brief: string, signal?: AbortSignal) => Promise<string>;
    planningBusy?: boolean;
    planningContext?: { open: boolean; target: string | null; title: string | null; content: PlanningContent | null } | null;
    onPhotography?: (request: import("@/lib/plans/photography-client").PhotoRequest) => void;
    onMuviOperation?: (activity: { base: PlanDocument; sources: SourceLibrary; operation: MuviOperation } | null) => void;
    onCollapse?: () => void;

    onSources: () => void;
    selection?: { id: string; label: string } | null;
    onClearSelection?: () => void;
    sources?: SourceLibrary;
    document: PlanDocument | null;
    onDocumentChange: (document: PlanDocument) => void;
}) {
    const { t, locale } = useI18n();
    const [transport] = useState(() => new DefaultChatTransport({
        api: "/api/plans/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({ body: {
                document: body?.document ?? null,
                selection: body?.selection ?? null,
                locale: body?.locale,
                planning: body?.planning ?? null,
                sources: body?.sources ?? [],
                messages: messages.slice(-24).map((message) => ({ role: message.role, parts: message.parts.filter((part) => part.type === "text").map((part) => ({ type: "text", text: part.text })) })),
            } }),
    }));
    const { messages, sendMessage, status, error, stop, clearError, setMessages } = useChat({ transport });
    const [input, setInput] = useState("");
    const [interpreting, setInterpreting] = useState(false);
    const [interpretError, setInterpretError] = useState<string | null>(null);
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [designRun, setDesignRun] = useState<DesignRun | null>(null);
    // The latest document this run committed; only a change from anyone else stops the run.
    const agentCommit = useRef<PlanDocument | null>(null);
    const [muviActivity, setMuviActivity] = useState<{ base: PlanDocument; sources: SourceLibrary; operation: MuviOperation } | null>(null);
    const activeOperation = interpreting && muviActivity?.base === document && muviActivity?.sources === sources ? muviActivity : null;
    useEffect(() => { onMuviOperation?.(activeOperation); return () => onMuviOperation?.(null); }, [activeOperation, onMuviOperation]);
    const [notice, setNotice] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    useEffect(() => { if (document !== agentCommit.current) controller.current?.abort(); }, [document]);
    useEffect(() => { controller.current?.abort(); }, [sources]);
    const minPixels = 12;
    const composer = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { if (planningContext?.target) composer.current?.focus(); }, [planningContext?.target]);
    const [progress, setProgress] = useState<RegionalProgress | null>(null);
    const [cancelRequested, setCancelRequested] = useState(false);
    const [reviewPhase, setReviewPhase] = useState<"regions" | "walls">("regions");
    const [preparing, setPreparing] = useState(false);
    const preparingRef = useRef(false);
    const currentContext = useRef({ document, sources, selection });
    useEffect(() => { currentContext.current = { document, sources, selection }; }, [document, sources, selection]);
    const responding = status === "submitted" || status === "streaming";
    const busy = interpreting || preparing || responding || planningBusy;
    const unknownCount = document?.lines.filter((line) => line.kind === "unknown").length ?? 0;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
    // First automatic interior for a new project with brand references: run once, apply directly (Undo restores the empty space).
    const autoStarted = useRef(false);
    useEffect(() => {
        if (!autoDesign || autoStarted.current || busy || !document) return;
        // Start on the next task so a development remount (which aborts in-flight requests) cancels only the timer.
        const timer = window.setTimeout(() => {
            autoStarted.current = true;
            onAutoDesignStart?.();
            setMessages(previous => [...previous, { id: generateId(), role: "assistant", parts: [{ type: "text", text: t("Designing the first interior from your brand references. It is applied when ready.") }] }]);
            void interpret("design", autoDesign.brief);
        });
        return () => window.clearTimeout(timer);
        // interpret reads the current render's document and sources; this effect must start it once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoDesign, busy, document]);
    async function interpret(mode: "interpret" | "design" = "interpret", brief = input.trim()) {
        if (!document || interpreting || (mode === "design" && (!brief.trim() || !document.scaleConfirmed)))
            return;
        const base = document;
        let designOps = 0;
        setInterpreting(true);
        setInterpretError(null);
        setProposal(null);
        setMuviActivity(null);
        setNotice(null);
        setProgress(null);
        setCancelRequested(false);
        setReviewPhase("regions");
        const abortController = new AbortController();
        controller.current = abortController;
        try {
            if (mode === "interpret") {
                const planned = planRegions(base, minPixels);
                if (!planned.batches.length) {
                    setNotice(t("No major lines to review. Short detail lines are preserved."));
                    return;
                }
                const outcome = await runRegionalBatches(planned.batches, async (batch, signal) => {
                    const crop = await regionDocument(base, batch);
                    if (signal.aborted)
                        throw new DOMException(t("Analysis cancelled"), "AbortError");
                    const response = await fetch("/api/plans/interpret", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ document: crop }), signal,
                    });
                    const body = await response.json();
                    if (!response.ok)
                        throw new Error(typeof body.error === "string" ? body.error : t("Muse could not review a region."));
                    return PlanDocumentSchema.parse(body.document);
                }, abortController.signal, (next) => { if (mounted.current)
                    setProgress(next); });
                if (!mounted.current)
                    return;
                const { completed, total, failed } = outcome.progress;
                const unreviewed = total - completed - failed;
                const coverage = t("{completed}/{total} regions reviewed · {failed} failed · {unreviewed} remaining.", { completed, total, failed, unreviewed });
                if (outcome.results.length) {
                    const result = combineRegionalResults(base, outcome.results, {
                        completed, total, failed, candidates: planned.candidateCount, deferred: planned.deferredCount,
                    });
                    const originalUnknownIDs = new Set(base.lines.filter(line => line.kind === "unknown").map(line => line.id));
                    const proposedWallCount = result.lines.filter(line => line.kind === "wall" && originalUnknownIDs.has(line.id)).length;
                    const wallBatches = globalWallAuditBatches(base, result);
                    let audited = result;
                    let auditSummary = t("{count} wall candidates. Short walls retain regional review.", { count: proposedWallCount });
                    let auditPartial = false;
                    if (wallBatches.length) {
                        setReviewPhase("walls");
                        const audit = await runRegionalBatches(wallBatches, async (auditDocument, signal) => {
                            const response = await fetch("/api/plans/interpret", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ document: auditDocument, reviewMode: "global-wall-audit" }), signal,
                            });
                            const body = await response.json();
                            if (!response.ok)
                                throw new Error(typeof body.error === "string" ? body.error : t("Wall context review failed."));
                            return PlanDocumentSchema.parse(body.document);
                        }, abortController.signal, next => { if (mounted.current)
                            setProgress(next); });
                        if (!mounted.current)
                            return;
                        audited = applyGlobalWallAudit(base, result, audit.results, audit.progress);
                        const wallCount = audited.lines.filter(line => line.kind === "wall" && originalUnknownIDs.has(line.id)).length;
                        auditSummary = t("Long wall checks {completed}/{total} · failed {failed}. {count} walls retained. Unchecked walls remain unknown.", { ...audit.progress, count: wallCount });
                        auditPartial = audit.progress.completed < audit.progress.total;
                        if (audit.errors.length)
                            setInterpretError(`${localizeMessage(locale, audit.errors[0])} ${t("Unchecked long walls remain unknown.")}`);
                    }
                    setProposal({ sources, document: audited, summary: `${abortController.signal.aborted ? t("Analysis stopped. ") : ""}${coverage} ${auditSummary} ${t("{count} short lines preserved. Review before applying.", { count: planned.deferredCount })} ${completed < total || auditPartial ? t("Partial suggestions.") : ""}`, base });
                }
                else {
                    setNotice(`${outcome.cancelled ? t("Analysis stopped. ") : ""}${coverage} ${t("No suggestions were applied.")}`);
                }
                if (outcome.errors.length)
                    setInterpretError(`${localizeMessage(locale, outcome.errors[0])} ${outcome.results.length ? t("Successful regions are retained for review.") : t("No regions could be reviewed.")}`);
            }
            else {
                // Outlast the server's design budget so its own timeout error reaches the user.
                const designSignal = AbortSignal.any([abortController.signal, AbortSignal.timeout(DESIGN_BUDGET.timeoutMs + 40_000)]);
                const response = await fetch("/api/plans/design", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify({ locale, document: base, selection: selection ?? null, drawingSelected: true, brief, sources: await selectedReferences(sources, document) }), signal: designSignal });
                const assertCurrent = () => {
                    designSignal.throwIfAborted();
                    if (!mounted.current || currentContext.current.sources !== sources) throw new DOMException("Stale design", "AbortError");
                };
                // Each streamed operation is validated on the server and committed here as one undo step.
                let committed = base;
                const commit = (next: PlanDocument, label?: string, ids: string[] = []) => {
                    committed = next;
                    designOps++;
                    agentCommit.current = next;
                    onDocumentChange(next);
                    onOperation?.(ids);
                    setDesignRun(run => run && { ...run, last: next, operations: designOps, label: label ?? run.label });
                };
                agentCommit.current = base;
                setDesignRun({ base, last: base, operations: 0, brief, status: "running" });
                const body = await readDesignStream(response, event => {
                    assertCurrent();
                    commit(previewDocument(committed, event), event.label, [...event.objects.map(item => item.id), ...event.zones.map(item => item.id), ...(event.wallSurfaces ?? []).map(item => item.hostId)]);
                }, operation => {
                    assertCurrent();
                    setMuviActivity({ base: committed, sources, operation });
                });
                assertCurrent();
                const result = PlanDocumentSchema.parse(body.document);
                // The final reviewed revision can be earlier than the last streamed operation.
                if (JSON.stringify([result.objects ?? [], result.zones ?? [], result.wallSurfaces ?? []]) !== JSON.stringify([committed.objects ?? [], committed.zones ?? [], committed.wallSurfaces ?? []]))
                    commit({ ...committed, objects: result.objects, zones: result.zones, wallSurfaces: result.wallSurfaces, warnings: result.warnings }, t("Reviewed version"));
                const summary = typeof body.summary === "string" ? body.summary : t("Design complete.");
                setDesignRun(run => run && { ...run, status: "complete", summary, artifacts: DesignArtifactsSchema.parse(body.artifacts ?? []), designReview: body.designReview ? DesignReviewSchema.parse(body.designReview) : undefined });
                setMessages(previous => [...previous, { id: generateId(), role: "assistant", parts: [{ type: "text", text: summary }] }]);
                onOperation?.([]);
            }
        }
        catch (err) {
            if (!mounted.current)
                return;
            if (designOps > 0) {
                // Saved operations stay; the run can be continued or undone as a whole.
                setDesignRun(run => run && { ...run, status: "partial" });
                setNotice(t("Muse stopped after {count} saved operations. Continue the design or undo it.", { count: designOps }));
                if (!(err instanceof Error && err.name === "AbortError")) setInterpretError(err instanceof Error ? err.message : t("Muse could not finish the design."));
                return;
            }
            setDesignRun(null);
            if (err instanceof Error && err.name === "AbortError") {
                setNotice(t("Draft cancelled. Your drawing is unchanged."));
                return;
            }
            setInterpretError(err instanceof Error ? err.message : t("Muse could not review the drawing."));
        }
        finally {
            if (mounted.current) {
                setMuviActivity(null);
                setInterpreting(false);
            }
        }
    }
    async function send(text: string) {
        const message = text.trim();
        if (!message || busy || preparingRef.current) return;
        preparingRef.current = true;
        setPreparing(true);
        clearError();
        setNotice(null);
        setInterpretError(null);
        const abortController = new AbortController();
        controller.current = abortController;
        setInput("");
        // Show the user's message immediately; intent routing can take a while.
        const userMessageId = generateId();
        let handedOff = false;
        let planningHandedOff = false;
        setMessages(previous => [...previous, { id: userMessageId, role: "user", parts: [{ type: "text", text: message }] }]);
        try {
            const response = await fetch("/api/plans/intent", {
                method: "POST", headers: { "Content-Type": "application/json" }, signal: abortController.signal,
                body: JSON.stringify({
                    message, locale,
                    planning: planningContext ? { open: planningContext.open, title: planningContext.title, target: planningContext.target } : null,
                    history: messages.slice(-24).filter(item => item.role === "user" || item.role === "assistant").map(item => ({
                        role: item.role, text: item.parts.filter(part => part.type === "text").map(part => part.text).join("\n").slice(0, 6000),
                    })),
                    document: document ? { name: document.source.name, scaleConfirmed: document.scaleConfirmed, unknownLines: unknownCount } : null,
                    selection: selection ?? null,
                }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error ?? t("Muse could not determine your request. Please try again."));
            const decision = IntentDecision.parse(body);
            if (!mounted.current) return;
            abortController.signal.throwIfAborted();
            if (currentContext.current.document !== document || currentContext.current.sources !== sources || currentContext.current.selection?.id !== selection?.id) {
                throw new Error(t("The drawing or sources changed. Generate a new proposal before applying."));
            }
            if (decision.intent === "chat") {
                const references = await selectedReferences(sources, document);
                if (!mounted.current) return;
                abortController.signal.throwIfAborted();
                handedOff = true;
                await sendMessage({ text: message, messageId: userMessageId }, { body: { locale, planning: planningContext?.content ?? null, selection: selection ?? null, document: document ? { ...document, preview: undefined, texts: document.texts } : null, sources: references } });
            } else {
                handedOff = true;
                setMessages(previous => [...previous,
                    { id: generateId(), role: "assistant", parts: [{ type: "text", text: decision.message }] },
                ]);
                if (decision.intent === "planning") {
                    if (!onPlanning) throw new Error(t("Open the 3D workspace to revise the document."));
                    planningHandedOff = true;
                    const summary = await onPlanning(`${message}\n\n${decision.brief}`.slice(0, 6000), abortController.signal);
                    if (mounted.current) setMessages(previous => [...previous, { id: generateId(), role: "assistant", parts: [{ type: "text", text: summary }] }]);
                }
                if (decision.intent === "photography") {
                    if (!onPhotography) throw new Error(t("Open the 3D workspace to take a photo."));
                    onPhotography({ id: generateId(), brief: message.slice(0, 6000), locale, history: messages.slice(-24).filter(item => item.role === "user" || item.role === "assistant").map(item => ({ role: item.role as "user" | "assistant", text: item.parts.filter(part => part.type === "text").map(part => part.text).join("\n").slice(0, 6000) })) });
                }
                if (decision.intent === "design" || decision.intent === "interpret") {
                    // Keep explicit scope constraints before the router's conversational summary.
                    await interpret(decision.intent, decision.intent === "design" ? `${message}\n\n${decision.brief}`.slice(0, 6000) : decision.brief);
                }
            }
        } catch (err) {
            if (!mounted.current) return;
            // The message never reached Muse: drop the echo and give the text back to the composer.
            if (!handedOff) setMessages(previous => previous.filter(item => item.id !== userMessageId));
            setInput(current => current || text);
            setNotice(err instanceof Error && err.name === "AbortError"
                ? t(planningHandedOff ? "Document request stopped. Any completed revisions and photos are kept." : "Request cancelled. Your drawing is unchanged.")
                : err instanceof Error ? err.message : t("Muse could not determine your request. Please try again."));
        } finally {
            preparingRef.current = false;
            if (mounted.current) setPreparing(false);
        }
    }
    const changed = proposal?.document.lines.filter((line, i) => line.kind !== proposal.base.lines[i]?.kind).length ?? 0;
    const stale = proposal && (proposal.base !== document || proposal.sources !== sources);
    const tools = interpreting || progress || interpretError || proposal || designRun || notice;
    const runUndoable = designRun && designRun.status !== "running" && designRun.operations > 0 && document === designRun.last;
    const suggestions = [t("Design a furnished booth with partitions and displays"), t("Plan an interior around my brand references")];
    return (<section className="ps-conversation" aria-label={t("Muse drawing assistant")}>
      {planningContext?.open && <p className="bg-selected px-3 py-2 text-xs text-ink" role="status">{t("Revising planning document")}{planningContext.target ? ` · ${document?.zones?.find(b => b.id === planningContext.target)?.label ?? document?.objects?.find(b => b.id === planningContext.target)?.label ?? (Object.hasOwn(SECTION_LABELS, planningContext.target) ? t(SECTION_LABELS[planningContext.target as keyof typeof SECTION_LABELS]) : planningContext.target)}` : ""}</p>}
      <header className="ps-conversation-head">
        <Link href="/muvi" target="_blank" rel="noopener noreferrer" aria-label={t("Meet Muvi in 3D (new tab)")}><MuviAvatar size={32}/></Link>
        {busy && <h2 className="ps-muse-status">{activeOperation ? t(MUVI_OPERATION_LABELS[activeOperation.operation.operation]) : t("Muse is replying…")}</h2>}

        {onCollapse && <Button type="button" size="icon-sm" variant="ghost" className="ml-auto" onClick={onCollapse} aria-label={t("Minimize Muse")} title={t("Minimize Muse")} aria-expanded={true} aria-controls="muse-panel"><PanelRightCloseIcon aria-hidden="true" /></Button>}

      </header>
      <Conversation aria-label={t("Muse drawing assistant")} aria-live="polite" aria-relevant="additions text">
      <ConversationContent className="ps-conversation-feed">
        {!messages.length && (document
          ? <div className="ps-muse-intro"><p className="ps-msg-muse">{t("What space shall we create?")}</p><div className="ps-quick-replies">{suggestions.map((text) => <button type="button" key={text} disabled={busy} onClick={() => void send(text)}>{text}</button>)}</div></div>
          : <div className="ps-greeting"><MuviGreeting thinking={interpreting || status === "submitted" || status === "streaming"}/><h1>{t("What space shall we create?")}</h1><div className="ps-suggestions">{suggestions.map((text) => <Button type="button" size="sm" variant="outline" key={text} disabled={busy || interpreting} onClick={() => { setInput(text); composer.current?.focus(); }} className="h-auto min-h-9 whitespace-normal text-left">{text}</Button>)}</div></div>)}
        {messages.map((message, messageIndex) => <Message key={message.id} from={message.role}>
          <MessageContent>
            <span className="sr-only">{message.role === "user" ? t("You") : "Muse"}: </span>
            {message.parts.map((part, index) => part.type === "text" ? message.role === "user"
              ? <p key={index} className="whitespace-pre-wrap wrap-anywhere">{part.text}</p>
              : <MessageResponse key={index} mode="streaming" isAnimating={status === "streaming" && messageIndex === messages.length - 1} controls={false}>{part.text}</MessageResponse>
              : null)}
          </MessageContent>
        </Message>)}
        {(preparing || status === "submitted") && <p className="ps-muse-thinking">{t("Muse is thinking…")}</p>}
        {tools && <div className="ps-conversation-tools">
          {progress && <div className="text-xs text-muted" role="status" aria-live="polite">
            <progress aria-label={reviewPhase === "walls" ? t("Long wall context batches reviewed") : t("Regions reviewed")} value={progress.completed} max={Math.max(1, progress.total)} className="h-1.5 w-full accent-accent"/>
            <p className="mt-1">{progress.completed} / {progress.total} {reviewPhase === "walls" ? t("long wall context batches reviewed") : t("regions reviewed")}{progress.failed > 0 ? t(" · {count} failed", { count: progress.failed }) : ""}{cancelRequested ? t(" · stopped") : ""}</p>
          </div>}
          {interpreting && <Button type="button" size="sm" variant="outline" disabled={cancelRequested} className="self-start" onClick={() => { setCancelRequested(true); setMuviActivity(null); controller.current?.abort(); }}><SquareIcon aria-hidden="true" data-icon="inline-start" />{cancelRequested ? t("Stopping…") : t("Cancel analysis")}</Button>}
          {interpretError && <p role="alert" className="text-xs leading-relaxed text-bad">{localizeMessage(locale, interpretError)}</p>}
          {designRun && designRun.status === "running" && designRun.operations > 0 && <p role="status" className="text-xs text-muted">{t("{count} operations saved", { count: designRun.operations })}{designRun.label ? ` · ${designRun.label}` : ""}</p>}
          {designRun && designRun.status !== "running" && <div className="ps-proposal">
            {designRun.summary && <p className="text-sm leading-relaxed whitespace-pre-wrap">{designRun.summary}</p>}
            {designRun.designReview && <div className="mt-3 text-xs leading-relaxed" aria-label={t("Interior design review")}>
              <p className="font-medium">{t("Interior design review")}</p>
              <p className="mt-1">{designRun.designReview.direction}</p>
              <ul className="mt-2 list-disc pl-4">{designRun.designReview.requirements.map(requirement => <li key={requirement.id} className="mt-2">
                {requirement.label} · {t("{count}/{minimum} elements linked", { count: requirement.count, minimum: requirement.minimum })}
                <p className="text-muted">{requirement.decision}</p>
              </li>)}</ul>
              <p className="mt-2 text-muted">{t("Linked elements are checked separately from geometry. Brand fit and visual quality still need your review.")}</p>
            </div>}
            {!!designRun.artifacts?.length && <details className="mt-3"><summary className="cursor-pointer text-xs">{t("Design review images ({count})", { count: designRun.artifacts.length })}</summary><div className="mt-2 flex flex-col gap-3">
              {designRun.artifacts.map(artifact => <figure key={artifact.id}>
                <Image src={artifact.image} alt={artifact.title} width={960} height={720} unoptimized className="h-auto w-full rounded" />
                <figcaption className="mt-1 text-[11px] text-muted">{artifact.kind === "concept" ? t("Generated concept · may differ from actual layout") : t("Layout schematic · materials and lighting omitted")} · {t("Review {revision}", { revision: artifact.revision })}</figcaption>
              </figure>)}
            </div></details>}
            <p className="mt-2 text-[11px] text-muted">{t(designRun.status === "partial" ? "Stopped · {count} operations saved. Undo steps back one operation at a time." : "{count} operations saved. Undo steps back one operation at a time.", { count: designRun.operations })} {t("{zones} zones · {objects} installations.", { zones: designRun.last.zones?.length ?? 0, objects: designRun.last.objects?.length ?? 0 })} {Boolean(designRun.last.wallSurfaces?.length) && t("{count} wall surface designs.", { count: designRun.last.wallSurfaces?.length ?? 0 })}</p>
            <p className="mt-2 text-xs" aria-label={t("Proposed assets")}>{t("Assets used")}: {[...new Set((designRun.last.objects ?? []).flatMap(object => [getModelAsset(object.modelAssetId)?.name, getMaterialAsset(object.materialAssetId)?.name].filter((name): name is string => Boolean(name))))].join(", ") || t("Basic shapes")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {designRun.status === "partial" && <Button type="button" size="sm" variant="default" className="ps-ink-button" disabled={busy || document !== designRun.last} onClick={() => void interpret("design", `${designRun.brief}\n\n${t("Continue the interrupted design. Keep every existing element and add only what is still missing.")}`.slice(0, 6000))}><CheckIcon aria-hidden="true" data-icon="inline-start" />{t("Continue design")}</Button>}
              <Button type="button" size="sm" variant="outline" disabled={!runUndoable || busy} title={runUndoable ? undefined : t("Available while the design is unchanged since this run.")} onClick={() => { if (runUndoable) { onDocumentChange(designRun.base); setDesignRun(null); setNotice(t("This design run was undone.")); } }}>{t("Undo this design run")}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDesignRun(null)}>{t("Dismiss")}</Button>
            </div>
          </div>}
          {proposal && <div className="ps-proposal">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.summary}</p>
            <p className="mt-2 text-[11px] text-muted">{t("{count} line changes. Coordinates and dimensions stay unchanged.", { count: changed })}</p>
            {stale && <p className="mt-2 text-xs text-amber">{t("The drawing or sources changed. Generate a new proposal before applying.")}</p>}
            <div className="mt-3 flex gap-2"><Button type="button" size="sm" disabled={Boolean(stale)} variant="default" className="ps-ink-button" onClick={() => { if (!stale) {
              onDocumentChange(proposal.document);
              setProposal(null);
              setNotice(t("Proposal applied. Review the geometry against your source."));
          } }}><CheckIcon aria-hidden="true" data-icon="inline-start" />{t("Apply changes")}</Button><Button type="button" size="sm" variant="outline" onClick={() => setProposal(null)}>{t("Cancel")}</Button></div>
          </div>}
          {notice && <p role="status" className="text-xs text-accent">{localizeMessage(locale, notice)}</p>}
        </div>}

        {error && <div role="alert" className="rounded-lg border border-hairline p-3 text-xs text-bad"><p>{t("Muse couldn’t reply. Please try again.")}</p><Button type="button" size="sm" variant="outline" onClick={clearError} className="mt-2">{t("Dismiss")}</Button></div>}
      </ConversationContent>
      <ConversationScrollButton aria-label={t("Scroll to latest message")} title={t("Scroll to latest message")} />
      </Conversation>
      {selection && <div className="ps-muse-selection" aria-label={t("Selected item")}>
        <div><span>{t("Selected item")}</span><strong>{selection.label}</strong></div>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClearSelection} aria-label={t("Clear selection")} title={t("Clear selection")}><XIcon aria-hidden="true" /></Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setInput(value => { const target = t("About “{name}”: ", { name: selection.label }); return value.startsWith(target) ? value : `${target}\n${value}`; }); composer.current?.focus(); }}><MessageCircleIcon aria-hidden="true" data-icon="inline-start" />{t("Ask about this")}</Button>
      </div>}
      <div className="ps-chat-composer">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="studio-muse-input" className="sr-only">{t("Ask Muse about your drawing")}</FieldLabel>
            <PromptInput onSubmit={({ text }) => { void send(text); }}>
              <PromptInputTextarea ref={composer} id="studio-muse-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={6000} rows={2} placeholder={messages.length ? t("Send a message…") : t("Tell Muse what you have in mind…")} />
              <PromptInputFooter>
                <PromptInputButton size="icon-sm" variant="ghost" onClick={onSources} aria-label={t("Add sources")} title={t("Add sources")}>
                  <PaperclipIcon aria-hidden="true" />
                </PromptInputButton>
                {busy && <PromptInputButton size="icon-sm" variant="outline" className="ml-auto" onClick={() => { setMuviActivity(null); controller.current?.abort(); onPlanningCancel?.(); void stop(); }} aria-label={t("Stop")} title={t("Stop")}>
                  <SquareIcon aria-hidden="true" />
                </PromptInputButton>}
                <PromptInputSubmit type="submit" size="icon-sm" variant="default" className={`ps-send${busy ? "" : " ml-auto"}`} disabled={busy || !input.trim()} aria-label={preparing ? t("Preparing message…") : t("Send message")} title={preparing ? t("Preparing message…") : t("Send message")}>
                  {preparing ? <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <ArrowUpIcon aria-hidden="true" />}
                </PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>
          </Field>
        </FieldGroup>
      </div>
    </section>);
}
