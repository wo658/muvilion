import { MuviOperationKindSchema, MuviOperationSchema, type MuviOperation } from "@/lib/muvi/operations";
import { z } from "zod";
import { DesignObjectSchema, ZoneSchema, WallSurfaceSchema, PlanDocumentSchema, type PlanDocument } from "./schema";
import { applyDesignProposal } from "./muse";
import { designWarnings } from "./design";

export const DesignPatchSchema = z.object({
  operation: MuviOperationKindSchema.optional().describe("Choose Muvi work gesture: inspect for planning/removal, measure for dimensions, arrange for placement/building, paint for finishes. Decorative only."),
  label: z.string().min(1).max(200),
  objects: z.array(DesignObjectSchema).max(32),
  zones: z.array(ZoneSchema).max(32),
  removeObjects: z.array(z.string()).max(200),
  removeZones: z.array(z.string()).max(200),
  wallSurfaces: z.array(WallSurfaceSchema).max(32).optional(),
  removeWallSurfaces: z.array(z.string()).max(200).optional(),
});
function merge<T extends { id: string }>(before: T[], updates: T[], removed: string[]) {
  if (new Set(updates.map(x => x.id)).size !== updates.length || new Set(removed).size !== removed.length || updates.some(x => removed.includes(x.id))) throw new Error("Conflicting patch IDs.");
  if (removed.some(id => !before.some(x => x.id === id))) throw new Error("Unknown removal ID.");
  return [...before.filter(x => !removed.includes(x.id) && !updates.some(y => y.id === x.id)), ...updates];
}

export function applyDesignPatch(base: PlanDocument, patch: z.infer<typeof DesignPatchSchema>) {
  const p = DesignPatchSchema.parse(patch);
  return applyDesignProposal(base, { summary: p.label, assumptions: [], objects: merge(base.objects ?? [], p.objects, p.removeObjects), zones: merge(base.zones ?? [], p.zones, p.removeZones), wallSurfaces: merge(base.wallSurfaces ?? [], p.wallSurfaces ?? [], p.removeWallSurfaces ?? []) });
}
export type DesignPatch = z.infer<typeof DesignPatchSchema>;
export type HeldPatchItem = { kind: "object" | "zone" | "wallSurface" | "removals"; id: string; label: string };
/**
 * Split a group into the largest part that adds no geometry warnings and the items held back.
 * Rejecting a whole group for one bad item made the model resend everything, at one model step
 * per attempt. Removals form one unit; items that depend on a held item (an object in a held
 * zone, a surface on a held partition) are held too because applying them fails.
 */
