import { z } from "zod";
import { PlanDocumentSchema, type PlanDocument } from "./schema";
import { SourceLibrarySchema, type SourceLibrary } from "@/lib/sources/schema";
import { PhotoCandidateSchema } from "./photography";
import { translate, type Locale } from "@/lib/i18n/messages";

export const SECTION_IDS = ["overview", "intent", "circulation", "operations", "notes"] as const;
export const SECTION_LABELS = { overview: "Project overview", intent: "Design intent", circulation: "Planned circulation", operations: "Operations & provisions", notes: "Assumptions & items to review" } as const;
const Fee = z.object({ amount: z.number().finite().min(0).max(10_000_000_000).nullable(), currency: z.enum(["KRW", "USD", "EUR"]), basis: z.string().max(2000), includes: z.string().max(2000), tax: z.enum(["included", "excluded", "unknown"]) }).refine(fee => fee.amount === null || Boolean(fee.basis.trim() && fee.includes.trim()), "Estimated fees need a basis and inclusion assumptions.");
export const BoothCopySchema = z.object({ id: z.string().min(1).max(100), description: z.string().max(4000), circulation: z.string().max(4000), fee: Fee });
export const PlanningContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sections: z.array(z.object({ id: z.enum(SECTION_IDS), text: z.string().max(12000) })).length(5),
  booths: z.array(BoothCopySchema).max(400),
}).superRefine((content, ctx) => {
  if (new Set(content.sections.map(s => s.id)).size !== 5 || new Set(content.booths.map(b => b.id)).size !== content.booths.length)
    ctx.addIssue({ code: "custom", message: "Duplicate document section or booth." });
});
export type PlanningContent = z.infer<typeof PlanningContentSchema>;
export const PlanningPhotoSchema = PhotoCandidateSchema.extend({ targetId: z.string().min(1).max(100), capturedAt: z.string().datetime() });
export const PlanningArtifactSchema = z.object({
  id: z.string().uuid(), drawingId: z.string().min(1).max(100), revision: z.number().int().positive(), updatedAt: z.string().datetime(),
  basis: z.object({ document: PlanDocumentSchema, sources: SourceLibrarySchema }),
  content: PlanningContentSchema,
  photos: z.array(PlanningPhotoSchema).max(401),
  history: z.array(z.object({ revision: z.number().int().positive(), content: PlanningContentSchema })).max(5),
}).superRefine((artifact, ctx) => {
  const ids = new Set(["overview", ...planningBooths(artifact.basis.document).map(b => b.id)]);
  if (artifact.content.booths.some(b => !ids.has(b.id)) || artifact.photos.some(p => !ids.has(p.targetId)) || new Set(artifact.photos.map(p => p.targetId)).size !== artifact.photos.length)
    ctx.addIssue({ code: "custom", message: "Invalid planning booth or photo target." });
});
export type PlanningArtifact = z.infer<typeof PlanningArtifactSchema>;

/** Only explicit booth / assignable zones and standalone booth objects are participation inventory. */
export function planningBooths(plan: PlanDocument) {
  const zones = (plan.zones ?? []).filter(z => z.purpose === "booth" || z.assignable);
  const zoneIds = new Set(zones.map(z => z.id));
  return [...zones, ...(plan.objects ?? []).filter(o => o.kind === "booth" && !zoneIds.has(o.zoneId ?? "") && !zoneIds.has(o.id))]
    .map(b => ({ id: b.id, label: b.label, width: b.width, depth: b.depth, height: "height" in b ? b.height : null, x: b.x, y: b.y, rotation: b.rotation }));
}
export function emptyBoothCopy(id: string): PlanningContent["booths"][number] {
  return { id, description: "", circulation: "", fee: { amount: null, currency: "KRW", basis: "", includes: "", tax: "unknown" } };
}
export function createPlanningArtifact(document: PlanDocument, sources: SourceLibrary, drawingId: string, locale: Locale): PlanningArtifact {
  return PlanningArtifactSchema.parse({ id: crypto.randomUUID(), drawingId, revision: 1, updatedAt: new Date().toISOString(),
    basis: { document, sources }, content: { title: document.source.name.replace(/\.[^.]+$/, "") + " · " + translate(locale, "Planning report"),
      sections: SECTION_IDS.map(id => ({ id, text: "" })), booths: planningBooths(document).map(b => emptyBoothCopy(b.id)) }, photos: [], history: [] });
}
export function revisePlanningArtifact(artifact: PlanningArtifact, content: PlanningContent): PlanningArtifact {
  return PlanningArtifactSchema.parse({ ...artifact, content, revision: artifact.revision + 1, updatedAt: new Date().toISOString(),
    history: [...artifact.history, { revision: artifact.revision, content: artifact.content }].slice(-5) });
}
export function refreshPlanningArtifact(artifact: PlanningArtifact, document: PlanDocument, sources: SourceLibrary): PlanningArtifact {
  const next = { ...artifact, basis: { document, sources }, photos: [] };
  const content = { ...artifact.content, booths: planningBooths(document).map(b => artifact.content.booths.find(copy => copy.id === b.id) ?? emptyBoothCopy(b.id)) };
  return revisePlanningArtifact(next, content);
}
export function planningIsStale(artifact: PlanningArtifact, document: PlanDocument, sources: SourceLibrary) {
  return JSON.stringify(artifact.basis) !== JSON.stringify({ document, sources });
}
export const PlanningEditSchema = z.object({
  summary: z.string().min(1).max(1500), title: z.string().trim().min(1).max(200).optional(),
  sections: z.array(z.object({ id: z.enum(SECTION_IDS), text: z.string().max(12000) })).max(5),
  booths: z.array(BoothCopySchema).max(400),
  captureIds: z.array(z.string().min(1).max(100)).max(401).default([]),
});
export function applyPlanningEdit(content: PlanningContent, edit: z.infer<typeof PlanningEditSchema>) {
  const ids = new Set(content.booths.map(b => b.id));
  if (edit.booths.some(b => !ids.has(b.id)) || edit.captureIds.some(id => id !== "overview" && !ids.has(id)) || new Set(edit.booths.map(b => b.id)).size !== edit.booths.length || new Set(edit.sections.map(s => s.id)).size !== edit.sections.length)
    throw new Error("Muse returned an invalid document update. Your document is unchanged.");
  return PlanningContentSchema.parse({ title: edit.title ?? content.title,
    sections: content.sections.map(s => edit.sections.find(update => update.id === s.id) ?? s),
    booths: content.booths.map(b => edit.booths.find(update => update.id === b.id) ?? b) });
}
