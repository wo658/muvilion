"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";

type Proposal = { document: PlanDocument; summary: string; base: PlanDocument; mode: "interpret" | "design" };

export function StudioChat({ document, onDocumentChange, simple = false }: {
  simple?: boolean;
  document: PlanDocument | null;
  onDocumentChange: (document: PlanDocument) => void;
}) {
  const [transport] = useState(() => new DefaultChatTransport({
    api: "/api/plans/chat",
    prepareSendMessagesRequest: ({ messages, body }) => ({ body: {
      document: body?.document ?? null,
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
  const feedContainer = useRef<HTMLDivElement | null>(null);
  const busy = status === "submitted" || status === "streaming";
  const unknownCount = document?.lines.filter((line) => line.kind === "unknown").length ?? 0;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (messages.length && feedContainer.current) feedContainer.current.scrollTop = feedContainer.current.scrollHeight; }, [messages, status]);

  async function interpret(mode: "interpret" | "design" = "interpret") {
    if (!document || interpreting || (mode === "design" && (!input.trim() || !document.scaleConfirmed))) return;
    const base = document;
    setInterpreting(true); setInterpretError(null); setProposal(null); setNotice(null);
    controller.current = new AbortController();
    try {
      const response = await fetch(`/api/plans/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: base, brief: mode === "design" ? input.trim() : undefined }), signal: controller.current.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Muse could not review the drawing.");
      const result = PlanDocumentSchema.parse(body.document);
      setProposal({ document: result, summary: typeof body.summary === "string" ? body.summary : "Review the proposed changes.", base, mode });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setInterpretError(err instanceof Error ? err.message : "Muse could not review the drawing.");
    } finally { setInterpreting(false); }
  }

  function send(text: string) {
    if (!text.trim() || busy) return;
    clearError(); setInput(""); void sendMessage({ text: text.trim() }, { body: { document: document ? { ...document, preview: undefined } : null } });
  }
  const changed = proposal?.document.lines.filter((line, i) => line.kind !== proposal.base.lines[i]?.kind).length ?? 0;
  const stale = proposal && proposal.base !== document;

  return (
    <section className="flex h-full min-h-[420px] flex-col bg-surface" aria-label="Muse drawing assistant">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true">✳</span><div><h2 className="text-sm font-semibold">Muse</h2><p className="text-[11px] text-muted">Your drawing partner</p></div></div>
        <span className="rounded-full border border-hairline px-2 py-1 text-[10px] text-muted">Meta AI</span>
      </header>
      <div className="border-b border-hairline p-4">
        <button type="button" onClick={() => void interpret()} disabled={!document || !unknownCount || interpreting || busy} className="w-full rounded-lg bg-accent px-4 py-2.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40">{interpreting ? "Reading your drawing…" : "Analyze with Muse"}</button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{document ? simple ? "Let Muse help you understand the drawing. Review suggestions before applying." : `Review up to 600 of ${unknownCount} unclassified lines. Suggestions stay separate until you apply them.` : "Upload a drawing to start planning together."}</p>
        {interpreting && <button className="mt-2 text-xs text-muted underline" onClick={() => controller.current?.abort()}>Cancel analysis</button>}
        {interpretError && <p role="alert" className="mt-3 text-xs leading-relaxed text-bad">{interpretError}</p>}
        {proposal && <div className="mt-3 rounded-lg border border-hairline bg-sunken p-3">
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{proposal.summary}</p>
          <p className="mt-2 text-[11px] text-muted">{proposal.mode === "design" ? `${proposal.document.objects?.length ?? 0} objects proposed. Applying replaces the current concept objects; walls and scale stay unchanged.` : `${changed} line classifications suggested. Coordinates and dimensions stay unchanged.`}</p>
          {stale && <p className="mt-2 text-xs text-amber">The drawing changed. Run analysis again before applying.</p>}
          <div className="mt-3 flex gap-2"><button disabled={Boolean(stale)} className="rounded-md bg-ink px-3 py-1.5 text-xs text-surface disabled:opacity-40" onClick={() => { if (!stale) { onDocumentChange(proposal.document); setProposal(null); setNotice("Proposal applied. Review the geometry against your source."); } }}>Apply suggestions</button><button className="px-2 text-xs text-muted" onClick={() => setProposal(null)}>Discard</button></div>
        </div>}
        {notice && <p role="status" className="mt-3 text-xs text-accent">{notice}</p>}
      </div>
      <div ref={feedContainer} className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div><p className="text-sm leading-relaxed text-ink-soft">Let’s understand the space first. I can help you review the drawing, check what’s uncertain, and develop your event brief.</p><div className="mt-4 flex flex-col items-start gap-2">{["What should I verify in this drawing?", "How do I distinguish walls from dimension lines?", "Help me plan a developer event in this space."].map((text) => <button key={text} onClick={() => send(text)} className="rounded-lg border border-hairline px-3 py-2 text-left text-xs text-ink-soft transition hover:border-accent">{text}</button>)}</div></div>}
        {messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-6 rounded-xl bg-sunken p-3" : "mr-2"}><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{message.role === "user" ? "You" : "Muse"}</p>{message.parts.map((part, index) => part.type === "text" ? <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{part.text}</p> : null)}</article>)}
        {status === "submitted" && <p className="animate-pulse text-xs text-muted">Muse is thinking…</p>}
        {error && <div role="alert" className="rounded-lg border border-hairline p-3 text-xs text-bad"><p>Muse couldn’t reply. Check the API configuration and try again.</p><button onClick={clearError} className="mt-2 underline">Dismiss</button></div>}
      </div>
      <form className="border-t border-hairline p-4" onSubmit={(event) => { event.preventDefault(); send(input); }}>
        <label htmlFor="studio-muse-input" className="sr-only">Ask Muse about your drawing</label>
        <textarea id="studio-muse-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={6000} rows={2} placeholder="Ask about the drawing or describe your event…" className="w-full resize-none rounded-lg border border-hairline bg-bg p-3 text-sm outline-none focus:border-accent" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(input); } }} />
        <button type="button" disabled={!document?.scaleConfirmed || !input.trim() || interpreting || busy} onClick={() => void interpret("design")} className="mt-2 w-full rounded-lg border border-accent px-3 py-2 text-xs text-accent disabled:opacity-40">Draft layout with Muse</button>
        <p className="mt-1 text-[10px] text-muted">Confirm scale, then describe a layout above to create or revise a concept.</p>
        <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[10px] text-muted">Chat advises. Draft a layout to propose editable objects.</p>{busy ? <button type="button" onClick={() => void stop()} className="rounded-md border border-hairline px-3 py-1.5 text-xs">Stop</button> : <button type="submit" disabled={!input.trim()} className="rounded-md bg-ink px-3 py-1.5 text-xs text-surface disabled:opacity-40">Send ↗</button>}</div>
      </form>
    </section>
  );
}
