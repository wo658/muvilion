"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage } from "@/lib/i18n/messages";
import { planningBooths, SECTION_LABELS, type PlanningArtifact } from "@/lib/plans/planning-artifact";
import { planningReportHtml, printPlanningReport } from "@/lib/plans/planning-report";

export function PlanningArtifactPanel({ artifact, busy, progress, error, stale, target, onTarget, onClose, onCreate, onRefresh, onUndo, onCancel }: {
  artifact: PlanningArtifact | null; busy: boolean; progress: { completed: number; total: number } | null; error: string | null; stale: boolean;
  target: string | null; onTarget: (id: string | null) => void; onClose: () => void; onCreate: () => void; onRefresh: () => void; onUndo: () => void; onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const printingRequest = useRef<AbortController | null>(null);
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { panel.current?.focus(); const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !window.document.querySelector("dialog[open]")) close.current(); }; window.addEventListener("keydown", escape); return () => { window.removeEventListener("keydown", escape); printingRequest.current?.abort(); }; }, []);
  useEffect(() => { printingRequest.current?.abort(); }, [artifact]);
  async function print() {
    if (!artifact || printing) return;
    const popup = window.open("", "_blank");
    if (!popup) { setPrintError("Allow pop-ups to open the planning PDF."); return; }
    const controller = new AbortController(); printingRequest.current = controller;
    setPrinting(true); setPrintError(null); setPrinted(false);
    try { await printPlanningReport(popup, planningReportHtml({ id: artifact.id, capturedAt: artifact.updatedAt, ...artifact.basis, photo: artifact.photos.find(p => p.targetId === "overview") ?? { shot: { id: "none", eye: [0, 1, 1], target: [0, 0, 0], fov: 40, zoom: 1, aspect: 16 / 9, cutaway: true, ceilingMode: "hidden", showStructure: true, showOverhead: true }, image: "" } }, { title: artifact.content.title, intent: artifact.content.sections.find(s => s.id === "intent")?.text ?? "", locale }, artifact), controller.signal); setPrinted(true); }
    catch (cause) { if (!controller.signal.aborted) setPrintError(cause instanceof Error ? cause.message : "The planning PDF could not be prepared. Please try again."); }
    finally { setPrinting(false); }
  }
  const booths = artifact ? planningBooths(artifact.basis.document) : [];
  const photo = (id: string) => artifact?.photos.find(p => p.targetId === id);
  const picture = (id: string, label: string) => {
    const capture = photo(id);
    return capture ? <figure><Image unoptimized src={capture.image} alt={label} width={1280} height={720} className="w-full rounded-lg"/><figcaption className="text-xs text-muted">{t("Actual 3D capture")} · {t("Automatically framed · review composition")}{capture.shot.cutaway ? ` · ${t("Cutaway view")}` : ""}</figcaption></figure> : <p className="rounded-lg bg-sunken p-5 text-sm text-muted">{t("No photo yet. Ask Muse to photograph this view.")}</p>;
  };
  return <section ref={panel} tabIndex={-1} className="ps-planning-artifact" aria-label={t("Planning document")} data-testid="planning-artifact">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-surface p-3">
      <div><h2 className="font-semibold">{t("Planning document")}</h2><p className="text-xs text-muted">{artifact ? t("Version {revision} · project document", { revision: artifact.revision }) : t("A living document, revised with Muse")}</p></div>
      <div className="flex flex-wrap gap-1">
        {busy && <Button size="sm" variant="outline" onClick={onCancel}>{t("Cancel")}</Button>}
        {artifact && <><Button size="sm" variant="ghost" disabled={busy || !artifact.history.length} onClick={onUndo}>{t("Undo document revision")}</Button><Button size="sm" variant="outline" disabled={busy || printing} onClick={() => void print()}>{t("Open planning PDF")}</Button></>}
        <Button size="sm" variant="ghost" onClick={onClose}>{t("Back to space")}</Button>
      </div>
    </header>
    <div className="ps-planning-scroll">
      {busy && <p className="sticky top-0 bg-surface p-3 text-sm" role="status">{progress ? t("Capturing booth photos · {completed}/{total}", progress) : t("Muse is revising the document…")}</p>}
      {(error || printError) && <p className="m-4 text-sm text-bad" role="alert">{localizeMessage(locale, error ?? printError!)}</p>}
      {printed && <p className="m-4 text-sm text-muted" role="status">{t("Print dialog opened. Choose Save as PDF to keep the report.")}</p>}
      {stale && <div className="m-4 rounded-lg bg-sunken p-3 text-sm"><p>{t("The drawing or references changed. This document still shows its saved version.")}</p><Button size="sm" variant="outline" disabled={busy} onClick={onRefresh}>{t("Refresh dimensions & references")}</Button><p className="text-xs text-muted">{t("Refresh clears old photos. Ask Muse to review the text and take new photos.")}</p></div>}
      {!artifact ? <div className="flex min-h-80 flex-col items-center justify-center gap-4 p-6 text-center"><h3 className="text-xl font-semibold">{t("Your space, ready to share")}</h3><p className="max-w-md text-sm text-muted">{t("Create an overview, circulation plan and participation guide with booth dimensions, estimated fees and real scene photos. Then ask Muse for changes.")}</p><Button disabled={busy} onClick={onCreate}>{t("Create planning document")}</Button></div> : <article className="ps-planning-paper">
        <p className="text-xs text-muted">muvilion · {t("Planning report")}</p><h1 className="text-3xl font-semibold">{artifact.content.title}</h1>
        <p className="text-sm text-muted">{artifact.basis.document.source.name} · {artifact.basis.document.widthMeters ?? "—"} × {artifact.basis.document.heightMeters ?? "—"} m · {t(artifact.basis.document.scaleConfirmed ? "Scale confirmed by the user" : "Illustrative scale · dimensions not confirmed")}</p>
        {picture("overview", t("Project overview"))}
        {artifact.content.sections.filter(s => s.id !== "notes").map(section => <section key={section.id} data-selected={target === section.id || undefined} className="ps-planning-section"><div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">{t(SECTION_LABELS[section.id])}</h2><Button size="sm" variant="ghost" aria-pressed={target === section.id} onClick={() => onTarget(section.id)}>{t("Ask Muse about this")}</Button></div><p className="whitespace-pre-wrap text-sm">{section.text || t("Ask Muse to complete this section.")}</p></section>)}
        <section className="ps-planning-section"><h2 className="text-xl font-semibold">{t("Participation guide")}</h2><p className="text-xs text-muted">{t("Planning estimates only · fees are not confirmed offers; circulation is not a traffic simulation.")}</p>
          {!booths.length && <p className="text-sm">{t("No booth or assignable zone in this drawing. Ask Muse to design booths first.")}</p>}
          {booths.map(booth => { const copy = artifact.content.booths.find(b => b.id === booth.id); return <section key={booth.id} className="ps-planning-section" data-selected={target === booth.id || undefined}>
            <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-semibold">{booth.label}</h3><Button size="sm" variant="ghost" aria-pressed={target === booth.id} onClick={() => onTarget(booth.id)}>{t("Ask Muse about this")}</Button></div>
            <p className="text-sm">{booth.width} × {booth.depth} m · {Math.round(booth.width * booth.depth * 100) / 100} m²{booth.height ? ` · ${t("Height")}: ${booth.height} m` : ""}</p>
            {picture(booth.id, booth.label)}<p className="whitespace-pre-wrap text-sm">{copy?.description}</p>
            <h4 className="text-sm font-semibold">{t("Planned circulation")}</h4><p className="whitespace-pre-wrap text-sm">{copy?.circulation || t("To be reviewed")}</p>
            <h4 className="text-sm font-semibold">{t("Estimated participation fee")}</h4><p className="text-lg font-semibold">{copy?.fee.amount == null ? t("Not estimated") : new Intl.NumberFormat(locale, { style: "currency", currency: copy.fee.currency, maximumFractionDigits: 0 }).format(copy.fee.amount)}</p>
            <p className="whitespace-pre-wrap text-sm">{t("Estimate basis")}: {copy?.fee.basis || t("To be reviewed")}</p><p className="whitespace-pre-wrap text-sm">{t("Included provisions")}: {copy?.fee.includes || t("To be reviewed")}</p><p className="text-xs text-muted">{t("Tax")}: {t(copy?.fee.tax === "included" ? "Included" : copy?.fee.tax === "excluded" ? "Excluded" : "To be reviewed")}</p>
          </section>; })}
        </section>
        <section className="ps-planning-section" data-selected={target === "notes" || undefined}><div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">{t("Assumptions & items to review")}</h2><Button size="sm" variant="ghost" onClick={() => onTarget("notes")}>{t("Ask Muse about this")}</Button></div><p className="whitespace-pre-wrap text-sm">{artifact.content.sections.find(s => s.id === "notes")?.text}</p>{artifact.basis.document.warnings.map((warning, i) => <p className="text-sm text-muted" key={i}>{warning}</p>)}<p className="text-xs text-muted">{t("Planning material only · not a construction drawing or safety certification.")}</p></section>
      </article>}
    </div>
  </section>;
}
