"use client";

/** "Use this layout" confirmation sheet: what will be used, approvals, on-site checks, export. */
import { useEffect, useRef, useState } from "react";
import type { BoothMove } from "@/lib/agent/events";
import type { BoothSpec, Booth, Venue } from "@/lib/engine/contract";
import { approvalLine, type ApprovalItem } from "@/lib/ui/approvals";
import { downloadSvgAsPng } from "@/lib/ui/export-plan";
import type { Headline } from "@/lib/ui/plain";
import { HallView } from "../hall-view";

export function LayoutSheet({
  open,
  onClose,
  venue,
  venueName,
  specs,
  booths,
  moves,
  headline,
  visitors,
  approvals,
  checks,
  summary,
  onOpenDetails,
}: {
  open: boolean;
  onClose: () => void;
  venue: Venue;
  venueName: string;
  specs: BoothSpec[];
  booths: Booth[];
  moves: BoothMove[];
  headline: Headline | null;
  visitors: number;
  approvals: ApprovalItem[];
  checks: string[];
  summary: string;
  onOpenDetails: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const plan = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const flash = (s: string) => {
    setNote(s);
    setTimeout(() => setNote(null), 1800);
  };
  const download = async () => {
    const svg = plan.current?.querySelector("svg");
    if (!svg) return;
    try {
      await downloadSvgAsPng(svg, `layout-plan-${venue.id}.png`);
      flash("Plan downloaded");
    } catch {
      flash("Couldn't create the image");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      flash("Summary copied");
    } catch {
      flash("Couldn't copy");
    }
  };
  const kept = approvals.some((a) => a.choice === "kept");
  const open_ = approvals.some((a) => a.choice === null);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="sheet m-auto max-h-[92dvh] w-[min(40rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[18px] border border-hairline bg-surface p-0 text-ink shadow-[0_30px_80px_-30px_rgb(30_30_28/0.45)] backdrop:bg-transparent"
      aria-labelledby="sheet-title"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sheet-title" className="text-[20px] font-semibold tracking-tight">
              Use this layout
            </h2>
            <p className="mt-0.5 text-[14px] text-muted">
              {venueName} · {booths.length} booths · tested with {visitors} virtual visitors
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink">
            <svg viewBox="0 0 12 12" width="12" height="12" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M2 2 L10 10 M10 2 L2 10" />
            </svg>
          </button>
        </div>

        <div ref={plan} className="mt-4 overflow-hidden rounded-[12px] border border-hairline bg-bg p-2">
          <HallView venue={venue} specs={specs} booths={booths.map((b) => ({ ...b, alpha: 1 }))} moves={moves} showHeatmap={false} />
        </div>

        <Section title="What you're using">
          <ul className="space-y-1">
            <li>The final layout Muse tested{headline?.after ? `: ${headline.label.toLowerCase()} ${headline.text}` : headline ? `: ${headline.before} in crowds per visitor` : ""}.</li>
            {moves.length > 0 && <li>Booths outlined in blue sit somewhere new compared with the first try.</li>}
          </ul>
        </Section>

        {approvals.length > 0 && (
          <Section title="Your approvals">
            <ul className="space-y-1.5">
              {approvals.map((a) => (
                <li key={a.id} className={a.choice === null ? "text-bad" : ""}>
                  {approvalLine(a)}
                </li>
              ))}
            </ul>
            {(kept || open_) && (
              <p className="mt-2 rounded-[10px] bg-sunken px-3 py-2 text-[13.5px] text-ink-soft">
                {kept
                  ? "You chose to keep some original spots, but this plan still moves them. Ask Muse or open Details before you finalize."
                  : "Some changes still need your answer in the conversation."}
              </p>
            )}
          </Section>
        )}

        <Section title="Check on site">
          {checks.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Muse didn&apos;t flag anything. Walk the space once before the event anyway.</p>
          )}
        </Section>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" onClick={download} className="h-10 rounded-full bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover">
            Download plan (PNG)
          </button>
          <button type="button" onClick={copy} className="h-10 rounded-full border border-hairline-strong px-4 text-[14px] font-medium text-ink-soft hover:border-ink-soft">
            Copy summary
          </button>
          <button type="button" onClick={onOpenDetails} className="h-10 px-2 text-[14px] text-muted underline-offset-4 hover:text-ink hover:underline">
            Open details
          </button>
          <span className="ml-auto text-[13px] text-accent" role="status" aria-live="polite">
            {note}
          </span>
        </div>
      </div>
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 text-[14.5px] leading-relaxed text-ink-soft">
      <h3 className="mb-1.5 text-[13px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}
