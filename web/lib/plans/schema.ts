import { z } from "zod";
import { isSimpleFootprint } from "./footprint";

const PointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export const DesignObjectSchema = z.object({
  id: z.string().min(1).max(100), kind: z.enum(["booth", "stage", "lounge"]), label: z.string().max(100),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(100), depth: z.number().positive().max(100), height: z.number().positive().max(30),
  rotation: z.union([z.literal(0), z.literal(90)]), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type DesignObject = z.infer<typeof DesignObjectSchema>;
export const PlanLineSchema = z.object({
  id: z.string().min(1).max(100), a: PointSchema, b: PointSchema,
  kind: z.enum(["unknown", "wall", "dimension"]),
  origin: z.enum(["vector", "raster", "cad", "manual"]), confidence: z.number().min(0).max(1),
});
export const PlanDocumentSchema = z.object({
  schemaVersion: z.literal(1),
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
  objects: z.array(DesignObjectSchema).max(200).optional(),
}).superRefine((doc, ctx) => {
  if (new Set(doc.lines.map(line => line.id)).size !== doc.lines.length)
    ctx.addIssue({ code: "custom", message: "Line IDs must be unique", path: ["lines"] });
  if (doc.scaleConfirmed && (!doc.widthMeters || !doc.heightMeters))
    ctx.addIssue({ code: "custom", message: "Confirm both dimensions before confirming scale", path: ["scaleConfirmed"] });
  if (doc.source.page > doc.source.pages)
    ctx.addIssue({ code: "custom", message: "Page is out of range", path: ["source", "page"] });
});
export type PlanDocument = z.infer<typeof PlanDocumentSchema>;
export type PlanLine = z.infer<typeof PlanLineSchema>;
