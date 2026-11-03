import "server-only";
import { assetTools } from "@/server/plans/asset-tools";
import { tool } from "ai";
import { z } from "zod";
import { applyDesignProposal, PlanDesignProposal } from "@/lib/plans/muse";
import { reviewFloorCoverage } from "@/lib/plans/floor-coverage";
import { reviewUsability } from "@/lib/plans/usability";
import { designWarnings, introducedWarnings, placementHints } from "@/lib/plans/design";
import type { PlanDocument } from "@/lib/plans/schema";
import { createToolRegistry, type ToolRegistration } from "./registry";
import { addArtifact, reserveToolCall, type DesignToolContext } from "./design-context";
import { wallSurfaceIssues } from "@/lib/plans/wall-surfaces";
import { renderDesign } from "./render-design";
import { generateConceptImage } from "./meta-image";
import { DesignBriefSchema, DesignCoverageSchema, reviewDesignCoverage } from "@/lib/plans/design-review";

import { DesignPatchSchema, designPreview, partitionDesignPatch } from "@/lib/plans/design-stream";

export const ReviewedDesignSubmission = z.object({ revision: z.number().int().positive(), summary: z.string().min(1).max(2000) }).strict();

function publish(context: DesignToolContext, label: string) {
  context.signal.throwIfAborted();
  context.emitPreview?.(designPreview(context.publishedDraft ?? context.base, context.draft, context.revision, label));
  context.publishedDraft = context.draft;
}
const phases = ["initial", "revision"] as const;
/** Fix coordinates for the objects named in the given warnings, capped to keep the tool result small. */
function hintsFor(draft: PlanDocument, warnings: string[]) {
  const ids = (draft.objects ?? []).filter(object => warnings.some(warning => warning.startsWith(`${object.label} `))).map(object => object.id);
  return placementHints(draft, ids).slice(0, 16);
}

