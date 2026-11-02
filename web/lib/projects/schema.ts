import { z } from "zod";
import { PlanningArtifactSchema } from "@/lib/plans/planning-artifact";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { ReferenceSourceSchema, SourceLibrarySchema, emptySources } from "@/lib/sources/schema";

export const DrawingSourceSchema = z.object({
  id: z.string().min(1).max(100),
  document: PlanDocumentSchema,
  originalAssetId: z.string().uuid().nullable(),
  selected: z.boolean(),
});
export type DrawingSource = z.infer<typeof DrawingSourceSchema>;

export const ProjectState = z.object({
  projectVersion: z.literal(1),
  planningArtifacts: z.array(PlanningArtifactSchema).max(12).optional(),
  document: PlanDocumentSchema.nullable(),
  sources: SourceLibrarySchema,
  /** Absent in legacy single-drawing projects. document remains the active workspace. */
  drawings: z.array(DrawingSourceSchema).max(12).optional(),
  activeDrawingId: z.string().min(1).max(100).optional(),
  originalDrawingId: z.string().uuid().nullable().default(null),
  /** Page to extract when the original has not been read yet (seeded samples). */
  originalDrawingPage: z.number().int().positive().optional(),
}).superRefine((state, ctx) => {
  const drawings = state.drawings ?? [];
  const artifacts = state.planningArtifacts ?? [];
  if (new Set(artifacts.map(a => a.drawingId)).size !== artifacts.length)
    ctx.addIssue({ code: "custom", message: "Duplicate planning documents", path: ["planningArtifacts"] });
  if (new Set(drawings.map(item => item.id)).size !== drawings.length)
    ctx.addIssue({ code: "custom", message: "Duplicate drawing source IDs", path: ["drawings"] });
  if (drawings.length || state.activeDrawingId) {
    const active = drawings.find(item => item.id === state.activeDrawingId);
    if (!active || !state.document || active.originalAssetId !== state.originalDrawingId)
      ctx.addIssue({ code: "custom", message: "Invalid active drawing", path: ["activeDrawingId"] });
  }
});
export type ProjectState = z.infer<typeof ProjectState>;
export const emptyProject = (): ProjectState => ({ projectVersion: 1, document: null, sources: emptySources(), originalDrawingId: null });
export const ProjectSummary = z.object({ id: z.string().uuid(), name: z.string(), revision: z.number().int(), updatedAt: z.string() });
export type ProjectSummary = z.infer<typeof ProjectSummary>;
export const Project = ProjectSummary.extend({ state: ProjectState });
export type Project = z.infer<typeof Project>;
export const AssetBundle = z.object({ id: z.string().uuid(), name: z.string().max(255), mimeType: z.string().max(100), data: z.string().max(28_000_000).regex(/^[A-Za-z0-9+/=]*$/) });
export const CreateProject = z.object({ name: z.string().trim().min(1).max(100), state: ProjectState.default(emptyProject), assets: z.array(AssetBundle).max(25).default([]) });
export const SaveProject = z.object({ name: z.string().trim().min(1).max(100), revision: z.number().int().nonnegative(), state: ProjectState });
export const SampleDrawing = z.object({ name: z.string(), file: z.string(), page: z.number().int().positive().optional(), rasterPdf: z.boolean().optional() });
export type SampleDrawing = z.infer<typeof SampleDrawing>;
/** Sample inputs contain authored references, never persisted project/asset identifiers. */
export const SampleSource = ReferenceSourceSchema.omit({ id: true, originalAssetId: true }).extend({
  kind: z.enum(["brand", "brief", "concept"]),
  imageFiles: z.array(z.string().regex(/^[\w-]+\/[\w.-]+\.(png|jpe?g|webp)$/)).max(12).optional(),
}).refine(source => source.images.length + (source.imageFiles?.length ?? 0) <= 12, "Too many sample images").refine(source => source.kind !== "brief" || source.text.trim().length > 0, "Sample briefs need document text");
export const SampleProject = z.object({ id: z.string(), name: z.string(), drawings: z.array(SampleDrawing).min(1).max(12), sources: z.array(SampleSource).max(12).optional() });
export type SampleProject = z.infer<typeof SampleProject>;
export const ProjectExport = z.object({ projectVersion: z.literal(2), name: z.string(), state: ProjectState, assets: z.array(AssetBundle) });
