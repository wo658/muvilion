/**
 * POST /api/chat request body, built by the simple view's chat transport
 * (lib/chat/transport.ts, `prepareSendMessagesRequest`). The full message history is never sent:
 * run messages carry large data parts, so each intent carries only what it needs.
 *
 *   { id, intent: "run", mode?, venue, project?, speed? }      → a planning run (live or replay)
 *   { id, intent: "ask", venue, question, digest, history }    → an answer about one run
 */
import { z } from "zod";
import type { AskRequest } from "@/lib/ask/contract";

export const ChatRequestBase = z.object({
  /** The chat id (one conversation per venue in the simple view). */
  id: z.string().max(200).optional(),
  intent: z.enum(["run", "ask"]),
  venue: z.string().min(1).max(100),
});

export const ChatRunRequest = ChatRequestBase.extend({
  intent: z.literal("run"),
  mode: z.enum(["live", "replay"]).optional(),
  /** Replay pacing (1 = normal, 0 = no delays). */
  speed: z.number().min(0).max(100).optional(),
  /** Live runs: the project to plan (validated by the run; default: the venue's sample). */
  project: z.unknown().optional(),
});
export type ChatRunRequest = z.infer<typeof ChatRunRequest>;

/** Ask fields (question, digest, history) are validated by lib/ask/contract.ts AskRequest. */
export const ChatAskRequest = ChatRequestBase.extend({
  intent: z.literal("ask"),
  question: z.unknown(),
  digest: z.unknown(),
  history: z.unknown().optional(),
});

export const ChatRequest = z.discriminatedUnion("intent", [ChatRunRequest, ChatAskRequest]);
export type ChatRequest = z.infer<typeof ChatRequest>;

/** The body the client builds (ask fields typed as AskRequest). */
export type ChatBody = ChatRunRequest | ({ id?: string; intent: "ask"; venue: string } & AskRequest);
