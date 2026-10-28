import { z } from "zod";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { SourceLibrarySchema, emptySources } from "@/lib/sources/schema";

export const ProjectState = z.object({
  projectVersion: z.literal(1),
  document: PlanDocumentSchema.nullable(),
  sources: SourceLibrarySchema,
  originalDrawingId: z.string().uuid().nullable().default(null),
  /** Page to extract when the original has not been read yet (seeded samples). */
  originalDrawingPage: z.number().int().positive().optional(),
});
export type ProjectState = z.infer<typeof ProjectState>;
export const emptyProject = (): ProjectState => ({ projectVersion: 1, document: null, sources: emptySources(), originalDrawingId: null });
export const ProjectSummary = z.object({ id: z.string().uuid(), name: z.string(), revision: z.number().int(), updatedAt: z.string() });
export type ProjectSummary = z.infer<typeof ProjectSummary>;
export const Project = ProjectSummary.extend({ state: ProjectState });
export type Project = z.infer<typeof Project>;
export const AssetBundle = z.object({ id: z.string().uuid(), name: z.string().max(255), mimeType: z.string().max(100), data: z.string().max(28_000_000).regex(/^[A-Za-z0-9+/=]*$/) });
export const CreateProject = z.object({ name: z.string().trim().min(1).max(100), state: ProjectState.default(emptyProject), assets: z.array(AssetBundle).max(13).default([]) });
export const SaveProject = z.object({ name: z.string().trim().min(1).max(100), revision: z.number().int().nonnegative(), state: ProjectState });
export const ProjectExport = z.object({ projectVersion: z.literal(2), name: z.string(), state: ProjectState, assets: z.array(AssetBundle) });
