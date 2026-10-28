"use client";
import { Button } from "../ui";
import { Textarea } from "../ui/textarea";
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
export function StudioChat({ document, onDocumentChange, simple = false, sources = emptySources(), selection, onClearSelection, onRemoveSelection }: {
    selection?: { id: string; label: string } | null;
    onClearSelection?: () => void;
    onRemoveSelection?: () => void;
    sources?: SourceLibrary;
    simple?: boolean;
    document: PlanDocument | null;
    onDocumentChange: (document: PlanDocument) => void;
}) {
    const [transport] = useState(() => new DefaultChatTransport({
        api: "/api/plans/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({ body: {
                document: body?.document ?? null,
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
    const busy = preparing || status === "submitted" || status === "streaming";
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
                    setNotice("검토할 주요 선이 없어요. 도면의 짧은 세부 선은 그대로 유지됩니다.");
                    return;
                }
                const outcome = await runRegionalBatches(planned.batches, async (batch, signal) => {
                    const crop = await regionDocument(base, batch);
                    if (signal.aborted)
                        throw new DOMException("Analysis cancelled", "AbortError");
                    const response = await fetch("/api/plans/interpret", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ document: crop }), signal,
                    });
                    const body = await response.json();
                    if (!response.ok)
                        throw new Error(typeof body.error === "string" ? body.error : "Muse could not review a region.");
                    return PlanDocumentSchema.parse(body.document);
                }, abortController.signal, (next) => { if (mounted.current)
                    setProgress(next); });
                if (!mounted.current)
                    return;
                const { completed, total, failed } = outcome.progress;
                const unreviewed = total - completed - failed;
                const coverage = `${completed} of ${total} regions reviewed${failed ? `; ${failed} failed` : ""}${unreviewed ? `; ${unreviewed} not reviewed` : ""}.`;
                if (outcome.results.length) {
                    const result = combineRegionalResults(base, outcome.results, {
                        completed, total, failed, candidates: planned.candidateCount, deferred: planned.deferredCount,
                    });
                    const originalUnknownIDs = new Set(base.lines.filter(line => line.kind === "unknown").map(line => line.id));
                    const proposedWallCount = result.lines.filter(line => line.kind === "wall" && originalUnknownIDs.has(line.id)).length;
                    const wallBatches = globalWallAuditBatches(base, result);
                    const longWallCount = wallBatches.reduce((count, batch) => count + batch.lines.length, 0);
                    const shortWallCount = proposedWallCount - longWallCount;
                    let audited = result;
                    let auditSummary = `${proposedWallCount} new wall candidates: ${shortWallCount} short walls retain regional review; no long wall candidates required a full-page check.`;
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
                                throw new Error(typeof body.error === "string" ? body.error : "Wall context review failed.");
                            return PlanDocumentSchema.parse(body.document);
                        }, abortController.signal, next => { if (mounted.current)
                            setProgress(next); });
                        if (!mounted.current)
                            return;
                        audited = applyGlobalWallAudit(base, result, audit.results, audit.progress);
                        const wallCount = audited.lines.filter(line => line.kind === "wall" && originalUnknownIDs.has(line.id)).length;
                        auditSummary = `Long wall context checked in ${audit.progress.completed}/${audit.progress.total} batches${audit.progress.failed ? `; ${audit.progress.failed} failed` : ""}. ${wallCount} new wall candidates retained: ${wallCount - shortWallCount}/${longWallCount} long walls verified and ${shortWallCount} short walls from regional review. Rejected or unchecked long walls remain unknown.`;
                        auditPartial = audit.progress.completed < audit.progress.total;
                        if (audit.errors.length)
                            setInterpretError(`${audit.errors[0]} Unchecked long wall candidates remain unknown.`);
                    }
                    setProposal({ sources, document: audited, summary: `${abortController.signal.aborted ? "Analysis stopped. " : ""}${coverage} ${auditSummary} ${planned.deferredCount} short lines were preserved without analysis. Review ${completed < total || auditPartial ? "these partial suggestions" : "the suggestions"} before applying.`, base, mode });
                }
                else {
                    setNotice(`${outcome.cancelled ? "Analysis stopped. " : ""}${coverage} No suggestions were applied.`);
                }
                if (outcome.errors.length)
                    setInterpretError(`${outcome.errors[0]} ${outcome.results.length ? "Successful regions are retained for review." : "No regions could be reviewed."}`);
            }
            else {
                const response = await fetch("/api/plans/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: base, drawingSelected: sources.drawingSelected, brief: input.trim(), sources: await selectedReferences(sources, document) }), signal: abortController.signal });
                const body = await response.json();
                if (!response.ok)
                    throw new Error(body.error ?? "Muse could not draft a layout.");
                const result = PlanDocumentSchema.parse(body.document);
                if (mounted.current)
                    setProposal({ sources, document: result, artifacts: DesignArtifactsSchema.parse(body.artifacts ?? []), summary: typeof body.summary === "string" ? body.summary : "Review the proposed changes.", base, mode });
            }
        }
        catch (err) {
            if (!mounted.current)
                return;
            if (err instanceof Error && err.name === "AbortError") {
                setNotice("Draft cancelled. Your drawing is unchanged.");
                return;
            }
            setInterpretError(err instanceof Error ? err.message : "Muse could not review the drawing.");
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
        try { await sendMessage({ text: text.trim() }, { body: { document: document ? { ...document, preview: undefined, texts: sources.drawingSelected ? document.texts : [] } : null, sources: await selectedReferences(sources, document) } });
        } catch { setInput(text); setNotice("Sources could not be prepared. Check the selected images and retry."); }
        finally { preparingRef.current = false; setPreparing(false); }
    }
    const changed = proposal?.document.lines.filter((line, i) => line.kind !== proposal.base.lines[i]?.kind).length ?? 0;
    const stale = proposal && (proposal.base !== document || proposal.sources !== sources);
    return (<section className="flex h-full min-h-[420px] flex-col bg-surface" aria-label="Muse drawing assistant">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true">✳</span><div><h2 className="text-sm font-semibold">Muse</h2><p className="text-[11px] text-muted">공간을 함께 만드는 파트너</p></div></div>
      </header>
      <div className="border-b border-hairline p-4">
        <details open={!simple || interpreting}><summary className="cursor-pointer text-xs text-muted">Drawing tools</summary><div className="mt-3">
        <Button type="button" onClick={() => void interpret()} disabled={!document || !unknownCount || !regions?.batches.length || interpreting || busy} variant="primary" className="w-full">{interpreting ? progress ? `${reviewPhase === "walls" ? "Checking long wall context" : "Reviewing regions"} · ${progress.completed}/${progress.total}` : "Preparing your proposal…" : "Analyze with Muse"}</Button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{document ? simple ? "Let Muse help you understand the drawing. Review suggestions before applying." : `${regions?.candidateCount ?? 0} candidate lines across ${regions?.batches.length ?? 0} regions. Every region is reviewed; suggestions stay separate until you apply them.` : "Upload a drawing to start planning together."}</p>
        </div></details>
        {progress && <div className="mt-3 text-xs text-muted" role="status" aria-live="polite">
          <progress aria-label={reviewPhase === "walls" ? "Long wall context batches reviewed" : "Regions reviewed"} value={progress.completed} max={Math.max(1, progress.total)} className="h-1.5 w-full accent-accent"/>
          <p className="mt-1">{progress.completed} / {progress.total} {reviewPhase === "walls" ? "long wall context batches reviewed" : "regions reviewed"}{progress.failed > 0 ? ` · ${progress.failed} failed` : ""}{cancelRequested ? " · stopped" : ""}</p>
        </div>}
        {interpreting && <Button disabled={cancelRequested} className="mt-2" onClick={() => { setCancelRequested(true); controller.current?.abort(); }}>{cancelRequested ? "Stopping…" : "Cancel analysis"}</Button>}
        {interpretError && <p role="alert" className="mt-3 text-xs leading-relaxed text-bad">{interpretError}</p>}
        {proposal && <div className="mt-3 rounded-lg border border-hairline bg-sunken p-3">
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{proposal.summary}</p>
          {!!proposal.artifacts?.length && <details className="mt-3"><summary className="cursor-pointer text-xs">디자인 검토 이미지 ({proposal.artifacts.length})</summary><div className="mt-2 flex flex-col gap-3">
            {proposal.artifacts.map(artifact => <figure key={artifact.id}>
              <Image src={artifact.image} alt={artifact.title} width={960} height={720} unoptimized className="h-auto w-full rounded" />
              <figcaption className="mt-1 text-[11px] text-muted">{artifact.kind === "concept" ? "생성 시안 · 실제 배치와 다를 수 있음" : "배치 도식 · 재질과 조명은 생략"} · 검토 {artifact.revision}</figcaption>
            </figure>)}
          </div></details>}
          <p className="mt-2 text-[11px] text-muted">{proposal.mode === "design" ? `${proposal.document.zones?.length ?? 0} space zones and ${proposal.document.objects?.length ?? 0} installations proposed. Applying replaces this design; source walls, scale and ceiling conditions stay unchanged.` : `${changed} line classifications suggested. Coordinates and dimensions stay unchanged.`}</p>
          {stale && <p className="mt-2 text-xs text-amber">The drawing or sources changed. Generate a new proposal before applying.</p>}
          <div className="mt-3 flex gap-2"><Button disabled={Boolean(stale)} variant="primary" onClick={() => { if (!stale) {
            onDocumentChange(proposal.document);
            setProposal(null);
            setNotice("Proposal applied. Review the geometry against your source.");
        } }}>변경 적용</Button><Button onClick={() => setProposal(null)}>취소</Button></div>
        </div>}
        {notice && <p role="status" className="mt-3 text-xs text-accent">{notice}</p>}
      </div>
      <div ref={feedContainer} className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div><p className="text-sm leading-relaxed text-ink-soft">어떤 공간을 만들고 싶으세요?</p><div className="mt-4 flex flex-col items-start gap-2">{["입구에서 무대까지 동선을 넓혀줘", "쉴 수 있는 라운지를 배치해줘"].map((text) => <Button key={text} onClick={() => { setInput(text); composer.current?.focus(); }} className="h-auto whitespace-normal text-left">{text}</Button>)}</div></div>}
        {messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-6 rounded-xl bg-sunken p-3" : "mr-2"}><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{message.role === "user" ? "You" : "Muse"}</p>{message.parts.map((part, index) => part.type === "text" ? <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{part.text}</p> : null)}</article>)}
        {status === "submitted" && <p className="animate-pulse text-xs text-muted">Muse is thinking…</p>}
        {error && <div role="alert" className="rounded-lg border border-hairline p-3 text-xs text-bad"><p>Muse couldn’t reply. Check the API configuration and try again.</p><Button onClick={clearError} className="mt-2">Dismiss</Button></div>}
      </div>
      {selection && <div className="ps-muse-selection" aria-label="선택한 대상">
        <div><span>선택한 대상</span><strong>{selection.label}</strong></div>
        <Button variant="ghost" disabled={!onRemoveSelection} onClick={onRemoveSelection}>삭제</Button>
        <Button variant="ghost" onClick={onClearSelection} aria-label="선택 해제">×</Button>
        <Button onClick={() => { setInput(value => { const target = `“${selection.label}”에 대해: `; return value.startsWith(target) ? value : `${target}\n${value}`; }); composer.current?.focus(); }}>이 대상으로 요청하기</Button>
      </div>}
      <form className="border-t border-hairline p-4" onSubmit={(event) => { event.preventDefault(); send(input); }}>
        <label htmlFor="studio-muse-input" className="sr-only">Ask Muse about your drawing</label>
        <Textarea ref={composer} id="studio-muse-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={6000} rows={2} placeholder="원하는 배치나 변경을 말씀해 주세요…" className="w-full resize-none rounded-lg border border-hairline bg-bg p-3 text-sm outline-none focus:border-accent" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        send(input);
    } }}/>
        <Button type="button" disabled={!document?.scaleConfirmed || !input.trim() || interpreting || busy} onClick={() => void interpret("design")} className="mt-2 w-full">배치 제안 만들기</Button>

        <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[10px] text-muted">제안을 확인하고 적용할 수 있어요</p>{busy ? <Button type="button" onClick={() => void stop()}>Stop</Button> : <Button type="submit" disabled={!input.trim()} variant="primary">대화하기 ↗</Button>}</div>
      </form>
    </section>);
}
