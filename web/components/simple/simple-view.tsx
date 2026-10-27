"use client";

/**
 * The default screen: the venue as a 3D model, one headline number, and Muse talking the user
 * through the run in plain language. Everything technical lives behind "Details" (the review
 * console, which shares this view's chat so it shows the same run).
 */
import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { diffLayouts } from "@/lib/agent/analysis";
import type { AgentUIMessage, SayInfo } from "@/lib/agent/events";
import { askMuse, trimHistory, type AskTurn } from "@/lib/ui/ask-client";
import { approvalItems, approvalReducer, sayId } from "@/lib/ui/approvals";
import { museMessages } from "@/lib/ui/fallback-say";
import { eventsFromMessage } from "@/lib/ui/message-events";
import { museStatus } from "@/lib/ui/muse-status";
import { headline, venueShortName } from "@/lib/ui/plain";
import { buildRunDigest } from "@/lib/ask/digest";
import { deriveRunState } from "@/lib/ui/run-state";
import { layoutSummary, onSiteChecks } from "@/lib/ui/summary";
import { DEFAULT_VENUE_ID, runRequestBody, venueById, VENUES } from "@/lib/venues";
import { ReviewConsole } from "../review-console";
import { placementKey } from "../stage";
import { LayoutSheet } from "./layout-sheet";
import { ApprovalButtons, AskBox, HeadlineText, MuseBubble, ResultCard, Typing, UserBubble } from "./muse-feed";
import { SimpleCanvas } from "./simple-canvas";

type Status = { live: boolean };
type FeedTurn = AskTurn & { note?: "unavailable" | "error"; pending?: boolean };
// Ask Muse sends a digest of the events on screen; `buildRunDigest` throws without a run event.

const EMPTY_TEXT = "Pick a space and I'll plan the booth layout, test it with virtual visitors, and fix what gets crowded.";

