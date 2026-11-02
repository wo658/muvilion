import { z } from "zod";

export const MODEL_MODE_COOKIE = "muvilion-model-mode";
export const ModelMode = z.enum(["standard", "contributor"]);
export const ModelModeStatus = z.object({ supported: z.boolean(), mode: ModelMode, modelId: z.string() });

/** Remote visitors never inherit a developer's Contributor environment default. */
export function selectMetaModel(configured: string, preference: string | undefined, host: string | null): string {
  const match = /^(muse-spark-1\.[23])(-contributor)?$/.exec(configured);
  if (!match) return configured;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? "");
  const contributor = preference === "contributor" || (preference === undefined && local && Boolean(match[2]));
  return match[1] + (contributor ? "-contributor" : "");
}
