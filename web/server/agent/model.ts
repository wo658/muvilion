import "server-only";
import { storedMetaKey } from "@/server/settings/store";
/**
 * Model provider configuration. Both providers speak the OpenAI chat-completions
 * protocol (function tools + streaming), so they share @ai-sdk/openai-compatible.
 *
 *   MODEL_PROVIDER=meta (default) → Meta Model API, key format `LLM|{id}|{secret}`
 *   MODEL_PROVIDER=baseten        → Baseten-hosted open-weights Muse Spark
 */
import { cookies, headers } from "next/headers";
import { MODEL_MODE_COOKIE, selectMetaModel } from "@/lib/model-mode";
import type { Env } from "@/lib/env";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type ModelHandle = { model: LanguageModel; provider: string; modelId: string; hasKey: boolean };

export async function getModel(overrides?: Env): Promise<ModelHandle> {
  const env = overrides ?? process.env;
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
  const configured = env.META_MODEL ?? "muse-spark-1.3";
  const context = overrides ? null : await Promise.all([cookies(), headers()]);
  const modelId = context ? selectMetaModel(configured, context[0].get(MODEL_MODE_COOKIE)?.value, context[1].get("host")) : configured;
  const provider = createOpenAICompatible({
    name: "meta",
    baseURL: env.META_BASE_URL ?? "https://api.meta.ai/v1",
    apiKey: saved ?? env.MODEL_API_KEY,
    includeUsage: true,
  });
  return { model: provider(modelId), provider: "meta", modelId, hasKey: Boolean(saved ?? env.MODEL_API_KEY) };
}
