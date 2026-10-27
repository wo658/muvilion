"use client";

/** Muse's side of the simple view: message bubbles, typing indicator, result card, Ask box. */
import { useState, type FormEvent, type ReactNode, type RefObject } from "react";
import type { SayInfo } from "@/lib/agent/events";
import type { ApprovalChoice } from "@/lib/ui/approvals";
import { CROWDED_EXPLAINER, type Headline } from "@/lib/ui/plain";

export function MuseAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_2px_6px_-2px_rgb(31_95_91/0.5)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 16 16" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        <path d="M3 12 V5 L8 9.5 L13 5 V12" />
      </svg>
    </span>
  );
}

export function MuseBubble({
  children,
  tone = "neutral",
  selected = false,
  onClick,
  footer,
  label,
}: {
  children: ReactNode;
  tone?: SayInfo["tone"];
  selected?: boolean;
  onClick?: () => void;
  footer?: ReactNode;
  label?: string;
}) {
  const edge = tone === "warn" ? "border-l-[3px] border-l-amber" : tone === "good" ? "border-l-[3px] border-l-accent" : "";
  const body = (
    <>
      {tone === "good" && (
        <span className="float-right ml-2 mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-accent-soft text-accent" aria-label="Good news">
          <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M2.5 6.2 L5 8.5 L9.5 3.5" />
          </svg>
        </span>
      )}
      {children}
    </>
  );
  return (
    <li className="muse-in flex items-start gap-2.5">
      <MuseAvatar />
      <div className="min-w-0 flex-1">
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            aria-label={label}
            className={`block w-full rounded-[14px] rounded-tl-[4px] border bg-surface px-3.5 py-2.5 text-left text-[15px] leading-relaxed text-ink-soft [overflow-wrap:anywhere] transition-[border-color,box-shadow] hover:border-hairline-strong ${edge} ${
              selected ? "border-accent/60 shadow-[0_0_0_3px_var(--accent-soft)]" : "border-hairline"
            }`}
          >
            {body}
          </button>
        ) : (
          <div className={`rounded-[14px] rounded-tl-[4px] border border-hairline bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-ink-soft [overflow-wrap:anywhere] ${edge}`}>{body}</div>
        )}
        {footer}
      </div>
    </li>
  );
}

export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <li className="muse-in flex justify-end">
      <div className="max-w-[85%] rounded-[14px] rounded-tr-[4px] bg-sunken px-3.5 py-2 text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">{children}</div>
    </li>
  );
}

export function Typing({ status }: { status: string }) {
  return (
    <li className="muse-in flex items-center gap-2.5" role="status" aria-live="polite">
      <MuseAvatar />
      <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-[13.5px] text-muted">
        <span className="flex gap-1" aria-hidden>
          <span className="typing-dot" />
          <span className="typing-dot [animation-delay:150ms]" />
          <span className="typing-dot [animation-delay:300ms]" />
        </span>
        {status}
      </span>
    </li>
  );
}

export function ApprovalButtons({ choice, onChoose }: { choice: ApprovalChoice | null; onChoose: (c: ApprovalChoice | null) => void }) {
  if (choice)
    return (
      <p className="mt-1.5 flex items-center gap-2 pl-1 text-[13px] text-muted">
        <span className={choice === "approved" ? "text-accent" : "text-ink-soft"}>{choice === "approved" ? "You approved this." : "You chose to keep the original."}</span>
        <button type="button" className="underline decoration-hairline-strong underline-offset-2 hover:text-ink" onClick={() => onChoose(null)}>
          Change
        </button>
      </p>
    );
  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-1">
      <button
        type="button"
        onClick={() => onChoose("approved")}
        className="h-8 rounded-full border border-accent bg-accent-soft px-3.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent hover:text-white"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => onChoose("kept")}
        className="h-8 rounded-full border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft"
      >
        Keep original
      </button>
    </div>
  );
}

export function HeadlineText({ h, size = "lg" }: { h: Headline; size?: "lg" | "md" }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[13px] text-muted">
        {h.label}
        <span className="group relative inline-flex">
          <button type="button" className="grid h-4 w-4 place-items-center rounded-full border border-hairline-strong text-[10px] leading-none text-muted" aria-label={CROWDED_EXPLAINER}>
            ?
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-[6px] bg-ink px-2.5 py-1.5 text-[12px] text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            {CROWDED_EXPLAINER}
          </span>
        </span>
      </div>
      <div className={`mt-0.5 flex flex-wrap items-baseline gap-x-2 font-semibold tracking-tight text-ink ${size === "lg" ? "text-[28px] leading-9 sm:text-[34px] sm:leading-10" : "text-[22px] leading-8"}`}>
        <span className={h.after ? "text-muted" : ""}>{h.before}</span>
        {h.after && (
          <>
            <span className="text-faint" aria-label="to">
              →
            </span>
            <span>{h.after}</span>
          </>
        )}
        {h.change && <span className={`text-[0.6em] font-medium ${h.tone === "good" ? "text-accent" : h.tone === "warn" ? "text-bad" : "text-muted"}`}>({h.change})</span>}
      </div>
    </div>
  );
}

export function ResultCard({ h, onUse, onAsk }: { h: Headline | null; onUse: () => void; onAsk: () => void }) {
  return (
    <li className="muse-in rounded-[16px] border border-hairline bg-surface p-4 shadow-[0_12px_32px_-18px_rgb(30_30_28/0.35)]">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-accent">
        <MuseAvatar size={22} /> Your layout is ready
      </div>
      {h && <HeadlineText h={h} size="md" />}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onUse} className="h-10 rounded-full bg-accent px-5 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover">
          Use this layout
        </button>
        <button type="button" onClick={onAsk} className="h-10 rounded-full border border-hairline-strong bg-surface px-4 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink-soft">
          Ask Muse…
        </button>
      </div>
    </li>
  );
}

export function AskBox({
  enabled,
  busy,
  suggestions,
  onAsk,
  inputRef,
}: {
  enabled: boolean;
  busy: boolean;
  suggestions: string[];
  onAsk: (q: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || !enabled || busy) return;
    onAsk(text);
    setQ("");
  };
  return (
    <div className="border-t border-hairline bg-surface/80 px-4 pb-4 pt-3 backdrop-blur">
      {enabled && suggestions.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onAsk(s)}
              className="rounded-full border border-hairline bg-bg px-3 py-1 text-[12.5px] text-ink-soft transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={500}
          disabled={!enabled}
          placeholder={enabled ? "Ask Muse about this layout…" : "You can ask Muse questions once the plan is ready"}
          aria-label="Ask Muse a question"
          className="h-11 min-w-0 flex-1 rounded-full border border-hairline-strong bg-surface px-4 text-[14.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent disabled:bg-sunken disabled:text-faint"
        />
        <button
          type="submit"
          disabled={!enabled || busy || !q.trim()}
          aria-label="Send question"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white transition-opacity disabled:opacity-25"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 13 V3 M3.5 7.5 L8 3 L12.5 7.5" />
          </svg>
        </button>
      </form>
    </div>
  );
}
