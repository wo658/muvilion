import { z } from "zod";

export const SourceImage = z.string().max(600_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);
export const ReferenceSourceSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["drawing", "concept", "brand", "brief"]),
  name: z.string().trim().min(1).max(255),
  selected: z.boolean(),
  url: z.string().max(2000).url().refine(value => /^https?:\/\//i.test(value), "Use an http or https URL").optional(),
  text: z.string().max(60_000).default(""),
  notes: z.string().max(6000).default(""),
  images: z.array(SourceImage).max(12).default([]),
});
export type ReferenceSource = z.infer<typeof ReferenceSourceSchema>;
export const SourceLibrarySchema = z.object({
  version: z.literal(1), drawingSelected: z.boolean(),
  items: z.array(ReferenceSourceSchema).max(12),
}).refine(value => new Set(value.items.map(item => item.id)).size === value.items.length, "Duplicate source IDs")
  .refine(value => JSON.stringify(value).length <= 10_000_000, "Sources exceed 10 MB. Remove some images or documents.");
export type SourceLibrary = z.infer<typeof SourceLibrarySchema>;
export const emptySources = (): SourceLibrary => ({ version: 1, drawingSelected: true, items: [] });
export const SourceRequestSchema = z.array(ReferenceSourceSchema).max(13).default([])
  .refine(items => JSON.stringify(items).length <= 10_000_000, "Selected sources are too large");
