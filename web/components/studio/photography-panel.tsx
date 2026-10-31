"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, buttonVariants } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/provider';
import { localizeMessage, type MessageKey } from '@/lib/i18n/messages';
import type { PlanDocument } from '@/lib/plans/schema';
import type { PhotoShot } from '@/lib/plans/photography';
import { photograph, type PhotoRequest, type PhotoResult } from '@/lib/plans/photography-client';
import type { PhotoRenderer, PhotoAdjustment } from './scene-photography';

const adjustments: [PhotoAdjustment, MessageKey][] = [
  ['left', 'Turn left'], ['right', 'Turn right'], ['up', 'Look up'], ['down', 'Look down'],
  ['truckLeft', 'Move left'], ['truckRight', 'Move right'], ['truckUp', 'Move up'], ['truckDown', 'Move down'],
  ['closer', 'Move closer'], ['farther', 'Move farther'], ['narrower', 'Narrower view'], ['wider', 'Wider view'],
];

export function PhotographyPanel({ request, document, renderer, applySettings, onClose }: {
  request: PhotoRequest; document: PlanDocument; renderer: PhotoRenderer | null;
  applySettings: (shot: PhotoShot) => void; onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [status, setStatus] = useState<MessageKey>('Planning the shot…');
  const [intent, setIntent] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [adjusted, setAdjusted] = useState(false);
  const [pose, setPose] = useState<PhotoShot | null>(null);
  const abort = useRef<AbortController | null>(null);
  const actions = useRef({ applySettings });
  useEffect(() => { actions.current = { applySettings }; }, [applySettings]);
  useEffect(() => {
    if (!renderer) return;
    const controller = new AbortController();
    abort.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)]);
    void photograph(request, document, {
      signal,
      capture: async (shot, captureSignal) => {
        actions.current.applySettings(shot);
        return renderer.capture(shot, captureSignal);
      },
      progress: (phase, nextIntent, reason) => {
        if (signal.aborted) return;
        setStatus(phase === 'plan' ? 'Planning the shot…' : phase === 'capture' ? 'Photographing candidate angles…' : 'Reviewing camera angles…');
        if (nextIntent) setIntent(nextIntent.description);
        if (reason) setExplanation(reason);
      },
    }).then(async photo => {
      signal.throwIfAborted();
      actions.current.applySettings(photo.shot);
      await renderer.restore(photo.shot, signal);
      signal.throwIfAborted();
      setResult(photo); setPose(photo.shot); setExplanation(photo.explanation);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Photography failed. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [request, document, renderer]);
  // Camera details also track mouse/touch adjustments, without storing transient poses in project state.
  useEffect(() => {
    if (!renderer || !result || busy) return;
    const interval = window.setInterval(() => {
      const next = renderer.current();
      setPose(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }, 250);
    return () => window.clearInterval(interval);
  }, [renderer, result, busy]);
  async function edit(action: PhotoAdjustment | 'restore' | 'capture') {
    if (!renderer || !result || busy) return;
    setBusy(true); setError(null);
    const signal = abort.current?.signal ?? AbortSignal.abort();
    try {
      if (action === 'restore') { applySettings(result.shot); await renderer.restore(result.shot, signal); }
      else if (action === 'capture') {
        const captured = await renderer.capture(renderer.current(), signal);
        signal.throwIfAborted();
        setResult({ ...result, ...captured }); setAdjusted(true);
      } else await renderer.adjust(action);
      signal.throwIfAborted(); setPose(renderer.current());
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Photography failed. Please try again.');
    } finally { if (!signal.aborted) setBusy(false); }
  }
  return <section className="ps-photography-panel" aria-label={t('Muvi photography')} data-testid="photography-panel">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{t('Muvi photography')}</h2><Button size="sm" variant="ghost" onClick={onClose}>{t(busy ? 'Cancel photography' : 'Close photography')}</Button></div>
    {busy && !result && <p role="status">{t(status)}</p>}
    {intent && <p className="text-sm text-ink-soft">{intent}</p>}
    {adjusted && <p className="text-xs text-muted">{t("User-adjusted photo · not reviewed again by AI")}</p>}
    {explanation && !adjusted && <p className="text-xs text-muted">{explanation}</p>}
    {error && <p role="alert" className="text-sm text-bad">{localizeMessage(locale, error)}</p>}
    {result && <>
      <Image unoptimized src={result.image} width={1280} height={720} alt={result.intent.title} className="w-full rounded-lg"/>
      <p className="text-xs text-muted">{t('Photos stay in this session. Download the photo to keep it.')}</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void edit('restore')}>{t('Open this angle')}</Button><Button size="sm" disabled={busy} onClick={() => void edit('capture')}>{t('Retake photo')}</Button><a className={buttonVariants({ size: 'sm', variant: 'outline' })} href={result.image} download="muvilion-photo.jpg">{t('Download photo')}</a></div>
      <p className="text-xs text-muted">{t('Drag to orbit. Right-drag to pan. Scroll to zoom.')}</p>
      <details><summary className="cursor-pointer text-sm">{t('Fine-tune angle')}</summary><div className="mt-2 grid grid-cols-2 gap-1">{adjustments.map(([action, label]) => <Button size="sm" variant="outline" key={action} disabled={busy} onClick={() => void edit(action)}>{t(label)}</Button>)}</div></details>
      {pose && <details><summary className="cursor-pointer text-sm">{t('Camera details')}</summary><output className="block break-words text-xs text-muted" aria-label={t('Camera details')}>{JSON.stringify({ eye: pose.eye.map(n => +n.toFixed(3)), target: pose.target.map(n => +n.toFixed(3)), fov: +pose.fov.toFixed(2), zoom: +pose.zoom.toFixed(3), aspect: '16:9' })}</output></details>}
    </>}
  </section>;
}
