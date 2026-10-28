import "server-only";
import { storedMetaKey } from "@/server/settings/store";
/**
 * Model provider configuration. Both providers speak the OpenAI chat-completions
 * protocol (function tools + streaming), so they share @ai-sdk/openai-compatible.
 *
 *   MODEL_PROVIDER=meta (default) → Meta Model API, key format `LLM|{id}|{secret}`
 *   MODEL_PROVIDER=baseten        → Baseten-hosted open-weights Muse Spark
 */
import type { Env } from "@/lib/env";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type ModelHandle = { model: LanguageModel; provider: string; modelId: string; hasKey: boolean };

export function getModel(env: Env = process.env): ModelHandle {
  const saved = storedMetaKey();
  const which = saved ? "meta" : env.MODEL_PROVIDER ?? "meta";
  if (which === "baseten") {
    const modelId = env.BASETEN_MODEL ?? "meta-models/muse-spark-open-1026";
    const provider = createOpenAICompatible({
      name: "baseten",
      baseURL: env.BASETEN_BASE_URL ?? "https://inference.baseten.co/v1",
      apiKey: env.BASETEN_API_KEY,
      includeUsage: true,
    });
    return { model: provider(modelId), provider: "baseten", modelId, hasKey: Boolean(env.BASETEN_API_KEY) };
  }
  const modelId = env.META_MODEL ?? "muse-spark-1.3";
  const provider = createOpenAICompatible({
    name: "meta",
    baseURL: env.META_BASE_URL ?? "https://api.meta.ai/v1",
    apiKey: saved ?? env.MODEL_API_KEY,
    includeUsage: true,
  });
  return { model: provider(modelId), provider: "meta", modelId, hasKey: Boolean(saved ?? env.MODEL_API_KEY) };
}
