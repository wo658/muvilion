"use client";

/**
 * The default screen: the venue as a 3D model, one headline number, and Muse talking the user
 * through the run in plain language. Everything technical lives behind "Details" (the review
 * console, which shares this view's chat so it shows the same run).
 */
import { Chat, useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { diffLayouts } from "@/lib/agent/analysis";
import type { AgentUIMessage } from "@/lib/agent/events";
import { askUserMessage, createChatTransport, isRunMessage, latestRunMessage, runUserMessage } from "@/lib/chat/transport";
import { approvalItems, approvalReducer, type ApprovalState } from "@/lib/ui/approvals";
import { buildFeed, chatErrorInfo, runSays, type FeedItem } from "@/lib/ui/feed";
import { museStatus } from "@/lib/ui/muse-status";
import { headline, venueShortName, type Headline } from "@/lib/ui/plain";
import { deriveRunState, type RunState } from "@/lib/ui/run-state";
import { layoutSummary, onSiteChecks } from "@/lib/ui/summary";
import { DEFAULT_VENUE_ID, venueById, VENUES } from "@/lib/venues";
import { ReviewConsole } from "../review-console";
import { placementKey } from "../stage";
import { LayoutSheet } from "./layout-sheet";
import { ApprovalButtons, AskBox, HeadlineText, MuseBubble, ResultCard, Typing, UserBubble } from "./muse-feed";
import { SimpleCanvas } from "./simple-canvas";

type Status = { live: boolean };

const EMPTY_TEXT = "Pick a space and I'll plan the booth layout, test it with virtual visitors, and fix what gets crowded.";

/** One conversation per venue: switching venue shows that venue's chat (kept while the page is open). */
const newChat = (venueId: string) => new Chat<AgentUIMessage>({ id: `muse-${venueId}`, transport: createChatTransport() });

/** The headline of a run: first test vs the final one (or the latest one while it runs). */
function runHeadline(state: RunState): Headline | null {
  const its = state.iterations;
  const baseSim = its.find((i) => i.iteration === 0)?.sim?.metrics.crowded_s_per_visitor;
  if (baseSim === undefined) return null;
  const latestSim = [...its].reverse().find((i) => i.iteration > 0 && i.sim);
  const afterSim = state.done ? (state.done.final ?? undefined)?.crowded_s_per_visitor : latestSim?.sim?.metrics.crowded_s_per_visitor;
  return headline(baseSim, state.done?.finalIteration === 0 ? undefined : afterSim);
}

export function SimpleView() {
  const [chats] = useState(() => new Map(VENUES.map((v) => [v.id, newChat(v.id)])));
  const [venueId, setVenueId] = useState(DEFAULT_VENUE_ID);
  const chat = chats.get(venueId)!;
  const { messages, sendMessage, status: chatStatus, error, stop, clearError, regenerate } = useChat<AgentUIMessage>({ chat });
  const [status, setStatus] = useState<Status | null>(null);
  const [details, setDetails] = useState(false);
  /** The run message on the canvas (null = the latest run). */
  const [runId, setRunId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [placedKey, setPlacedKey] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalState>({});
  const [sheet, setSheet] = useState(false);
  const askInput = useRef<HTMLInputElement>(null);
  const feedEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/agent")
      .then((r) => r.json())
      .then((s: Status) => alive && setStatus({ live: Boolean(s.live) }))
      .catch(() => alive && setStatus({ live: false }));
    return () => {
      alive = false;
    };
  }, []);

  const busy = chatStatus === "submitted" || chatStatus === "streaming";
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const pending = lastUser?.metadata?.intent ?? null;
  const last = messages[messages.length - 1];
  const streamingId = busy && last?.role === "assistant" ? last.id : undefined;
  const runMsg = useMemo(() => latestRunMessage(messages, runId), [messages, runId]);
  const state = useMemo(() => deriveRunState(runMsg), [runMsg]);
  const says = useMemo(() => runSays(runMsg), [runMsg]);
  const option = venueById(venueId) ?? VENUES[0];
  const venue = state.run?.venue ?? option.project.venue;
  const specs = state.run?.booths ?? option.project.booths;
  const visitors = state.run?.scenario.agents ?? option.scenario?.agents ?? 300;
  const runBusy = busy && pending === "run";

  // ---- which layout is on the canvas ----
  const its = state.iterations;
  const baseIt = its.find((i) => i.iteration === 0);
  const animKey = placementKey(state.run, baseIt);
  const holdBaseline = selected === null && animKey !== null && placedKey !== animKey;
  const latest = [...its].reverse().find((i) => i.layout);
  const shown = its.find((i) => i.layout && i.iteration === (holdBaseline ? 0 : selected)) ?? latest;
  const afterIt =
    (state.done && state.done.finalIteration !== 0 ? its.find((i) => i.iteration === state.done!.finalIteration) : undefined) ??
    [...its].reverse().find((i) => i.iteration > 0 && i.layout);
  const canToggle = Boolean(baseIt?.layout && afterIt?.layout);
  const side = shown?.iteration === 0 ? "before" : "after";
  const moves =
    shown && shown.iteration > 0 && baseIt?.layout && shown.layout ? diffLayouts(baseIt.layout.response.layout, shown.layout.response.layout) : undefined;
  const onPlacementEnd = useCallback((k: string) => setPlacedKey(k), []);

  // ---- the headline: first test vs the final (or latest) one ----
  const baseSim = baseIt?.sim?.metrics.crowded_s_per_visitor;
  const afterSim = state.done
    ? (state.done.final ?? undefined)?.crowded_s_per_visitor
    : [...its].reverse().find((i) => i.iteration > 0 && i.sim)?.sim?.metrics.crowded_s_per_visitor;
  const finalIsBaseline = state.done?.finalIteration === 0;
  const h = runHeadline(state);

  // ---- feed ----
  const feed = useMemo(() => buildFeed(messages, approvals, { streamingId }), [messages, approvals, streamingId]);
  const focusedItem = focused ? feed.find((f): f is Extract<FeedItem, { kind: "say" }> => f.kind === "say" && f.id === focused) : undefined;
  const highlight = focusedItem && focusedItem.messageId === runMsg?.id ? focusedItem.say.booth_ids : undefined;
  const items = runMsg ? approvalItems(says, approvals, runMsg.id) : [];
  const cautions = says.filter((m) => m.moment === "caution");
  const finished = Boolean(state.done) && !busy;
  const statusText = museStatus(state.steps, state.run);
  const hasRun = messages.some(isRunMessage) || runBusy;
  const lastFeed = feed[feed.length - 1];
  const answerStreaming = busy && pending === "ask" && last?.role === "assistant" && last.parts.some((p) => p.type === "text" && p.text);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length, busy, lastFeed?.kind === "answer" ? lastFeed.text.length : 0, Boolean(error)]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetView = () => {
    setRunId(null);
    setSelected(null);
    setFocused(null);
    setPlacedKey(null);
    setSheet(false);
  };
  const start = (m: "live" | "replay") => {
    if (busy) return;
    if (error) clearError();
    resetView();
    void sendMessage(runUserMessage(m, option.id));
  };
  const ask = (question: string) => {
    if (busy || !runMsg || !state.done) return;
    if (error) clearError();
    void sendMessage(askUserMessage(question, option.id, runMsg.id));
  };
  const retry = () => {
    clearError();
    void regenerate();
  };
  const pickVenue = (id: string) => {
    if (id === venueId || busy) return;
    resetView();
    setVenueId(id);
  };
  /** Show a run message on the canvas (its layout as already placed, no placement animation). */
  const showRun = (messageId: string, iteration?: number) => {
    const m = messages.find((x) => x.id === messageId);
    if (!m) return;
    const s = deriveRunState(m);
    setRunId(messageId);
    setSelected(iteration ?? null);
    const k = placementKey(s.run, s.iterations.find((i) => i.iteration === 0));
    if (k) setPlacedKey(k);
  };
  const clickSay = (item: Extract<FeedItem, { kind: "say" }>) => {
    if (focused === item.id) return setFocused(null);
    setFocused(item.id);
    const m = item.say;
    if (item.messageId !== runMsg?.id) {
      showRun(item.messageId, m.iteration);
      return;
    }
    if (m.iteration !== undefined && its.some((i) => i.iteration === m.iteration && i.layout)) {
      setSelected(m.iteration);
      if (animKey) setPlacedKey(animKey);
    }
  };
  const toggle = (s: "before" | "after") => {
    setFocused(null);
    setSelected(s === "before" ? 0 : (afterIt?.iteration ?? null));
    if (animKey) setPlacedKey(animKey);
  };
  const decide = (id: string, choice: "approved" | "kept" | null) =>
    setApprovals((a) => approvalReducer(a, choice ? { type: "decide", id, choice } : { type: "undo", id }));

  const suggestions = useMemo(() => {
    const asked = new Set(messages.filter((m) => m.role === "user" && m.metadata?.intent === "ask").map((m) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")));
    const moved = [...says.filter((m) => m.moment === "revising"), ...says.filter((m) => m.moment === "revised")].flatMap((m) => m.booth_ids ?? []);
    const kinds = new Set(moved.map((id) => specs.find((s) => s.id === id)?.kind));
    const first = moved[0] ? specs.find((s) => s.id === moved[0]) : undefined;
    const why = kinds.has("food_truck") ? "Why move the food trucks?" : first ? `Why move ${venueShortName(first.label)}?` : "What did you change?";
    return [why, `Is it safe for ${visitors} people?`, "What still needs checking?", "What did you change?"].filter((s, i, a) => a.indexOf(s) === i && !asked.has(s)).slice(0, 4);
  }, [says, specs, messages, visitors]);

  const summary = layoutSummary({
    venueName: venueShortName(venue.name),
    boothCount: specs.length,
    visitors,
    before: baseSim,
    after: finalIsBaseline ? undefined : afterSim,
    approvals: items,
    cautions,
  });
  const finalLayoutIt = state.done ? its.find((i) => i.iteration === state.done!.finalIteration) : undefined;

  if (details) {
    return (
      <ReviewConsole
        chat={chat}
        venueId={venueId}
        onVenueChange={pickVenue}
        onClose={() => setDetails(false)}
      />
    );
  }

  const live = Boolean(status?.live);
  const primaryLabel = live ? "Let Muse plan it" : "Watch an example";

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:h-dvh">
      {/* top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-white" aria-hidden>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <rect x={3} y={3} width={4} height={4} rx={0.8} />
              <rect x={9} y={3} width={4} height={4} rx={0.8} opacity={0.55} />
              <rect x={3} y={9} width={4} height={4} rx={0.8} opacity={0.55} />
              <rect x={9} y={9} width={4} height={4} rx={0.8} />
            </svg>
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-ink">muvilion</span>
        </div>
        <VenuePicker value={venueId} onChange={pickVenue} disabled={busy} />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setDetails(true)} className="h-9 px-2 text-[13.5px] text-muted underline-offset-4 hover:text-ink hover:underline">
            Details
          </button>
          {busy ? (
            <button type="button" onClick={() => void stop()} className="h-10 rounded-full border border-hairline-strong bg-surface px-4 text-[14px] font-medium text-ink-soft hover:border-ink-soft">
              Stop
            </button>
          ) : (
            <>
              {live && (
                <button type="button" onClick={() => start("replay")} className="h-10 px-3 text-[14px] font-medium text-ink-soft hover:text-ink max-sm:hidden">
                  Watch an example
                </button>
              )}
              <button
                type="button"
                onClick={() => start(live ? "live" : "replay")}
                disabled={!status}
                className={`h-10 rounded-full px-5 text-[14px] font-medium transition-colors disabled:opacity-40 ${
                  hasRun ? "border border-hairline-strong bg-surface text-ink-soft hover:border-ink-soft" : "bg-accent text-white hover:bg-accent-hover"
                }`}
              >
                {hasRun ? (live ? "Plan again" : "Watch again") : primaryLabel}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(340px,3fr)] lg:gap-6">
        {/* canvas + headline */}
        <main className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] border border-hairline shadow-[0_24px_60px_-40px_rgb(30_30_28/0.45)] lg:aspect-auto lg:min-h-0 lg:flex-1">
            <SimpleCanvas
              key={venue.id}
              className="absolute inset-0"
              run={state.run}
              venue={venue}
              specs={specs}
              it={shown}
              moves={moves}
              highlight={highlight}
              focusKey={focused ?? undefined}
              onPlacementEnd={onPlacementEnd}
            />
            {canToggle && (
              <div className="absolute left-3 top-3 inline-flex rounded-full border border-hairline bg-surface/95 p-1 shadow-sm backdrop-blur" role="group" aria-label="Before or after">
                {(["before", "after"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={side === s}
                    onClick={() => toggle(s)}
                    className={`h-8 rounded-full px-4 text-[13.5px] font-medium transition-colors ${side === s ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                  >
                    {s === "before" ? "Before" : "After"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex min-h-[4.5rem] flex-wrap items-end justify-between gap-3 px-1">
            {h ? (
              <HeadlineText h={h} />
            ) : (
              <p className="text-[15px] text-muted">{runBusy ? "The crowd test results will show up here." : `${venueShortName(venue.name)} · ${specs.length} booths to place`}</p>
            )}
            {h && <p className="text-[12.5px] text-faint">Orange on the floor = where it gets crowded</p>}
          </div>
        </main>

        {/* Muse */}
        <aside aria-label="Muse" className="flex min-h-[28rem] min-w-0 max-lg:max-h-[85dvh] flex-col overflow-hidden rounded-[20px] border border-hairline bg-surface lg:min-h-0">
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
            <span className="text-[15px] font-semibold text-ink">Muse</span>
            <span className="text-[13px] text-muted">your layout assistant</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <ul className="flex flex-col gap-3.5">
              {messages.length === 0 && <MuseBubble>{EMPTY_TEXT}</MuseBubble>}
              {feed.map((f) => {
                if (f.kind === "user") return <UserBubble key={f.id}>{f.text}</UserBubble>;
                if (f.kind === "answer")
                  return (
                    <MuseBubble key={f.id}>
                      <span className="whitespace-pre-wrap">{f.text}</span>
                    </MuseBubble>
                  );
                if (f.kind === "result") {
                  const m = messages.find((x) => x.id === f.messageId);
                  return (
                    <ResultCard
                      key={f.id}
                      h={m ? runHeadline(deriveRunState(m)) : null}
                      onUse={() => {
                        if (f.messageId !== runMsg?.id) showRun(f.messageId);
                        setSheet(true);
                      }}
                      onAsk={() => {
                        if (f.messageId !== runMsg?.id) showRun(f.messageId);
                        askInput.current?.focus();
                      }}
                    />
                  );
                }
                const m = f.say;
                const clickable = m.iteration !== undefined || Boolean(m.booth_ids?.length);
                return (
                  <MuseBubble
                    key={f.id}
                    tone={m.tone}
                    selected={focused === f.id}
                    onClick={clickable ? () => clickSay(f) : undefined}
                    label={clickable ? `${m.text} (show on the model)` : undefined}
                    footer={m.needs_approval ? <ApprovalButtons choice={f.choice} onChoose={(c) => decide(f.id, c)} /> : undefined}
                  >
                    {m.text}
                  </MuseBubble>
                );
              })}
              {error && <ErrorBubble error={error} intent={pending} live={Boolean(status?.live)} onRetry={retry} onExample={() => start("replay")} />}
              {busy && !answerStreaming && <Typing status={pending === "ask" ? "Thinking…" : statusText} />}
            </ul>
            <div ref={feedEnd} />
          </div>
          <AskBox enabled={finished} busy={busy} suggestions={suggestions} onAsk={ask} inputRef={askInput} />
        </aside>
      </div>

      {finalLayoutIt?.layout && (
        <LayoutSheet
          open={sheet}
          onClose={() => setSheet(false)}
          venue={venue}
          venueName={venueShortName(venue.name)}
          specs={specs}
          booths={finalLayoutIt.layout.response.layout.booths}
          moves={baseIt?.layout && finalLayoutIt.iteration > 0 ? diffLayouts(baseIt.layout.response.layout, finalLayoutIt.layout.response.layout) : []}
          headline={h}
          visitors={visitors}
          approvals={items}
          checks={onSiteChecks(cautions)}
          summary={summary}
          onOpenDetails={() => {
            setSheet(false);
            setDetails(true);
          }}
        />
      )}
    </div>
  );
}

function ErrorBubble({
  error,
  intent,
  live,
  onRetry,
  onExample,
}: {
  error: Error;
  intent: "run" | "ask" | null;
  live: boolean;
  onRetry: () => void;
  onExample: () => void;
}) {
  const info = chatErrorInfo(error);
  const text =
    info.kind === "busy"
      ? intent === "ask"
        ? "Lots of questions right now. Please try again in a moment."
        : "Lots of plans are running right now. Please try again in a moment."
      : info.kind === "live_disabled"
        ? "Live planning is switched off right now."
        : intent === "ask"
          ? "Sorry, I couldn't answer that just now."
          : `I couldn't finish this time${info.message ? ` (${info.message})` : ""}.`;
  const link = "ml-1 underline underline-offset-2 hover:text-ink";
  return (
    <MuseBubble tone="warn">
      {text}
      {info.kind !== "live_disabled" && (
        <button type="button" className={link} onClick={onRetry}>
          Try again
        </button>
      )}
      {intent === "run" && (live || info.kind === "live_disabled") && (
        <button type="button" className={link} onClick={onExample}>
          Watch an example instead
        </button>
      )}
    </MuseBubble>
  );
}

function VenuePicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled: boolean }) {
  return (
    <div role="radiogroup" aria-label="Venue" className="inline-flex rounded-full border border-hairline bg-surface p-1">
      {VENUES.map((v) => {
        const on = v.id === value;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled && !on}
            onClick={() => onChange(v.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium transition-colors disabled:opacity-40 ${
              on ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {v.setting === "indoor" ? (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
                <path d="M2 7 L8 2.5 L14 7 V13.5 H2 Z" />
                <path d="M6.5 13.5 V9.5 H9.5 V13.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
                <circle cx={8} cy={6} r={3.2} />
                <path d="M8 9.2 V14 M4 14 H12" />
              </svg>
            )}
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
