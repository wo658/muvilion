import { z } from "zod";
import { DesignObjectSchema, type PlanDocument } from "./schema";

/** A model-authored brief, not an objective score of design quality. */
export const DesignBriefSchema = z.object({
  scope: z.enum(["interior", "zoning", "edit"]),
  direction: z.string().min(1).max(1200).describe("Brand/reference facts, proposed palette/materials and spatial character. Label assumptions; never invent brand facts."),
  requirements: z.array(z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(300).describe("One requested deliverable, preserving quantities and brand intent."),
    target: z.enum(["objects", "zones"]),
    kinds: z.array(DesignObjectSchema.shape.kind).max(12).default([]).describe("Allowed object kinds; empty means any. Ignored for zones."),
    minimum: z.number().int().min(0).max(200),
  })).min(1).max(24),
}).superRefine((brief, ctx) => {
  if (new Set(brief.requirements.map(r => r.id)).size !== brief.requirements.length)
    ctx.addIssue({ code: "custom", message: "Requirement IDs must be unique." });
  if (brief.scope === "interior" && !brief.requirements.some(r => r.target === "objects" && r.minimum > 0))
    ctx.addIssue({ code: "custom", message: "Interior design needs physical installations, not only zones." });
});
export type DesignBrief = z.infer<typeof DesignBriefSchema>;

export const DesignCoverageSchema = z.array(z.object({
  requirementId: z.string().min(1).max(80),
  ids: z.array(z.string().min(1).max(100)).max(200),
  decision: z.string().min(1).max(600).describe("How these elements implement the requested function and brand direction; disclose limitations."),
})).max(24);

export const DesignReviewSchema = z.object({
  direction: z.string(),
  requirements: z.array(z.object({
    id: z.string(), label: z.string(), target: z.enum(["objects", "zones"]),
    minimum: z.number(), count: z.number(), satisfied: z.boolean(), decision: z.string(),
    // Optional for reviews saved before actionable coverage diagnostics were added.
    invalidIds: z.array(z.string()).optional(),
    allowedKinds: z.array(DesignObjectSchema.shape.kind).optional(),
    coverageEntryCount: z.number().int().nonnegative().optional(),
  })),
  complete: z.boolean(),
});

export function reviewDesignCoverage(brief: DesignBrief, document: PlanDocument, coverage: z.infer<typeof DesignCoverageSchema>) {
  const requirements = brief.requirements.map(requirement => {
    const entries = coverage.filter(entry => entry.requirementId === requirement.id);
    const entry = entries.length === 1 ? entries[0] : undefined;
    const valid = new Set((requirement.target === "zones" ? document.zones ?? [] :
      (document.objects ?? []).filter(object => !requirement.kinds.length || requirement.kinds.includes(object.kind))).map(item => item.id));
    const ids = [...new Set(entry?.ids ?? [])];
    const count = ids.filter(id => valid.has(id)).length;
    return { id: requirement.id, label: requirement.label, target: requirement.target, minimum: requirement.minimum,
      count, satisfied: Boolean(entry) && count === ids.length && count >= requirement.minimum,
      decision: entry?.decision ?? "", invalidIds: ids.filter(id => !valid.has(id)),
      allowedKinds: requirement.target === "objects" ? requirement.kinds : [], coverageEntryCount: entries.length };
  });
  return { direction: brief.direction, requirements, complete: requirements.every(item => item.satisfied) };
}
