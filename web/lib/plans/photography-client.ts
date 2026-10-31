import { MAX_PHOTO_ROUNDS, PhotographyPlanSchema, PhotographyReviewSchema, type PhotoIntent, type PhotoShot } from './photography';
import type { PlanDocument } from './schema';
import type { Locale } from '@/lib/i18n/messages';

export type PhotoRequest = { id: string; brief: string; locale: Locale; history: { role: 'user' | 'assistant'; text: string }[] };
export type CapturedPhoto = { shot: PhotoShot; image: string };
export type PhotoReview = { round: number; action: 'select' | 'revise'; intent: PhotoIntent; explanation: string; candidates: CapturedPhoto[] };
export type PhotoResult = CapturedPhoto & { intent: PhotoIntent; explanation: string; reviews: PhotoReview[] };

/** Each review receives actual rendered pixels. Revisions are bounded and cannot silently become approval. */
export async function photograph(request: PhotoRequest, document: PlanDocument, options: {
  signal: AbortSignal;
  capture: (shot: PhotoShot, signal: AbortSignal) => Promise<CapturedPhoto>;
  reviewed?: (review: PhotoReview) => void;
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
  const reviews: PhotoReview[] = [];
  options.progress('plan');
  let plan = PhotographyPlanSchema.parse(await post({ phase: 'plan', brief: request.brief, history: request.history }));
  for (let round = 0; round < MAX_PHOTO_ROUNDS; round++) {
    options.progress('capture', plan.intent, reviews.at(-1)?.explanation);
    const candidates: CapturedPhoto[] = [];
    // Rendering shares a scene: serialize display-setting changes and captures.
    for (const shot of plan.candidates) {
      signal.throwIfAborted();
      candidates.push(await options.capture(shot, signal));
    }
    options.progress('review', plan.intent);
    const review = PhotographyReviewSchema.parse(await post({ phase: 'review', brief: request.brief, intent: plan.intent, candidates, round, previousReviews: reviews.map(({intent,explanation})=>({intent,explanation})) }));
    const recorded: PhotoReview = { round, action: review.action, intent: plan.intent, explanation: review.explanation, candidates };
    reviews.push(recorded);
    options.reviewed?.(recorded);
    if (review.action === 'select') {
      const selected = candidates.find(candidate => candidate.shot.id === review.shotId);
      if (!selected) throw new Error('The selected camera angle was not photographed.');
      return { ...selected, intent: plan.intent, explanation: review.explanation, reviews };
    }
    plan = review;
  }
  throw new Error('Muvi could not find a suitable angle. Try a more specific subject.');
}
