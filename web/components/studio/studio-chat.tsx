"use client";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, LoaderCircleIcon, MessageCircleIcon, PaperclipIcon, SparklesIcon, SquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { planRegions, regionDocument, combineRegionalResults } from "@/lib/plans/regions";
import { runRegionalBatches, globalWallAuditBatches, applyGlobalWallAudit, type RegionalProgress } from "@/lib/plans/regional-client";
import { emptySources, type SourceLibrary } from "@/lib/sources/schema";
import { selectedReferences } from "@/lib/sources/files";
import { DesignArtifactsSchema, type DesignArtifact } from "@/lib/plans/design-artifacts";
import Image from "next/image";
type Proposal = {
    artifacts?: DesignArtifact[];
    sources: SourceLibrary;
    document: PlanDocument;
    summary: string;
    base: PlanDocument;
    mode: "interpret" | "design";
};
export function StudioChat({ document, onDocumentChange, simple = false, sources = emptySources(), onSources, selection, onClearSelection, onRemoveSelection, onCollapse }: {
    onCollapse?: () => void;
    onSources: () => void;
    selection?: { id: string; label: string } | null;
    onClearSelection?: () => void;
    onRemoveSelection?: () => void;
    sources?: SourceLibrary;
    simple?: boolean;
    document: PlanDocument | null;
    onDocumentChange: (document: PlanDocument) => void;
}) {
    const { t, locale } = useI18n();
    const [transport] = useState(() => new DefaultChatTransport({
        api: "/api/plans/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({ body: {
                document: body?.document ?? null,
                locale: body?.locale,
                sources: body?.sources ?? [],
                messages: messages.slice(-24).map((message) => ({ role: message.role, parts: message.parts.filter((part) => part.type === "text").map((part) => ({ type: "text", text: part.text })) })),
            } }),
    }));
    const { messages, sendMessage, status, error, stop, clearError } = useChat({ transport });
    const [input, setInput] = useState("");
    const [interpreting, setInterpreting] = useState(false);
    const [interpretError, setInterpretError] = useState<string | null>(null);
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    const minPixels = 12;
    const composer = useRef<HTMLTextAreaElement>(null);
    const [progress, setProgress] = useState<RegionalProgress | null>(null);
    const [cancelRequested, setCancelRequested] = useState(false);
    const [reviewPhase, setReviewPhase] = useState<"regions" | "walls">("regions");
    const regions = useMemo(() => document ? planRegions(document, minPixels) : null, [document, minPixels]);
    const feedContainer = useRef<HTMLDivElement | null>(null);
    const [preparing, setPreparing] = useState(false);
    const preparingRef = useRef(false);
    const responding = status === "submitted" || status === "streaming";
    const busy = preparing || responding;
    const unknownCount = document?.lines.filter((line) => line.kind === "unknown").length ?? 0;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
    useEffect(() => { if (messages.length && feedContainer.current)
        feedContainer.current.scrollTop = feedContainer.current.scrollHeight; }, [messages, status]);
    async function interpret(mode: "interpret" | "design" = "interpret") {
        if (!document || interpreting || (mode === "design" && (!input.trim() || !document.scaleConfirmed)))
            return;
        const base = document;
        setInterpreting(true);
        setInterpretError(null);
        setProposal(null);
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
                            setInterpretError(`${audit.errors[0]} ${t("Unchecked long walls remain unknown.")}`);
                    }
                    setProposal({ sources, document: audited, summary: `${abortController.signal.aborted ? t("Analysis stopped. ") : ""}${coverage} ${auditSummary} ${t("{count} short lines preserved. Review before applying.", { count: planned.deferredCount })} ${completed < total || auditPartial ? t("Partial suggestions.") : ""}`, base, mode });
                }
                else {
                    setNotice(`${outcome.cancelled ? t("Analysis stopped. ") : ""}${coverage} ${t("No suggestions were applied.")}`);
                }
                if (outcome.errors.length)
                    setInterpretError(`${outcome.errors[0]} ${outcome.results.length ? t("Successful regions are retained for review.") : t("No regions could be reviewed.")}`);
            }
            else {
                const response = await fetch("/api/plans/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale, document: base, drawingSelected: sources.drawingSelected, brief: input.trim(), sources: await selectedReferences(sources, document) }), signal: abortController.signal });
                const body = await response.json();
                if (!response.ok)
                    throw new Error(body.error ?? t("Muse could not draft a layout."));
                const result = PlanDocumentSchema.parse(body.document);
                if (mounted.current)
                    setProposal({ sources, document: result, artifacts: DesignArtifactsSchema.parse(body.artifacts ?? []), summary: typeof body.summary === "string" ? body.summary : t("Review the proposed changes."), base, mode });
            }
        }
        catch (err) {
            if (!mounted.current)
                return;
            if (err instanceof Error && err.name === "AbortError") {
                setNotice(t("Draft cancelled. Your drawing is unchanged."));
                return;
            }
            setInterpretError(err instanceof Error ? err.message : t("Muse could not review the drawing."));
        }
        finally {
            if (mounted.current)
                setInterpreting(false);
        }
    }
    async function send(text: string) {
        if (!text.trim() || busy || preparingRef.current)
            return;
        preparingRef.current = true; setPreparing(true);
        clearError();
        setInput("");
        try { await sendMessage({ text: text.trim() }, { body: { locale, document: document ? { ...document, preview: undefined, texts: sources.drawingSelected ? document.texts : [] } : null, sources: await selectedReferences(sources, document) } });
        } catch { setInput(text); setNotice(t("Sources could not be prepared. Check the selected images and retry.")); }
        finally { preparingRef.current = false; setPreparing(false); }
    }
    const changed = proposal?.document.lines.filter((line, i) => line.kind !== proposal.base.lines[i]?.kind).length ?? 0;
    const stale = proposal && (proposal.base !== document || proposal.sources !== sources);
    return (<section className="ps-conversation" aria-label={t("Muse drawing assistant")}>
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true">✳</span><div><h2 className="text-sm font-semibold">Muse</h2>{busy && <p className="text-xs text-muted">{t("Muse is replying…")}</p>}</div></div>
        {onCollapse && <Button type="button" size="icon-sm" variant="ghost" onClick={onCollapse} aria-label={t("Minimize Muse")} title={t("Minimize Muse")}><ChevronDownIcon aria-hidden="true" /></Button>}
      </header>
      {(document || notice || interpretError) && <div className="ps-conversation-tools">
        <details open={!simple || interpreting}><summary className="cursor-pointer text-xs text-muted">{t("Drawing tools")}</summary><div className="mt-3">
        <Button type="button" size="sm" onClick={() => void interpret()} disabled={!document || !unknownCount || !regions?.batches.length || interpreting || busy} variant="default" className="w-full">{interpreting ? <LoaderCircleIcon aria-hidden="true" data-icon="inline-start" className="animate-spin motion-reduce:animate-none" /> : <SparklesIcon aria-hidden="true" data-icon="inline-start" />}{interpreting ? progress ? `${reviewPhase === "walls" ? t("Checking long wall context") : t("Reviewing regions")} · ${progress.completed}/${progress.total}` : t("Preparing your proposal…") : t("Analyze with Muse")}</Button>

        </div></details>
        {progress && <div className="mt-3 text-xs text-muted" role="status" aria-live="polite">
          <progress aria-label={reviewPhase === "walls" ? t("Long wall context batches reviewed") : t("Regions reviewed")} value={progress.completed} max={Math.max(1, progress.total)} className="h-1.5 w-full accent-accent"/>
          <p className="mt-1">{progress.completed} / {progress.total} {reviewPhase === "walls" ? t("long wall context batches reviewed") : t("regions reviewed")}{progress.failed > 0 ? t(" · {count} failed", { count: progress.failed }) : ""}{cancelRequested ? t(" · stopped") : ""}</p>
        </div>}
        {interpreting && <Button type="button" size="sm" variant="outline" disabled={cancelRequested} className="mt-2" onClick={() => { setCancelRequested(true); controller.current?.abort(); }}><SquareIcon aria-hidden="true" data-icon="inline-start" />{cancelRequested ? t("Stopping…") : t("Cancel analysis")}</Button>}
        {interpretError && <p role="alert" className="mt-3 text-xs leading-relaxed text-bad">{localizeMessage(locale, interpretError)}</p>}
        {proposal && <div className="mt-3 rounded-lg border border-hairline bg-sunken p-3">
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{proposal.summary}</p>
          {!!proposal.artifacts?.length && <details className="mt-3"><summary className="cursor-pointer text-xs">{t("Design review images ({count})", { count: proposal.artifacts.length })}</summary><div className="mt-2 flex flex-col gap-3">
            {proposal.artifacts.map(artifact => <figure key={artifact.id}>
              <Image src={artifact.image} alt={artifact.title} width={960} height={720} unoptimized className="h-auto w-full rounded" />
              <figcaption className="mt-1 text-[11px] text-muted">{artifact.kind === "concept" ? t("Generated concept · may differ from actual layout") : t("Layout schematic · materials and lighting omitted")} · {t("Review {revision}", { revision: artifact.revision })}</figcaption>
            </figure>)}
          </div></details>}
          <p className="mt-2 text-[11px] text-muted">{proposal.mode === "design" ? t("{zones} zones · {objects} installations. Applying replaces the current design.", { zones: proposal.document.zones?.length ?? 0, objects: proposal.document.objects?.length ?? 0 }) : t("{count} line changes. Coordinates and dimensions stay unchanged.", { count: changed })}</p>
          {stale && <p className="mt-2 text-xs text-amber">{t("The drawing or sources changed. Generate a new proposal before applying.")}</p>}
          <div className="mt-3 flex gap-2"><Button type="button" size="sm" disabled={Boolean(stale)} variant="default" onClick={() => { if (!stale) {
            onDocumentChange(proposal.document);
            setProposal(null);
            setNotice(t("Proposal applied. Review the geometry against your source."));
        } }}><CheckIcon aria-hidden="true" data-icon="inline-start" />{t("Apply changes")}</Button><Button type="button" size="sm" variant="outline" onClick={() => setProposal(null)}>{t("Cancel")}</Button></div>
        </div>}
        {notice && <p role="status" className="mt-3 text-xs text-accent">{localizeMessage(locale, notice)}</p>}
      </div>}
      <div ref={feedContainer} className="ps-conversation-feed" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div className="ps-greeting"><span className="ps-muse-orb" aria-hidden="true"/><h1>{t("What space shall we create?")}</h1><div className="ps-suggestions">{[t("Widen the path from the entrance to the stage"), t("Add a lounge to relax in")].map((text) => <Button type="button" size="sm" variant="outline" key={text} disabled={busy || interpreting} onClick={() => { setInput(text); composer.current?.focus(); }} className="h-auto min-h-9 whitespace-normal text-left">{text}</Button>)}</div></div>}
        {messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-6 rounded-xl bg-sunken p-3" : "mr-2"}><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{message.role === "user" ? t("You") : "Muse"}</p>{message.parts.map((part, index) => part.type === "text" ? <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{part.text}</p> : null)}</article>)}
        {status === "submitted" && <p className="animate-pulse text-xs text-muted">{t("Muse is thinking…")}</p>}
        {error && <div role="alert" className="rounded-lg border border-hairline p-3 text-xs text-bad"><p>{t("Muse couldn’t reply. Please try again.")}</p><Button type="button" size="sm" variant="outline" onClick={clearError} className="mt-2">{t("Dismiss")}</Button></div>}
      </div>
      {selection && <div className="ps-muse-selection" aria-label={t("Selected item")}>
        <div><span>{t("Selected item")}</span><strong>{selection.label}</strong></div>
        <Button type="button" size="sm" variant="ghost" disabled={!onRemoveSelection} onClick={onRemoveSelection}><Trash2Icon aria-hidden="true" data-icon="inline-start" />{t("Delete")}</Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClearSelection} aria-label={t("Clear selection")} title={t("Clear selection")}><XIcon aria-hidden="true" /></Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setInput(value => { const target = t("About “{name}”: ", { name: selection.label }); return value.startsWith(target) ? value : `${target}\n${value}`; }); composer.current?.focus(); }}><MessageCircleIcon aria-hidden="true" data-icon="inline-start" />{t("Ask about this")}</Button>
      </div>}
      <form className="ps-chat-composer" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="studio-muse-input" className="sr-only">{t("Ask Muse about your drawing")}</FieldLabel>
            <InputGroup>
              <InputGroupTextarea ref={composer} id="studio-muse-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={6000} rows={3} placeholder={t("Tell Muse what you have in mind…")} className="min-h-24 max-h-48" onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }} />
              <InputGroupAddon align="block-end" className="flex-wrap">
                <InputGroupButton size="sm" onClick={onSources}>
                  <PaperclipIcon aria-hidden="true" data-icon="inline-start" />{t("Add sources")}
                </InputGroupButton>
                {document && <InputGroupButton size="sm" variant="outline" disabled={!document.scaleConfirmed || !input.trim() || interpreting || busy} onClick={() => void interpret("design")}>
                  <SparklesIcon aria-hidden="true" data-icon="inline-start" />{t("Draft a layout")}
                </InputGroupButton>}
                {responding ? <InputGroupButton size="icon-sm" variant="default" className="ml-auto" onClick={() => void stop()} aria-label={t("Stop")} title={t("Stop")}>
                  <SquareIcon aria-hidden="true" />
                </InputGroupButton> : <InputGroupButton type="submit" size="icon-sm" variant="default" className="ml-auto" disabled={preparing || !input.trim()} aria-label={preparing ? t("Preparing message…") : t("Send message")} title={preparing ? t("Preparing message…") : t("Send message")}>
                  {preparing ? <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <ArrowUpIcon aria-hidden="true" />}
                </InputGroupButton>}
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </form>
    </section>);
}
