/**
 * "Ask Muse" — follow-up questions about a finished (or running) run, answered in plain language.
 *
 * POST /api/ask  body: AskRequest  →  plain text stream (the answer).
 * The client sends a compact digest of the run it is showing (built by `buildRunDigest` from the
 * streamed events), so the server needs no run storage and replays work the same as live runs.
 * The answer may only use numbers present in the digest.
 */
import { z } from "zod";

export const DigestIteration = z.object({
  iteration: z.number().int(),
  crowded_s_per_visitor: z.number().nullable(),
  completed_fraction: z.number().nullable(),
  p90_travel_time_s: z.number().nullable(),
  /** Plain description of what changed to get here (empty for the baseline). */
  change: z.string(),
  /** Booths next to the worst crowding, if simulated. */
  crowded_near: z.array(z.string()),
});

export const RunDigest = z.object({
  venue: z.object({ id: z.string(), name: z.string(), setting: z.enum(["indoor", "outdoor"]) }),
  scenario: z.object({ kind: z.string(), agents: z.number(), duration_s: z.number() }),
  crowd_threshold: z.number(),
  target_crowded_s_per_visitor: z.number(),
  brief: z.string().nullable(),
  iterations: z.array(DigestIteration),
  stop_reason: z.string().nullable(),
  baseline_iteration: z.number().int().nullable(),
  final_iteration: z.number().int().nullable(),
  /** Things that need a person's approval (e.g. released organizer pins). */
  approvals: z.array(z.string()),
  /** Items the site plan could not confirm. */
  unknowns: z.array(z.string()),
});
export type RunDigest = z.infer<typeof RunDigest>;

export const AskRequest = z.object({
  question: z.string().min(1).max(500),
  digest: RunDigest,
  /** Earlier turns of this conversation, oldest first (kept short by the client). */
  history: z.array(z.object({ role: z.enum(["user", "muse"]), text: z.string().max(2000) })).max(12).default([]),
});
export type AskRequest = z.infer<typeof AskRequest>;
