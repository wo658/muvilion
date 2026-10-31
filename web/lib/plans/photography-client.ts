import { MAX_PHOTO_ROUNDS, PhotographyPlanSchema, PhotographyReviewSchema, type PhotoIntent, type PhotoShot } from './photography';
import type { PlanDocument } from './schema';
import type { Locale } from '@/lib/i18n/messages';

export type PhotoRequest = { id: string; brief: string; locale: Locale; history: { role: 'user' | 'assistant'; text: string }[] };
export type CapturedPhoto = { shot: PhotoShot; image: string };
export type PhotoResult = CapturedPhoto & { intent: PhotoIntent; explanation: string };

/** Each review receives actual rendered pixels. Revisions are bounded and cannot silently become approval. */
export async function photograph(request: PhotoRequest, document: PlanDocument, options: {
  signal: AbortSignal;
  capture: (shot: PhotoShot, signal: AbortSignal) => Promise<CapturedPhoto>;
  progress: (phase: 'plan' | 'capture' | 'review', intent?: PhotoIntent, explanation?: string) => void;
}): Promise<PhotoResult> {
  const { signal } = options;
  const post = async (body: object) => {
    signal.throwIfAborted();
    const response = await fetch('/api/plans/photography', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, document, locale: request.locale }), signal });
    const result = await response.json();
    signal.throwIfAborted();
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Photography failed. Please try again.');
    return result;
  };
  options.progress('plan');
  let plan = PhotographyPlanSchema.parse(await post({ phase: 'plan', brief: request.brief, history: request.history }));
  for (let round = 0; round < MAX_PHOTO_ROUNDS; round++) {
    options.progress('capture', plan.intent);
    const candidates: CapturedPhoto[] = [];
    // Rendering shares a scene: serialize display-setting changes and captures.
    for (const shot of plan.candidates) {
      signal.throwIfAborted();
      candidates.push(await options.capture(shot, signal));
    }
    options.progress('review', plan.intent);
    const review = PhotographyReviewSchema.parse(await post({ phase: 'review', intent: plan.intent, candidates, round }));
    if (review.action === 'select') {
      const selected = candidates.find(candidate => candidate.shot.id === review.shotId);
      if (!selected) throw new Error('The selected camera angle was not photographed.');
      return { ...selected, intent: plan.intent, explanation: review.explanation };
    }
    options.progress('capture', review.intent, review.explanation);
    plan = review;
  }
  throw new Error('Muvi could not find a suitable angle. Try a more specific subject.');
}
