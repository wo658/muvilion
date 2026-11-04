/**
 * Limits for one Muse design run. A server started with NEXT_PUBLIC_MUSE_RECORDING_BUDGET=1 is
 * producing recorded sample runs offline, where nobody waits on the result, so it gets enough
 * time and steps for Muse to finish furnishing and pass its own review. Live runs keep the
 * defaults. The flag is public because the browser must wait as long as the server runs.
 */
const recording = process.env.NEXT_PUBLIC_MUSE_RECORDING_BUDGET === "1";
export const DESIGN_BUDGET = recording
  ? { timeoutMs: 1_500_000, wrapUpMs: 240_000, steps: 60, edits: 40, reviews: 6 }
  : { timeoutMs: 600_000, wrapUpMs: 150_000, steps: 24, edits: 16, reviews: 3 };
