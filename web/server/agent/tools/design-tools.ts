import "server-only";
import { assetTools } from "@/server/plans/asset-tools";
import { tool } from "ai";
import { z } from "zod";
import { applyDesignProposal, PlanDesignProposal } from "@/lib/plans/muse";
import { designWarnings } from "@/lib/plans/design";
import { createToolRegistry, type ToolRegistration } from "./registry";
import { addArtifact, reserveToolCall, type DesignToolContext } from "./design-context";
import { renderDesign } from "./render-design";
import { generateConceptImage } from "./meta-image";
import { DesignBriefSchema, DesignCoverageSchema, reviewDesignCoverage } from "@/lib/plans/design-review";

const phases = ["initial", "revision"] as const;

/** Shared tools for initial design and revisions. */
export const designToolRegistrations: readonly ToolRegistration<DesignToolContext>[] = [
  {
    name: "set_design_brief", category: "design", phases,
    create: context => tool({
      description: "First record the requested interior design deliverables and brand direction. Preserve requested quantities. Separate physical installations from zoning. This brief is fixed for this run; do not reduce scope to make checks pass.",
      inputSchema: DesignBriefSchema,
      execute: async brief => {
        reserveToolCall(context, "set_design_brief", 1);
        context.brief = DesignBriefSchema.parse(brief);
        return { brief: context.brief, next: "Discover suitable assets, compose the full interior, then review_design with evidence IDs for every requirement. Existing wall analysis is optional." };
      },
    }),
  },
  { name: "search_design_assets", category: "asset", phases, create: () => assetTools.search_design_assets },
  {
    name: "review_design", category: "design", phases,
    create: context => tool({
      description: "Stage a complete candidate in an isolated draft, check geometry, and render plan and isometric schematic views for visual review. Does not apply changes. Inspect the returned images before submit_design. Call again after changing a candidate.",
      inputSchema: PlanDesignProposal.extend({ coverage: DesignCoverageSchema }),
      execute: async proposal => {
        if (!context.brief) throw new Error("Call set_design_brief before reviewing a candidate.");
        reserveToolCall(context, "review_design", 3);
        const draft = applyDesignProposal(context.base, proposal);
        const images = await Promise.all([renderDesign(draft, "plan"), renderDesign(draft, "isometric")]);
        context.signal.throwIfAborted();
        context.draft = draft;
        context.revision++;
        context.review = reviewDesignCoverage(context.brief, draft, proposal.coverage);
        const artifacts = images.map((image, i) => addArtifact(context, { kind: "schematic", title: i ? "Interior detail massing review" : "Plan composition review", image }));
        return { revision: context.revision, designReview: context.review, warnings: designWarnings(draft), artifacts, limitations: "Coverage checks only verify referenced elements and counts, not aesthetic quality or faithfulness to the original request. Geometry warnings are separate. Schematic masses only; no material detail, photometric lighting, eye-level sightline verification or mesh asset geometry." };
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
      description: "Submit the last visually reviewed candidate for user approval. Keep its objects and zones identical to review_design. Explain aesthetic choices, reference alignment, tradeoffs, and unresolved geometry warnings in summary. This does not apply changes.",
      inputSchema: PlanDesignProposal,
    }),
  },
];

export function createDesignTools(context: DesignToolContext, extensions: readonly ToolRegistration<DesignToolContext>[] = []) {
  return createToolRegistry([...designToolRegistrations, ...extensions], context, context.phase);
}