export function SimpleView() {
  const [chat] = useState(() => new Chat<AgentUIMessage>({ transport: new DefaultChatTransport<AgentUIMessage>({ api: "/api/agent" }) }));
  const { messages, sendMessage, setMessages, status: chatStatus, error, stop, clearError } = useChat<AgentUIMessage>({ chat });
  const [status, setStatus] = useState<Status | null>(null);
  const [venueId, setVenueId] = useState(DEFAULT_VENUE_ID);
  const [details, setDetails] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [placedKey, setPlacedKey] = useState<string | null>(null);
  const [approvals, dispatch] = useReducer(approvalReducer, {});
  const [turns, setTurns] = useState<FeedTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [lastMode, setLastMode] = useState<"live" | "replay" | null>(null);
  const askInput = useRef<HTMLInputElement>(null);
  const feedEnd = useRef<HTMLDivElement>(null);
  const askAbort = useRef<AbortController | null>(null);

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
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const state = useMemo(() => deriveRunState(lastAssistant), [lastAssistant]);
  const events = useMemo(() => eventsFromMessage(lastAssistant), [lastAssistant]);
  const says = useMemo(() => museMessages(events), [events]);
  const option = venueById(venueId) ?? VENUES[0];
  const venue = state.run?.venue ?? option.project.venue;
  const specs = state.run?.booths ?? option.project.booths;
  const visitors = state.run?.scenario.agents ?? option.scenario?.agents ?? 300;

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
  const latestSim = [...its].reverse().find((i) => i.iteration > 0 && i.sim);
  const afterSim = state.done
    ? (state.done.final ?? undefined)?.crowded_s_per_visitor
    : latestSim?.sim?.metrics.crowded_s_per_visitor;
  const finalIsBaseline = state.done?.finalIteration === 0;
  const h = baseSim === undefined ? null : headline(baseSim, finalIsBaseline ? undefined : afterSim);

  // ---- feed ----
  const focusedMsg = focused ? says.find((m, i) => sayId(m, i) === focused) : undefined;
  const highlight = focusedMsg?.booth_ids;
  const items = approvalItems(says, approvals);
  const cautions = says.filter((m) => m.moment === "caution");
  const finished = Boolean(state.done) && !busy;
  const statusText = museStatus(state.steps, state.run);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [says.length, turns.length, finished, busy, turns[turns.length - 1]?.text.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetRun = () => {
    askAbort.current?.abort();
    clearError();
    setMessages([]);
    setSelected(null);
    setFocused(null);
    setPlacedKey(null);
    dispatch({ type: "reset" });
    setTurns([]);
    setSheet(false);
  };
  const start = (m: "live" | "replay") => {
    resetRun();
    setLastMode(m);
    void sendMessage({ text: m === "live" ? "Start live run" : "Replay recorded run" }, { body: runRequestBody(m, option.id) });
  };
  const pickVenue = (id: string) => {
    if (id === venueId || busy) return;
    resetRun();
    setLastMode(null);
    setVenueId(id);
  };
  const clickMessage = (m: SayInfo, id: string) => {
    if (focused === id) return setFocused(null);
    setFocused(id);
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

  const ask = async (question: string) => {
    if (asking || !state.run) return;
    const history = trimHistory(turns.filter((t) => !t.note));
    setTurns((t) => [...t, { role: "user", text: question }, { role: "muse", text: "", pending: true }]);
    setAsking(true);
    const ctrl = new AbortController();
    askAbort.current = ctrl;
    const update = (patch: Partial<FeedTurn>) =>
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });
    let digest;
    try {
      digest = buildRunDigest(events);
    } catch {
      update({ pending: false, note: "error", text: "I need a finished plan before I can answer questions about it." });
      setAsking(false);
      return;
    }
    const res = await askMuse({ question, digest, history }, (text) => update({ text, pending: false }), { signal: ctrl.signal });
    if (ctrl.signal.aborted) return;
    if (res.status === "busy") update({ pending: false, note: "error", text: "Lots of questions right now. Please try again in a moment." });
    else if (res.status === "unavailable") update({ pending: false, note: "unavailable", text: "Ask isn't available yet. Open Details to read the full report in the meantime." });
    else if (res.status === "error") update({ pending: false, note: "error", text: res.text || "Sorry, I couldn't answer that just now. Please try again." });
    else update({ pending: false, text: res.text || "I don't have an answer for that one." });
    setAsking(false);
  };

  const suggestions = useMemo(() => {
    const asked = new Set(turns.filter((t) => t.role === "user").map((t) => t.text));
    const moved = [...says.filter((m) => m.moment === "revising"), ...says.filter((m) => m.moment === "revised")].flatMap((m) => m.booth_ids ?? []);
    const kinds = new Set(moved.map((id) => specs.find((s) => s.id === id)?.kind));
    const first = moved[0] ? specs.find((s) => s.id === moved[0]) : undefined;
    const why = kinds.has("food_truck") ? "Why move the food trucks?" : first ? `Why move ${venueShortName(first.label)}?` : "What did you change?";
    return [why, `Is it safe for ${visitors} people?`, "What still needs checking?", "What did you change?"].filter((s, i, a) => a.indexOf(s) === i && !asked.has(s)).slice(0, 4);
  }, [says, specs, turns, visitors]);

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
        onVenueChange={(id) => {
          resetRun();
          setVenueId(id);
        }}
        onClose={() => setDetails(false)}
      />
    );
  }

  const live = Boolean(status?.live);
  const primaryLabel = live ? "Let Muse plan it" : "Watch an example";
  const hasRun = Boolean(state.run) || busy;

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
          <span className="text-[16px] font-semibold tracking-tight text-ink">Layout Engineer</span>
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
              <p className="text-[15px] text-muted">{busy ? "The crowd test results will show up here." : `${venueShortName(venue.name)} · ${specs.length} booths to place`}</p>
            )}
            {h && <p className="text-[12.5px] text-faint">Orange on the floor = where it gets crowded</p>}
          </div>
        </main>

        {/* Muse */}
        <aside aria-label="Muse" className="flex min-h-[28rem] min-w-0 max-lg:max-h-[85dvh] flex-col overflow-hidden rounded-[20px] border border-hairline bg-[color-mix(in_srgb,var(--surface)_70%,var(--bg))] lg:min-h-0">
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
            <span className="text-[15px] font-semibold text-ink">Muse</span>
            <span className="text-[13px] text-muted">your layout assistant</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <ul className="flex flex-col gap-3.5">
              {!hasRun && <MuseBubble>{EMPTY_TEXT}</MuseBubble>}
              {says.map((m, i) => {
                const id = sayId(m, i);
                const clickable = m.iteration !== undefined || Boolean(m.booth_ids?.length);
                return (
                  <MuseBubble
                    key={id}
                    tone={m.tone}
                    selected={focused === id}
                    onClick={clickable ? () => clickMessage(m, id) : undefined}
                    label={clickable ? `${m.text} (show on the model)` : undefined}
                    footer={
                      m.needs_approval ? (
                        <ApprovalButtons
                          choice={approvals[id] ?? null}
                          onChoose={(c) => dispatch(c ? { type: "decide", id, choice: c } : { type: "undo", id })}
                        />
                      ) : undefined
                    }
                  >
                    {m.text}
                  </MuseBubble>
                );
              })}
              {error && (
                <MuseBubble tone="warn">
                  I couldn&apos;t finish this time{error.message ? ` (${error.message})` : ""}.
                  {lastMode === "live" && (
                    <button type="button" className="ml-1 underline underline-offset-2" onClick={() => start("replay")}>
                      Watch an example instead
                    </button>
                  )}
                </MuseBubble>
              )}
              {busy && <Typing status={statusText} />}
              {finished && state.done?.status === "completed" && (
                <ResultCard h={h} onUse={() => setSheet(true)} onAsk={() => askInput.current?.focus()} />
              )}
              {turns.map((t, i) =>
                t.role === "user" ? (
                  <UserBubble key={`t${i}`}>{t.text}</UserBubble>
                ) : t.pending ? (
                  <Typing key={`t${i}`} status="Thinking…" />
                ) : (
                  <MuseBubble key={`t${i}`} tone={t.note ? "warn" : "neutral"}>
                    <span className="whitespace-pre-wrap">{t.text}</span>
                  </MuseBubble>
                ),
              )}
            </ul>
            <div ref={feedEnd} />
          </div>
          <AskBox enabled={finished} busy={asking} suggestions={suggestions} onAsk={(q) => void ask(q)} inputRef={askInput} />
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
