"use client";
import type { PricingContext } from "@/lib/booths/pricing";
import { IntentDecision } from "@/lib/plans/intent";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { ArrowUpIcon, PanelRightCloseIcon, CheckIcon, LoaderCircleIcon, MessageCircleIcon, PaperclipIcon, SquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { useEffect, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { planRegions, regionDocument, combineRegionalResults } from "@/lib/plans/regions";
import { runRegionalBatches, globalWallAuditBatches, applyGlobalWallAudit, type RegionalProgress } from "@/lib/plans/regional-client";
import { emptySources, type SourceLibrary } from "@/lib/sources/schema";
import { selectedReferences } from "@/lib/sources/files";
import { DesignArtifactsSchema, type DesignArtifact } from "@/lib/plans/design-artifacts";
import Image from "next/image";
import { getModelAsset, getMaterialAsset } from "@/lib/assets/catalog";
import Link from "next/link";
import { MuviAvatar } from "@/components/muvi/muvi-avatar";
import { MuviGreeting } from "@/components/muvi/muvi";
type Proposal = {
    artifacts?: DesignArtifact[];
    sources: SourceLibrary;
    document: PlanDocument;
    summary: string;
    base: PlanDocument;
    mode: "interpret" | "design";
};
export function StudioChat({ document, onDocumentChange, sources = emptySources(), onSources, selection, onClearSelection, onRemoveSelection, onCollapse, boothPricing }: {
    boothPricing?: PricingContext;
    onCollapse?: () => void;

    onSources: () => void;
    selection?: { id: string; label: string } | null;
    onClearSelection?: () => void;
    onRemoveSelection?: () => void;
    sources?: SourceLibrary;
    document: PlanDocument | null;
    onDocumentChange: (document: PlanDocument) => void;
}) {
    const { t, locale } = useI18n();
    const [transport] = useState(() => new DefaultChatTransport({
        api: "/api/plans/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({ body: {
                document: body?.document ?? null,
                boothPricing: body?.boothPricing,
                locale: body?.locale,
                sources: body?.sources ?? [],
                messages: messages.slice(-24).map((message) => ({ role: message.role, parts: message.parts.filter((part) => part.type === "text").map((part) => ({ type: "text", text: part.text })) })),
            } }),
    }));
    const { messages, sendMessage, status, error, stop, clearError, setMessages } = useChat({ transport });
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
    const feedContainer = useRef<HTMLDivElement | null>(null);
    const [preparing, setPreparing] = useState(false);
    const preparingRef = useRef(false);
    const currentContext = useRef({ document, sources, selection });
    useEffect(() => { currentContext.current = { document, sources, selection }; }, [document, sources, selection]);
    const responding = status === "submitted" || status === "streaming";
    const busy = interpreting || preparing || responding;
    const unknownCount = document?.lines.filter((line) => line.kind === "unknown").length ?? 0;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
    useEffect(() => { if (messages.length && feedContainer.current)
        feedContainer.current.scrollTop = feedContainer.current.scrollHeight; }, [messages, status, progress, proposal, notice]);
    async function interpret(mode: "interpret" | "design" = "interpret", brief = input.trim()) {
        if (!document || interpreting || (mode === "design" && (!brief.trim() || !document.scaleConfirmed)))
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
                            setInterpretError(`${localizeMessage(locale, audit.errors[0])} ${t("Unchecked long walls remain unknown.")}`);
                    }
                    setProposal({ sources, document: audited, summary: `${abortController.signal.aborted ? t("Analysis stopped. ") : ""}${coverage} ${auditSummary} ${t("{count} short lines preserved. Review before applying.", { count: planned.deferredCount })} ${completed < total || auditPartial ? t("Partial suggestions.") : ""}`, base, mode });
                }
                else {
                    setNotice(`${outcome.cancelled ? t("Analysis stopped. ") : ""}${coverage} ${t("No suggestions were applied.")}`);
                }
                if (outcome.errors.length)
                    setInterpretError(`${localizeMessage(locale, outcome.errors[0])} ${outcome.results.length ? t("Successful regions are retained for review.") : t("No regions could be reviewed.")}`);
            }
            else {
                const response = await fetch("/api/plans/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale, document: base, drawingSelected: sources.drawingSelected, brief, sources: await selectedReferences(sources, document) }), signal: abortController.signal });
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
        try {
            const response = await fetch("/api/plans/intent", {
                method: "POST", headers: { "Content-Type": "application/json" }, signal: abortController.signal,
                body: JSON.stringify({
                    message, locale,
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
                await sendMessage({ text: message }, { body: { locale, boothPricing, document: document ? { ...document, preview: undefined, texts: sources.drawingSelected ? document.texts : [] } : null, sources: references } });
            } else {
                setMessages(previous => [...previous,
                    { id: generateId(), role: "user", parts: [{ type: "text", text: message }] },
                    { id: generateId(), role: "assistant", parts: [{ type: "text", text: decision.message }] },
                ]);
                if (decision.intent === "design" || decision.intent === "interpret") {
                    await interpret(decision.intent, decision.brief);
                }
            }
        } catch (err) {
            if (!mounted.current) return;
            setInput(current => current || text);
            setNotice(err instanceof Error && err.name === "AbortError"
                ? t("Request cancelled. Your drawing is unchanged.")
                : err instanceof Error ? err.message : t("Muse could not determine your request. Please try again."));
        } finally {
            preparingRef.current = false;
            if (mounted.current) setPreparing(false);
        }
    }
    const changed = proposal?.document.lines.filter((line, i) => line.kind !== proposal.base.lines[i]?.kind).length ?? 0;
    const stale = proposal && (proposal.base !== document || proposal.sources !== sources);
    const tools = interpreting || progress || interpretError || proposal || notice;
    const suggestions = [t("Widen the path from the entrance to the stage"), t("Price the booths based on their size and location")];
    return (<section className="ps-conversation" aria-label={t("Muse drawing assistant")}>
      <header className="ps-conversation-head">
        <Link href="/muvi" target="_blank" rel="noopener noreferrer" aria-label={t("Meet Muvi in 3D (new tab)")}><MuviAvatar size={32}/></Link>
        {busy && <h2 className="ps-muse-status">{t("Muse is replying…")}</h2>}

        {onCollapse && <Button type="button" size="icon-sm" variant="ghost" className="ml-auto" onClick={onCollapse} aria-label={t("Minimize Muse")} title={t("Minimize Muse")} aria-expanded={true} aria-controls="muse-panel"><PanelRightCloseIcon aria-hidden="true" /></Button>}

      </header>
      <div ref={feedContainer} className="ps-conversation-feed" aria-live="polite" aria-relevant="additions text">
        {!messages.length && (document
          ? <div className="ps-muse-intro"><p className="ps-msg-muse">{t("What space shall we create?")}</p><div className="ps-quick-replies">{suggestions.map((text) => <button type="button" key={text} disabled={busy} onClick={() => void send(text)}>{text}</button>)}</div></div>
          : <div className="ps-greeting"><MuviGreeting thinking={interpreting || status === "submitted" || status === "streaming"}/><h1>{t("What space shall we create?")}</h1><div className="ps-suggestions">{suggestions.map((text) => <Button type="button" size="sm" variant="outline" key={text} disabled={busy || interpreting} onClick={() => { setInput(text); composer.current?.focus(); }} className="h-auto min-h-9 whitespace-normal text-left">{text}</Button>)}</div></div>)}
        {messages.map((message) => <article key={message.id} className={message.role === "user" ? "ps-msg-user" : "ps-msg-muse"}><span className="sr-only">{message.role === "user" ? t("You") : "Muse"}: </span>{message.parts.map((part, index) => part.type === "text" ? <p key={index}>{part.text}</p> : null)}</article>)}
        {(preparing || status === "submitted") && <p className="ps-muse-thinking">{t("Muse is thinking…")}</p>}
        {tools && <div className="ps-conversation-tools">
          {progress && <div className="text-xs text-muted" role="status" aria-live="polite">
            <progress aria-label={reviewPhase === "walls" ? t("Long wall context batches reviewed") : t("Regions reviewed")} value={progress.completed} max={Math.max(1, progress.total)} className="h-1.5 w-full accent-accent"/>
            <p className="mt-1">{progress.completed} / {progress.total} {reviewPhase === "walls" ? t("long wall context batches reviewed") : t("regions reviewed")}{progress.failed > 0 ? t(" · {count} failed", { count: progress.failed }) : ""}{cancelRequested ? t(" · stopped") : ""}</p>
          </div>}
          {interpreting && <Button type="button" size="sm" variant="outline" disabled={cancelRequested} className="self-start" onClick={() => { setCancelRequested(true); controller.current?.abort(); }}><SquareIcon aria-hidden="true" data-icon="inline-start" />{cancelRequested ? t("Stopping…") : t("Cancel analysis")}</Button>}
          {interpretError && <p role="alert" className="text-xs leading-relaxed text-bad">{localizeMessage(locale, interpretError)}</p>}
          {proposal && <div className="ps-proposal">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.summary}</p>
            {!!proposal.artifacts?.length && <details className="mt-3"><summary className="cursor-pointer text-xs">{t("Design review images ({count})", { count: proposal.artifacts.length })}</summary><div className="mt-2 flex flex-col gap-3">
              {proposal.artifacts.map(artifact => <figure key={artifact.id}>
                <Image src={artifact.image} alt={artifact.title} width={960} height={720} unoptimized className="h-auto w-full rounded" />
                <figcaption className="mt-1 text-[11px] text-muted">{artifact.kind === "concept" ? t("Generated concept · may differ from actual layout") : t("Layout schematic · materials and lighting omitted")} · {t("Review {revision}", { revision: artifact.revision })}</figcaption>
              </figure>)}
            </div></details>}
            <p className="mt-2 text-[11px] text-muted">{proposal.mode === "design" ? t("{zones} zones · {objects} installations. Applying replaces the current design.", { zones: proposal.document.zones?.length ?? 0, objects: proposal.document.objects?.length ?? 0 }) : t("{count} line changes. Coordinates and dimensions stay unchanged.", { count: changed })}</p>
          {proposal.mode === "design" && <p className="mt-2 text-xs" aria-label={t("Proposed assets")}>{t("Assets used")}: {[...new Set((proposal.document.objects ?? []).flatMap(object => [getModelAsset(object.modelAssetId)?.name, getMaterialAsset(object.materialAssetId)?.name].filter((name): name is string => Boolean(name))))].join(", ") || t("Basic shapes")}</p>}
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
              <InputGroupTextarea ref={composer} id="studio-muse-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={6000} rows={2} placeholder={messages.length ? t("Send a message…") : t("Tell Muse what you have in mind…")} className="min-h-16 max-h-48" onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }} />
              <InputGroupAddon align="block-end">
                <InputGroupButton size="icon-sm" variant="ghost" onClick={onSources} aria-label={t("Add sources")} title={t("Add sources")}>
                  <PaperclipIcon aria-hidden="true" />
                </InputGroupButton>
                {busy && <InputGroupButton size="icon-sm" variant="outline" className="ml-auto" onClick={() => { controller.current?.abort(); void stop(); }} aria-label={t("Stop")} title={t("Stop")}>
                  <SquareIcon aria-hidden="true" />
                </InputGroupButton>}
                <InputGroupButton type="submit" size="icon-sm" variant="default" className={`ps-send${busy ? "" : " ml-auto"}`} disabled={busy || !input.trim()} aria-label={preparing ? t("Preparing message…") : t("Send message")} title={preparing ? t("Preparing message…") : t("Send message")}>
                  {preparing ? <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <ArrowUpIcon aria-hidden="true" />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </form>
    </section>);
}
