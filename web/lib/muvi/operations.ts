import { z } from "zod";
import type { MuviMotion } from "./motions";

/** Presentation cues only: never part of a plan or a geometry command. */
export const MuviOperationKindSchema = z.enum(["inspect", "measure", "arrange", "paint"]);
export const MuviOperationSchema = z.object({
  type: z.literal("operation"),
  runId: z.string().uuid(),
  sequence: z.number().int().positive().max(128),
  operation: MuviOperationKindSchema,
});
export type MuviOperation = z.infer<typeof MuviOperationSchema>;
export const MUVI_OPERATION_LABELS = {
  inspect: "Muvi is inspecting…", measure: "Muvi is measuring…",
  arrange: "Muvi is arranging…", paint: "Muvi is finishing…",
} as const;

/** Tool names provide a safe fallback when a model omits the optional cue. */
export function operationForTool(name: string, input: unknown): MuviOperation["operation"] {
  if (name === "edit_design") {
    const selected = MuviOperationKindSchema.safeParse(
      input && typeof input === "object" && "operation" in input ? input.operation : undefined,
    );
    return selected.success ? selected.data : "arrange";
  }
  if (name === "review_design") return "measure";
  if (name === "generate_design_concept") return "paint";
  return "inspect";
}
export function operationMotion(operation: MuviOperation | null): MuviMotion {
  return operation?.operation ?? "walk";
}
