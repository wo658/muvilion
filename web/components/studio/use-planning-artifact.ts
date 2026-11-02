"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPlanningArtifact, revisePlanningArtifact, planningIsStale, PlanningContentSchema, PlanningArtifactSchema, type PlanningArtifact, type PlanningPhotoSchema } from "@/lib/plans/planning-artifact";
import type { z } from "zod";
import type { PlanDocument } from "@/lib/plans/schema";
import type { SourceLibrary } from "@/lib/sources/schema";
import { selectedReferences } from "@/lib/sources/files";
import { translate, type Locale } from "@/lib/i18n/messages";
export type PlanningCapture = { capture: (targetId: string, signal: AbortSignal) => Promise<z.infer<typeof PlanningPhotoSchema>> };

/** Document changes and captures share the project's existing serialized autosave. */
export function usePlanningArtifact({ document, sources, drawingId, artifact, onChange, locale }: {
  document: PlanDocument | null; sources: SourceLibrary; drawingId: string; artifact: PlanningArtifact | null;
  onChange: (next: PlanningArtifact) => void; locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captureApi = useRef<PlanningCapture | null>(null);
  const onCaptureReady = useCallback((api: PlanningCapture | null) => { captureApi.current = api; }, []);
  const controller = useRef<AbortController | null>(null);
  const current = useRef({ document, sources, drawingId, artifact, onChange });
  useEffect(() => { current.current = { document, sources, drawingId, artifact, onChange }; });
  useEffect(() => { controller.current?.abort(); return () => controller.current?.abort(); }, [document, sources, drawingId]);
  async function revise(brief: string, externalSignal?: AbortSignal): Promise<string> {
    if (!document || controller.current) throw new Error("The planning document is busy or no drawing is open.");
    if (artifact && planningIsStale(artifact, document, sources)) throw new Error("Refresh the document from the drawing before asking Muse to revise it.");
    const abort = new AbortController(); controller.current = abort;
    const signal = externalSignal ? AbortSignal.any([abort.signal, externalSignal]) : abort.signal;
    const assertCurrent = () => {
      signal.throwIfAborted();
      if (current.current.document !== document || current.current.sources !== sources || current.current.drawingId !== drawingId) throw new DOMException("Stale document", "AbortError");
    };
    setOpen(true); setBusy(true); setError(null); setProgress(null);
    try {
      let next = artifact ?? createPlanningArtifact(document, sources, drawingId, locale);
      const response = await fetch("/api/plans/planning", { method: "POST", headers: { "Content-Type": "application/json" }, signal,
        body: JSON.stringify({ document, sources: await selectedReferences(sources, document), content: next.content, brief, locale, target: open ? target : null }) });
      const data = await response.json(); assertCurrent();
      if (!response.ok) throw new Error(data.error ?? "Muse could not revise the planning document. Try again.");
      const content = PlanningContentSchema.parse(data.content);
      const captureIds = Array.isArray(data.captureIds) ? data.captureIds.filter((id: unknown): id is string => typeof id === "string") : [];
      next = revisePlanningArtifact(next, content);
      current.current.onChange(next);
      let failed = 0;
      for (let i = 0; i < captureIds.length; i++) {
        assertCurrent(); setProgress({ completed: i, total: captureIds.length });
        try {
          if (!captureApi.current) throw new Error("The camera is not ready. Try again.");
          const photo = await captureApi.current.capture(captureIds[i], AbortSignal.any([signal, AbortSignal.timeout(30_000)]));
          assertCurrent();
          next = PlanningArtifactSchema.parse({ ...next, updatedAt: new Date().toISOString(), photos: [...next.photos.filter(p => p.targetId !== photo.targetId), photo] });
          current.current.onChange(next);
        } catch (cause) { assertCurrent(); failed++; setError(cause instanceof Error ? cause.message : "Photography failed. Please try again."); }
      }
      setProgress(null);
      const summary = typeof data.summary === "string" ? data.summary : "";
      return summary + (failed ? "\n" + translate(locale, "{count} photos failed. Document changes were retained; ask Muse to retry.", { count: failed }) : captureIds.length ? "\n" + translate(locale, "Added {count} scene captures to the document.", { count: captureIds.length }) : "");
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "Muse could not revise the planning document. Try again.");
      throw cause;
    } finally { if (controller.current === abort) { controller.current = null; setBusy(false); setProgress(null); } }
  }
  return { open, setOpen, target, setTarget, busy, progress, error, onCaptureReady, revise, cancel: () => controller.current?.abort() };
}