/** Shared tools for initial design and revisions. */
export const designToolRegistrations: readonly ToolRegistration<DesignToolContext>[] = [
  {
    name: "set_design_brief", category: "design", phases,
    create: context => tool({
      description: "First record the requested interior design deliverables and brand direction. Preserve requested quantities. Separate physical installations from zoning. This brief is fixed for this run; do not reduce scope to make checks pass.",
      inputSchema: DesignBriefSchema,
      execute: async brief => {
        if (context.wholeFloorInteriorRequired && brief.scope !== "interior")
          throw new Error("This request requires a furnished interior throughout the whole floor. Use interior scope; zoning and edit cannot replace physical decoration.");
        if (brief.scope === "edit" && (context.wholeFloorRequired || context.phase === "initial"))
          throw new Error("This request designs the whole floor. Use interior or zoning scope; edit cannot reduce its required extent.");
        reserveToolCall(context, "set_design_brief", 1);
        context.brief = DesignBriefSchema.parse(brief);
        return { brief: context.brief, next: "Discover suitable assets, compose the full interior, then review_design with evidence IDs for every requirement. Existing wall analysis is optional." };
      },
    }),
  },
  {
    name: "edit_design", category: "design", phases,
    create: context => tool({
      description: "Select operation for each group: inspect (planning/removal), measure (dimensions), arrange (placing/building), paint (finishes). This only cues a decorative mascot, not completed construction. Each group is committed to the project immediately as one undoable operation, so build progressively using groups (one booth's related components together). Items that would add overlaps, out-of-floor objects or blocked circulation are held back with placement fixes while the rest of the group is saved; resend only the held items. Upsert complete objects/zones/wallSurfaces by ID; remove by ID. Wall surfaces attach finishes, graphic stripes/frames and literal lettering to existing wall line IDs or partition object IDs without changing geometry. Remove hosted surfaces in the same operation when deleting a partition. Initial design: establish whole-hall zones/circulation, booth forms, partitions/counters, then furnishings/lighting/signage. Revisions: change only affected elements. Never clear unrelated existing design. After edits call review_design with objects/zones omitted to review this draft.",
      inputSchema: DesignPatchSchema,
      execute: async patch => {
        if (!context.brief) throw new Error("Set the design brief first.");
        // The saved part of each group is one operation, so it must not leave new geometry problems.
        const { draft, held, saved, full } = partitionDesignPatch({ ...context.draft, warnings: context.base.warnings }, patch);
        const issues = full ? introducedWarnings(draft, full) : [];
        const hints = full ? placementHints(full, held.filter(item => item.kind === "object").map(item => item.id)).slice(0, 16) : [];
        const fixes = `${issues.slice(0, 12).join(" ")}${hints.length ? ` Placement fixes (normalized centre x/y; widths in metres): ${hints.join(" ")}` : ""}`;
        if (!saved)
          throw new Error(`Group rejected; no item could be saved without new geometry issues and the saved design is unchanged. Fix these and send the group again: ${fixes}`);
        reserveToolCall(context, "edit_design", 16);
        context.signal.throwIfAborted();
        context.draft = draft; context.revision++; context.review = undefined;
        publish(context, patch.label);
        const result = { revision: context.revision, objects: draft.objects?.length, zones: draft.zones?.length };
        if (!held.length) return { ...result, next: "Continue grouped edits, then review_design with geometry omitted." };
        return { ...result, held, heldIssues: issues.slice(0, 12), placementHints: hints, next: `Saved everything except the held items. Resend only those held items with these fixes; do not resend saved items. ${fixes}` };
      },
    }),
  },
  { name: "search_design_assets", category: "asset", phases, create: () => assetTools.search_design_assets },
  {
    name: "review_design", category: "design", phases,
    create: context => tool({
      description: "Review the accumulated draft by omitting objects/zones/wallSurfaces, or replace supplied collections completely. Check geometry, and render plan and isometric schematic views for visual review. A replacement that passes is committed like an edit group. Inspect the returned images before submit_design. Call again after changing a candidate.",
      inputSchema: PlanDesignProposal.extend({ objects: PlanDesignProposal.shape.objects.optional(), coverage: DesignCoverageSchema }),
      execute: async proposal => {
        if (!context.brief) throw new Error("Call set_design_brief before reviewing a candidate.");
        const draft = applyDesignProposal({ ...context.draft, warnings: context.base.warnings }, { ...proposal, objects: proposal.objects ?? context.draft.objects ?? [] });
        const review = reviewDesignCoverage(context.brief, draft, proposal.coverage);
        const floorCoverage = context.brief.scope === "edit" && !context.wholeFloorRequired ? undefined : reviewFloorCoverage(draft, context.wholeFloorInteriorRequired ? "interior" : context.brief.scope);
        if (floorCoverage && !floorCoverage.complete) review.complete = false;
        const introduced = proposal.objects || proposal.zones ? introducedWarnings(context.draft, draft) : [];
        if (introduced.length) return { revision: context.revision, rejected: true, introducedWarnings: introduced, placementHints: hintsFor(draft, introduced), next: "This replacement was rejected as a whole and not saved because it introduces geometry problems. Fix them, or edit with edit_design groups, then review again." };
        const geometryWarnings = [...designWarnings(draft), ...wallSurfaceIssues(draft)];
        const usability = reviewUsability(draft);
        if (!review.complete || floorCoverage && !floorCoverage.complete || geometryWarnings.length || usability.issues.length) {
          context.signal.throwIfAborted();
          context.draft = draft;
          context.revision++;
          context.review = review;
          publish(context, proposal.summary);
          return { revision: context.revision, designReview: review, floorCoverage, geometryWarnings, placementHints: hintsFor(draft, geometryWarnings), usability, reviewsRemaining: 3 - (context.calls.get("review_design") ?? 0), next: "Preflight failed: correct all floorCoverage.issues (allocate the entire reviewed floor and furnish every activity zone), designReview requirements (supply exactly one coverage entry per requirement; correct invalidIds using exact current-draft IDs of the required target and allowedKinds, and meet minimum counts without inventing IDs) AND all usability.issues (seat facing, table reach, pull-back/legroom, connected access) AND all geometryWarnings (overlaps, obstructed circulation, or out-of-bounds objects), then call review_design again. No visual-review budget was consumed. Do not submit." };
        }
        reserveToolCall(context, "review_design", 3);
        const images = await Promise.all([renderDesign(draft, "plan"), renderDesign(draft, "isometric")]);
        context.signal.throwIfAborted();
        context.draft = draft;
        context.revision++;
        context.review = review;
        publish(context, proposal.summary);
        const artifacts = images.map((image, i) => addArtifact(context, { kind: "schematic", title: i ? "Interior detail massing review" : "Plan composition review", image }));
        return { revision: context.revision, designReview: context.review, warnings: designWarnings(draft), floorCoverage, usability, artifacts, limitations: "Coverage checks verify referenced elements, counts and full floor allocation. Inspect sparseZones and the full-floor image: a huge zone with tiny central installations is not a finished whole-space design. Sparse-zone checks require installations to span at least half of the clipped zone extent on both axes; this is a product completeness rule, not an occupancy standard or aesthetic score or faithfulness to the original request. Geometry warnings are separate. Schematic masses only; no material detail, photometric lighting, eye-level sightline verification or mesh asset geometry." };
      },
    }),
  },
  {
    name: "generate_design_concept", category: "image", phases,
    available: context => Boolean(context.env.MODEL_API_KEY) && context.env.MUSE_IMAGE_ENABLED !== "false",
    create: context => tool({
      description: "Explore a visual design direction using Muse Image. Uses selected reference images and the latest draft schematic when present. Returns a concept image, not editable geometry. Use for initial ideation or revision; translate chosen ideas into supported design objects and review_design. At most two calls.",
      inputSchema: z.object({ prompt: z.string().min(1).max(4000) }),
      execute: async ({ prompt }) => {
        reserveToolCall(context, "generate_design_concept", 2);
        const latest = context.artifacts.findLast(a => a.kind === "schematic" && a.revision === context.revision);
        const references = [...(latest ? [latest.image] : []), ...context.sources.flatMap(s => s.images)].slice(0, 10);
        const image = await generateConceptImage(prompt, references, context.signal, context.env);
        context.signal.throwIfAborted();
        return { ...addArtifact(context, { kind: "concept", title: "Generated design direction", image }), editableGeometry: false };
      },
    }),
  },
  {
    name: "submit_design", category: "design", phases,
    create: () => tool({
      description: "Finish the run with the last visually reviewed candidate by its revision number; it becomes the saved design, and the user can undo each operation or the whole run. Do not repeat objects or zones; the server returns the exact reviewed draft. Explain aesthetic choices, reference alignment, tradeoffs, and unresolved geometry warnings in summary.",
      inputSchema: ReviewedDesignSubmission,
    }),
  },
];

export function createDesignTools(context: DesignToolContext, extensions: readonly ToolRegistration<DesignToolContext>[] = []) {
  return createToolRegistry([...designToolRegistrations, ...extensions], context, context.phase);
}