export function partitionDesignPatch(base: PlanDocument, patch: DesignPatch) {
  const full = applyDesignPatch(base, patch);
  const before = new Map<string, number>();
  for (const warning of designWarnings(base)) before.set(warning, (before.get(warning) ?? 0) + 1);
  const clean = (document: PlanDocument) => {
    const remaining = new Map(before);
    return designWarnings(document).every(warning => {
      const count = remaining.get(warning) ?? 0;
      remaining.set(warning, count - 1);
      return count > 0;
    });
  };
  if (clean(full)) return { draft: full, patch, held: [] as HeldPatchItem[], saved: Infinity, full: undefined };
  const p = DesignPatchSchema.parse(patch);
  type Unit = HeldPatchItem & { add: (part: DesignPatch) => DesignPatch };
  const units: Unit[] = [];
  if (p.removeObjects.length || p.removeZones.length || p.removeWallSurfaces?.length)
    units.push({ kind: "removals", id: "removals", label: "Removals", add: part => ({ ...part, removeObjects: p.removeObjects, removeZones: p.removeZones, removeWallSurfaces: p.removeWallSurfaces }) });
  for (const zone of p.zones) units.push({ kind: "zone", id: zone.id, label: zone.label, add: part => ({ ...part, zones: [...part.zones, zone] }) });
  for (const object of p.objects) units.push({ kind: "object", id: object.id, label: object.label, add: part => ({ ...part, objects: [...part.objects, object] }) });
  for (const surface of p.wallSurfaces ?? []) units.push({ kind: "wallSurface", id: surface.id, label: surface.label, add: part => ({ ...part, wallSurfaces: [...(part.wallSurfaces ?? []), surface] }) });
  let accepted: DesignPatch = { operation: p.operation, label: p.label, objects: [], zones: [], removeObjects: [], removeZones: [], wallSurfaces: [], removeWallSurfaces: [] };
  let draft = base, pending = units;
  // Later passes pick up items whose dependency was accepted after them.
  for (let pass = 0; pass < 3 && pending.length; pass++) {
    const left: Unit[] = [];
    for (const unit of pending) {
      const candidate = unit.add(accepted);
      let next: PlanDocument | undefined;
      try { next = applyDesignPatch(base, candidate); } catch { next = undefined; }
      if (next && clean(next)) { accepted = candidate; draft = next; } else left.push(unit);
    }
    if (left.length === pending.length) break;
    pending = left;
  }
  return { draft, patch: accepted, held: pending.map(({ kind, id, label }) => ({ kind, id, label })), saved: units.length - pending.length, full };
}
export const DesignPreviewSchema = z.object({
  wallSurfaces: z.array(WallSurfaceSchema).max(200).optional(), removeWallSurfaces: z.array(z.string()).max(200).optional(),
  type: z.literal("preview"), revision: z.number().int().positive(), label: z.string(),
  objects: PlanDocumentSchema.shape.objects.unwrap(), zones: PlanDocumentSchema.shape.zones.unwrap(), warnings: z.array(z.string()), removeObjects: z.array(z.string()).max(200), removeZones: z.array(z.string()).max(200),
});
export type DesignPreview = z.infer<typeof DesignPreviewSchema>;
export function designPreview(before: PlanDocument, after: PlanDocument, revision: number, label: string): DesignPreview {
  function changes<T extends { id: string }>(a: T[], b: T[]) {
    return { updates: b.filter(item => JSON.stringify(item) !== JSON.stringify(a.find(old => old.id === item.id))), removed: a.filter(item => !b.some(next => next.id === item.id)).map(item => item.id) };
  }
  const objects = changes(before.objects ?? [], after.objects ?? []), zones = changes(before.zones ?? [], after.zones ?? []);
  const surfaces = changes(before.wallSurfaces ?? [], after.wallSurfaces ?? []);
  return { type: "preview", revision, label, wallSurfaces: surfaces.updates, removeWallSurfaces: surfaces.removed, objects: objects.updates, zones: zones.updates, removeObjects: objects.removed, removeZones: zones.removed, warnings: after.warnings };
}
export function previewDocument(base: PlanDocument, event: DesignPreview) {
  return PlanDocumentSchema.parse({ ...base, objects: merge(base.objects ?? [], event.objects, event.removeObjects), zones: merge(base.zones ?? [], event.zones, event.removeZones), wallSurfaces: merge(base.wallSurfaces ?? [], event.wallSurfaces ?? [], event.removeWallSurfaces ?? []), warnings: event.warnings });
}
/** Native fetch stream: only complete newline-delimited events are exposed. */
export async function readDesignStream(response: Response, onPreview: (event: DesignPreview) => void, onOperation?: (event: MuviOperation) => void) {
  if (!response.ok) throw new Error((await response.json()).error ?? "Design request failed.");
  if (!response.body) throw new Error("Missing design stream.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "", revision = 0;
  let operationSequence = 0, operationRun: string | undefined;
  let result: Record<string, unknown> | undefined;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      if (buffer.length > 32 * 1024 * 1024) throw new Error("Design event is too large.");
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (result) throw new Error("Unexpected event after completion.");
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "operation") {
          const operation = MuviOperationSchema.parse(event);
          if (operation.sequence !== operationSequence + 1 || (operationRun && operationRun !== operation.runId)) throw new Error("Out-of-order Muvi operation.");
          operationSequence = operation.sequence; operationRun = operation.runId;
          onOperation?.(operation);
        } else if (event.type === "preview") {
          const preview = DesignPreviewSchema.parse(event);
          if (preview.revision !== revision + 1) throw new Error("Out-of-order design preview.");
          revision = preview.revision; onPreview(preview);
        } else if (event.type === "complete") result = event.result;
        else throw new Error("Unknown design event.");
      }
    }
    if (buffer.trim() || !result) throw new Error("Design stream ended before completion.");
    return result;
  } finally { await reader.cancel(); reader.releaseLock(); }
}
