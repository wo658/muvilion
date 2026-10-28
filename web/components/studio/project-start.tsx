"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui";
import type { SampleDrawing } from "@/lib/projects/schema";
import { listSamples } from "@/lib/projects/client";
import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage } from "@/lib/i18n/messages";

/** Centered first step: start from your own drawing, a sample drawing, or nothing. */
export function ProjectStart({ busy, error, notice, onDrawing, onSample, onBlank, onCancel }: {
  busy: boolean;
  error: string;
  notice: string;
  onDrawing: (file: File) => void;
  onSample: (file: string) => void;
  onBlank: () => void;
  onCancel?: () => void;
}) {
  const { t, locale } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [samples, setSamples] = useState<SampleDrawing[] | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => { listSamples().then(setSamples, () => setSamples([])); }, []);
  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(pdf|png|jpe?g|dxf)$/i.test(file.name)) setProblem("Choose a PDF, PNG, JPG or DXF drawing.");
    else if (file.size > 20 * 1024 * 1024) setProblem("Please choose a file smaller than 20 MB.");
    else { setProblem(""); onDrawing(file); }
  };
  const message = problem || error;
  return <section className="pw-start" aria-labelledby="pw-start-title" aria-busy={busy || undefined}>
    <h1 id="pw-start-title">{t("How would you like to start?")}</h1>
    <p className="pw-start-lead">{t("Bring a floor plan and design the space with Muse.")}</p>
    {notice && <p className="pw-start-notice" role="status">{localizeMessage(locale, notice)}</p>}
    <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf" hidden onChange={event => { pick(event.target.files?.[0]); event.target.value = ""; }}/>
    <div className="pw-start-options">
      <button type="button" className="pw-start-option" disabled={busy} onClick={() => input.current?.click()}>
        <strong>{t("Start with my drawing")}</strong><span>{t("PDF, PNG, JPG or DXF · up to 20 MB")}</span>
      </button>
      <button type="button" className="pw-start-option" disabled={busy || !samples?.length} aria-expanded={showSamples} aria-controls="pw-samples" onClick={() => setShowSamples(value => !value)}>
        <strong>{t("Start with a sample")}</strong><span>{samples === null ? t("Loading samples…") : samples.length ? t("{count} public venue drawings", { count: samples.length }) : t("No sample drawings in this checkout")}</span>
      </button>
    </div>
    {showSamples && samples && <ul id="pw-samples" className="pw-samples">{samples.map(sample => <li key={sample.file}>
      <button type="button" disabled={busy} onClick={() => onSample(sample.file)}>{sample.name}</button>
    </li>)}</ul>}
    {message && <p className="pw-start-error" role="alert">{localizeMessage(locale, message)}</p>}
    {busy && <p className="pw-start-status" role="status">{t("Creating project…")}</p>}
    <div className="pw-start-links">
      <Button variant="ghost" disabled={busy} onClick={onBlank}>{t("Start with an empty project")}</Button>
      {onCancel && <Button variant="ghost" disabled={busy} onClick={onCancel}>{t("Cancel")}</Button>}
    </div>
  </section>;
}
