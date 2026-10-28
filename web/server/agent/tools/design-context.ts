import "server-only";
import type { PlanDocument } from "@/lib/plans/schema";
import type { ReferenceSource } from "@/lib/sources/schema";
import type { DesignArtifact } from "@/lib/plans/design-artifacts";
import type { Env } from "@/lib/env";
import type { DesignPhase } from "./registry";

export type DesignToolContext = {
  base: PlanDocument;
  draft: PlanDocument;
  phase: DesignPhase;
  revision: number;
  sources: ReferenceSource[];
  signal: AbortSignal;
  env: Env;
  artifacts: DesignArtifact[];
  pendingImages: DesignArtifact[];
  calls: Map<string, number>;
};

export function reserveToolCall(context: DesignToolContext, name: string, limit: number) {
  context.signal.throwIfAborted();
  const used = context.calls.get(name) ?? 0;
  if (used >= limit) throw new Error(`${name} call budget exhausted. Continue with available evidence.`);
  context.calls.set(name, used + 1);
}

export function addArtifact(context: DesignToolContext, artifact: Omit<DesignArtifact, "id" | "revision">) {
  const result = { ...artifact, id: `design-${context.artifacts.length + 1}`, revision: context.revision };
  context.artifacts.push(result);
  context.pendingImages.push(result);
  return { id: result.id, title: result.title, kind: result.kind, revision: result.revision };
}
