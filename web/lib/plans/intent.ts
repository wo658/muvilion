import { z } from "zod";

export const IntentRequest = z.object({
  message: z.string().trim().min(1).max(6000),
  locale: z.enum(["en", "ko"]).default("en"),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) })).max(24).default([]),
  document: z.object({
    name: z.string().max(255), scaleConfirmed: z.boolean(),
    unknownLines: z.number().int().nonnegative(),
  }).nullable(),
  selection: z.object({ id: z.string().max(200), label: z.string().max(500) }).nullable().default(null),
});

export const IntentDecision = z.object({
  intent: z.enum(["chat", "design", "interpret", "clarify"]),
  message: z.string().trim().min(1).max(1000),
  brief: z.string().max(6000),
});
export type IntentDecision = z.infer<typeof IntentDecision>;
