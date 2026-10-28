import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { applyDesignProposal, PlanDesignProposal } from "@/lib/plans/muse";
import { designWarnings } from "@/lib/plans/design";
import { createToolRegistry, type ToolRegistration } from "./registry";
import { addArtifact, reserveToolCall, type DesignToolContext } from "./design-context";
import { renderDesign } from "./render-design";
import { generateConceptImage } from "./meta-image";

const phases = ["initial", "revision"] as const;

/** Add asset / 3D adapters to this catalog using the same request context and SDK tools. */
export const designToolRegistrations: readonly ToolRegistration<DesignToolContext>[] = [
  {
    name: "review_design", category: "design", phases,
    create: context => tool({
      description: "Stage a complete candidate in an isolated draft, check geometry, and render plan and isometric schematic views for visual review. Does not apply changes. Inspect the returned images before submit_design. Call again after changing a candidate.",
      inputSchema: PlanDesignProposal,
      execute: async proposal => {
        reserveToolCall(context, "review_design", 3);
        const draft = applyDesignProposal(context.base, proposal);
        const images = await Promise.all([renderDesign(draft, "plan"), renderDesign(draft, "isometric")]);
        context.signal.throwIfAborted();
        context.draft = draft;
        context.revision++;
        const artifacts = images.map((image, i) => addArtifact(context, { kind: "schematic", title: i ? "Isometric massing review" : "Plan composition review", image }));
        return { revision: context.revision, warnings: designWarnings(draft), artifacts, limitations: "Schematic masses only. No material detail, photometric lighting, eye-level sightline verification, or mesh asset geometry. Source walls are floor lines; ceiling is checked numerically, not rendered." };
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
