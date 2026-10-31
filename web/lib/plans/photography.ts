import { z } from "zod";
import { PlanDocumentSchema, type PlanDocument } from "./schema";
import { navigationWorld } from "./camera";
import { canStand, EYE_HEIGHT } from "./walk";

export const MAX_PHOTO_ROUNDS = 3;
const Vector = z.tuple([z.number().finite().min(-50000).max(50000), z.number().finite().min(-50000).max(50000), z.number().finite().min(-50000).max(50000)]);
export const PhotoShotSchema = z.object({
  id: z.string().min(1).max(100), eye: Vector, target: Vector,
  fov: z.number().min(20).max(80), zoom: z.number().min(0.5).max(3).default(1),
  aspect: z.literal(16 / 9), cutaway: z.boolean(), ceilingMode: z.enum(["hidden", "solid", "transparent"]),
  showStructure: z.boolean(), showOverhead: z.boolean(),
}).refine(shot => Math.hypot(...shot.eye.map((value, i) => value - shot.target[i])) > 0.01, "Camera must look toward a distinct point.");
export type PhotoShot = z.infer<typeof PhotoShotSchema>;
export const PhotoIntentSchema = z.object({
  title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(1500),
  targetIds: z.array(z.string().min(1).max(100)).max(8),
  view: z.enum(["overview", "detail", "interior"]),
  azimuth: z.number().min(0).max(360).describe("Camera direction around the target in degrees: 0 is positive X; 90 is positive Z."),
  elevation: z.number().min(15).max(75).describe("Downward viewing angle for overview/detail. Interior stays at eye height."),
  distanceScale: z.number().min(0.75).max(2).describe("Increase to show more surrounding context."),
});
export type PhotoIntent = z.infer<typeof PhotoIntentSchema>;
export const PhotoCandidateSchema = z.object({ shot: PhotoShotSchema, image: z.string().max(2_000_000).regex(/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/) });
const Common = { document: PlanDocumentSchema, locale: z.enum(["en", "ko"]).default("en") };
export const PhotographyRequestSchema = z.discriminatedUnion("phase", [
  z.object({ ...Common, phase: z.literal("plan"), brief: z.string().trim().min(1).max(6000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) })).max(24).default([]) }),
  z.object({ ...Common, phase: z.literal("review"), intent: PhotoIntentSchema, candidates: z.array(PhotoCandidateSchema).min(1).max(4), round: z.number().int().min(0).max(MAX_PHOTO_ROUNDS - 1) }),
]);
export type PhotographyRequest = z.infer<typeof PhotographyRequestSchema>;
export const PhotographyPlanSchema = z.object({ intent: PhotoIntentSchema, candidates: z.array(PhotoShotSchema).min(1).max(4) });
export const PhotographyReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select"), shotId: z.string().min(1).max(100), explanation: z.string().min(1).max(1500) }),
  z.object({ action: z.literal("revise"), intent: PhotoIntentSchema, candidates: z.array(PhotoShotSchema).min(1).max(4), explanation: z.string().min(1).max(1500) }),
]);

export type PhotographyTarget = { id: string; label: string; x: number; y: number; rotation: number; width?: number; depth?: number; height?: number; elevation?: number };
export function photographyTargets(document: PlanDocument): PhotographyTarget[] {
  return [...(document.objects ?? []), ...(document.zones ?? []), ...(document.entrances ?? [])];
}
export function validPhotoTargets(document: PlanDocument, intent: PhotoIntent): boolean {
  const ids = new Set(photographyTargets(document).map(item => item.id));
  return new Set(intent.targetIds).size === intent.targetIds.length && intent.targetIds.every(id => ids.has(id)) && (intent.view === "overview" || intent.targetIds.length > 0);
}

