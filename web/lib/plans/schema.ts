import { z } from "zod";
import { isSimpleFootprint } from "./footprint";
import { MODEL_ASSET_IDS, MATERIAL_ASSET_IDS, getModelAsset } from "@/lib/assets/catalog";

const PointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export const DesignObjectSchema = z.object({
  modelAssetId: z.enum(MODEL_ASSET_IDS).optional().describe("Downloaded CC0 model ID from search_design_assets. Use the matching furniture/light kind; omit for schematic geometry."),
  materialAssetId: z.enum(MATERIAL_ASSET_IDS).optional().describe("Downloaded PBR material ID for a schematic installation such as a partition. Do not combine with modelAssetId."),
  provenance: z.enum(["ai", "manual"]).optional(),
  appearance: z.enum(["screen", "counter", "sofa", "table", "plant", "truss", "seat"]).optional(),
  id: z.string().min(1).max(100), kind: z.enum(["booth", "stage", "lounge", "partition", "furniture", "equipment", "light", "hanging-sign", "canopy", "beam"]), label: z.string().max(100),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(100), depth: z.number().positive().max(100), height: z.number().positive().max(30),
  elevation: z.number().min(0).max(30).optional(), zoneId: z.string().min(1).max(100).optional(),
  rotation: z.union([z.literal(0), z.literal(90)]), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).superRefine((object, ctx) => {
  const model = getModelAsset(object.modelAssetId);
  if (model && model.kind !== object.kind)
    ctx.addIssue({ code: "custom", path: ["modelAssetId"], message: "Model asset does not match the installation kind." });
  if (object.modelAssetId && object.materialAssetId)
    ctx.addIssue({ code: "custom", path: ["materialAssetId"], message: "Models retain their original materials; choose a model or a surface material." });
});
export type DesignObject = z.infer<typeof DesignObjectSchema>;
export const ZoneSchema = z.object({
  id: z.string().min(1).max(100), label: z.string().max(100),
  purpose: z.enum(["exhibition", "experience", "lounge", "stage", "circulation", "operations", "booth", "other"]),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(100), depth: z.number().positive().max(100),
  rotation: z.union([z.literal(0), z.literal(90)]), assignable: z.boolean(),
});
export type SpaceZone = z.infer<typeof ZoneSchema>;
export const CeilingSchema = z.object({
  height: z.number().positive().max(30), status: z.enum(["estimated", "confirmed"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type SpaceCeiling = z.infer<typeof CeilingSchema>;
export const PlanLineSchema = z.object({
  id: z.string().min(1).max(100), a: PointSchema, b: PointSchema,
  kind: z.enum(["unknown", "wall", "dimension"]),
  origin: z.enum(["vector", "raster", "cad", "manual"]), confidence: z.number().min(0).max(1),
});
export const PlanDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  entrances: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(80), x: z.number().min(0).max(1), y: z.number().min(0).max(1), rotation: z.number().min(0).max(360) })).max(30).optional(),
  visualStyle: z.enum(["schematic", "exhibition"]).optional(),
  source: z.object({ name: z.string().max(255), format: z.enum(["pdf", "image", "dxf"]),
    page: z.number().int().positive(), pages: z.number().int().positive(),
    width: z.number().positive(), height: z.number().positive(),
    crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).optional() }),
  preview: z.string().max(12_000_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
  widthMeters: z.number().positive().max(10000).nullable(),
  heightMeters: z.number().positive().max(10000).nullable(), scaleConfirmed: z.boolean(),
  lines: z.array(PlanLineSchema).max(100000),
  texts: z.array(z.object({ id: z.string().max(100), text: z.string().max(2000),
    x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(20000),
  warnings: z.array(z.string().max(2000)).max(100), method: z.enum(["pdf-vector", "opencv", "dxf"]),
  floorBoundary: z.array(PointSchema).min(3).max(128).refine(isSimpleFootprint, "Floor outline must be a non-intersecting polygon with area.").optional(),
  walkStart: PointSchema.optional(),
  zones: z.array(ZoneSchema).max(200).optional(),
  ceiling: CeilingSchema.optional(),
  wallHeight: z.number().positive().max(30).optional(),
  objects: z.array(DesignObjectSchema).max(200).optional(),
}).superRefine((doc, ctx) => {
  if (new Set(doc.lines.map(line => line.id)).size !== doc.lines.length)
    ctx.addIssue({ code: "custom", message: "Line IDs must be unique", path: ["lines"] });
  for (const key of ["zones", "objects", "entrances"] as const) {
    const values = doc[key] ?? [];
    if (new Set(values.map(value => value.id)).size !== values.length)
      ctx.addIssue({ code: "custom", message: `${key} IDs must be unique`, path: [key] });
  }
  if (doc.scaleConfirmed && (!doc.widthMeters || !doc.heightMeters))
    ctx.addIssue({ code: "custom", message: "Confirm both dimensions before confirming scale", path: ["scaleConfirmed"] });
  if (doc.source.page > doc.source.pages)
    ctx.addIssue({ code: "custom", message: "Page is out of range", path: ["source", "page"] });
});
export type PlanDocument = z.infer<typeof PlanDocumentSchema>;
export type PlanLine = z.infer<typeof PlanLineSchema>;
