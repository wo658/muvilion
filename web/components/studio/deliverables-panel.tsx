"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage } from "@/lib/i18n/messages";
import type { PlanDocument } from "@/lib/plans/schema";
import type { SourceLibrary } from "@/lib/sources/schema";
import { createPlanningSnapshot, planningReportHtml, printPlanningReport, type PlanningSnapshot } from "@/lib/plans/planning-report";
import type { PhotoRenderer } from "./scene-photography";

type Captured = { document: PlanDocument; sources: SourceLibrary; snapshot: PlanningSnapshot };

export function DeliverablesPanel({ document, sources, renderer, onClose }: {
  document: PlanDocument; sources: SourceLibrary; renderer: PhotoRenderer | null; onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [title, setTitle] = useState(document.source.name.replace(/\.[^.]+$/, ""));
  const [intent, setIntent] = useState("");
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [busy, setBusy] = useState<"capture" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  const request = useRef<AbortController | null>(null);
  const panel = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    panel.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || window.document.querySelector("dialog[open]")) return;
      event.preventDefault(); close.current();
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, []);
  const snapshot = captured?.document === document && captured.sources === sources ? captured.snapshot : null;
  useEffect(() => () => { request.current?.abort(); }, [document, sources, renderer]);

  async function capture() {
    if (!renderer || busy) return;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    // Copy inputs before rendering: later edits must never be attached to this camera image.
    const frozenDocument = structuredClone(document);
    const frozenSources = structuredClone(sources);
    setBusy("capture"); setError(null); setPrinted(false); setCaptured(null);
    try {
      const photo = await renderer.capture(renderer.current(), signal);
      signal.throwIfAborted();
      const next = createPlanningSnapshot(frozenDocument, frozenSources, photo);
      setCaptured({ document, sources, snapshot: next });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Photography failed. Please try again.");
    } finally { setBusy(null); }
  }

  async function print() {
    if (!snapshot || busy || !title.trim()) return;
    setError(null); setPrinted(false);
    // User activation must still be live here: opening after image/font awaits is blocked by browsers.
    const popup = window.open("", "_blank");
    if (!popup) { setError("Allow pop-ups to open the planning PDF."); return; }
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    setBusy("print");
    try {
      const html = planningReportHtml(snapshot, { title, intent, locale });
      await printPlanningReport(popup, html, controller.signal);
      controller.signal.throwIfAborted();
      setPrinted(true);
    } catch (cause) {
      popup.close();
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The planning PDF could not be prepared. Please try again.");
    } finally { setBusy(null); }
  }

  return <section ref={panel} tabIndex={-1} className="ps-photography-panel" aria-label={t("Capture & planning PDF")} data-testid="deliverables-panel">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{t("Capture & planning PDF")}</h2><Button size="sm" variant="ghost" onClick={onClose}>{t("Close")}</Button></div>
    <p className="text-sm text-muted">{t("Capture this view to prepare a planning PDF.")}</p>
    <Button disabled={!renderer || !!busy} onClick={() => void capture()}>{t(busy === "capture" ? "Capturing view…" : "Capture current view")}</Button>
    {captured && !snapshot && <p role="status" className="text-sm text-muted">{t("Capture again after changing the drawing or brand sources.")}</p>}
    {error && <p role="alert" className="text-sm text-bad">{localizeMessage(locale, error)}</p>}
    {snapshot && <>
      <Image data-testid="deliverable-capture" unoptimized src={snapshot.photo.image} alt={t("Actual 3D capture")} width={1280} height={720} className="w-full rounded-lg"/>
      <a className={buttonVariants({ size: "sm", variant: "outline" })} href={snapshot.photo.image} download="muvilion-capture.jpg">{t("Download capture")}</a>
    </>}
      <FieldGroup>
        <Field><FieldLabel htmlFor="report-title">{t("Report title")}</FieldLabel><Input id="report-title" value={title} maxLength={200} onChange={event => setTitle(event.target.value)} required/></Field>
        <Field><FieldLabel htmlFor="report-intent">{t("Design intent")}</FieldLabel><Textarea id="report-intent" value={intent} maxLength={6000} rows={4} onChange={event => setIntent(event.target.value)}/></Field>
      </FieldGroup>
      <Button disabled={!snapshot || !!busy || !title.trim()} onClick={() => void print()}>{t(busy === "print" ? "Preparing planning PDF…" : "Open planning PDF")}</Button>
    <p className="text-xs text-muted">{t("In the print dialog, choose Save as PDF. Captures are kept only while this panel is open.")}</p>
    {printed && <p role="status" className="text-sm text-muted">{t("Print dialog opened. Choose Save as PDF to keep the report.")}</p>}
  </section>;
}