/** Geometric candidates are illustrative viewpoints; the model must inspect their rendered images. */
export function generatePhotoCandidates(document: PlanDocument, intent: PhotoIntent, round = 0): PhotoShot[] {
  if (!document.scaleConfirmed || !document.widthMeters || !document.heightMeters || !validPhotoTargets(document, intent)) return [];
  const width = document.widthMeters, depth = document.heightMeters;
  const targets = photographyTargets(document).filter(item => intent.targetIds.includes(item.id));
  const bounds = targets.map(item => {
    const w = item.width && item.depth ? (item.rotation % 180 === 90 ? item.depth : item.width) : 1.5;
    const d = item.width && item.depth ? (item.rotation % 180 === 90 ? item.width : item.depth) : 1.5;
    const h = item.height ? item.height + (item.elevation ?? 0) : 0;
    return { x: (item.x - .5) * width, z: (item.y - .5) * depth, w, d, h };
  });
  const minX = bounds.length ? Math.min(...bounds.map(b => b.x - b.w / 2)) : -width / 2;
  const maxX = bounds.length ? Math.max(...bounds.map(b => b.x + b.w / 2)) : width / 2;
  const minZ = bounds.length ? Math.min(...bounds.map(b => b.z - b.d / 2)) : -depth / 2;
  const maxZ = bounds.length ? Math.max(...bounds.map(b => b.z + b.d / 2)) : depth / 2;
  const height = bounds.length ? Math.max(...bounds.map(b => b.h)) : (document.wallHeight ?? 3);
  const target: PhotoShot["target"] = [(minX + maxX) / 2, intent.view === "interior" ? Math.min(EYE_HEIGHT, Math.max(.8, height / 2)) : height / 2, (minZ + maxZ) / 2];
  const radius = Math.max(1, Math.hypot(maxX - minX, maxZ - minZ, height) / 2);
  const distance = (radius + .5) / Math.sin(20 * Math.PI / 180) * intent.distanceScale;
  const world = navigationWorld(document);
  const candidates: PhotoShot[] = [];
  for (const offset of [0, 35, -35, 180, 90, -90, 135, -135]) {
    const angle = (intent.azimuth + offset) * Math.PI / 180;
    const elevation = intent.elevation * Math.PI / 180;
    let eye: PhotoShot["eye"];
    if (intent.view === "interior") {
      if (!world) return [];
      // Try a modest range of distances without moving the target or inventing a clear view.
      const point = [1, .7, .45].map(factor => ({ x: target[0] + Math.cos(angle) * distance * factor + width / 2, y: target[2] + Math.sin(angle) * distance * factor + depth / 2 })).find(point => canStand(point, world));
      if (!point) continue;
      eye = [point.x - width / 2, EYE_HEIGHT, point.y - depth / 2];
    } else {
      eye = [target[0] + Math.cos(angle) * Math.cos(elevation) * distance, target[1] + Math.sin(elevation) * distance, target[2] + Math.sin(angle) * Math.cos(elevation) * distance];
      // Elevated shots may be outside the venue, but never inside an installation or an existing wall.
      const blockedObject = (document.objects ?? []).some(object => {
        if (eye[1] < (object.elevation ?? 0) - .2 || eye[1] > (object.elevation ?? 0) + object.height + .2) return false;
        const w = object.rotation % 180 === 90 ? object.depth : object.width, d = object.rotation % 180 === 90 ? object.width : object.depth;
        return Math.abs(eye[0] - (object.x - .5) * width) < w / 2 + .2 && Math.abs(eye[2] - (object.y - .5) * depth) < d / 2 + .2;
      });
      if (blockedObject) continue;
      if (eye[1] < (document.wallHeight ?? 3) && world && !canStand({x:eye[0]+width/2,y:eye[2]+depth/2}, {...world, objects:[], boundary:undefined, ceilingHeight:undefined}, .2)) continue;
    }
    candidates.push({ id: `photo-${round}-${candidates.length + 1}`, eye, target, fov: 40, zoom: 1, aspect: 16 / 9, cutaway: intent.view !== "interior", ceilingMode: intent.view === "interior" && document.ceiling ? "solid" : "hidden", showStructure: true, showOverhead: true });
    if (candidates.length === 4) break;
  }
  return candidates;
}
