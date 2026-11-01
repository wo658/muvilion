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
  view: z.enum(["overview", "detail", "interior"]).default("interior").describe("Use visitor eye-level interior by default. Overview/detail are elevated compositions for an explicit aerial or object-study request."),
  framing: z.enum(["subjects", "venue"]).default("subjects").describe("subjects frames the selected targets, or installed objects when none are selected; venue with no target IDs explicitly frames the whole venue."),
  azimuth: z.number().min(0).max(360).describe("Camera direction around the target in degrees: 0 is positive X; 90 is positive Z."),
  elevation: z.number().min(15).max(75).describe("Downward viewing angle for overview/detail. Interior stays at eye height."),
  distanceScale: z.number().min(0.25).max(2).describe("For interior views, reduce toward 0.25–0.5 to approach small subjects along a clear aisle; increase to show more context. Elevated views preserve their subject-fitting margin."),
});
export type PhotoIntent = z.infer<typeof PhotoIntentSchema>;
export const PhotoCandidateSchema = z.object({ shot: PhotoShotSchema, image: z.string().max(2_000_000).regex(/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/) });
const Common = { document: PlanDocumentSchema, locale: z.enum(["en", "ko"]).default("en") };
export const PhotographyRequestSchema = z.discriminatedUnion("phase", [
  z.object({ ...Common, phase: z.literal("plan"), brief: z.string().trim().min(1).max(6000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) })).max(24).default([]) }),
  z.object({ ...Common, phase: z.literal("review"), brief: z.string().trim().max(6000).default(""), intent: PhotoIntentSchema, candidates: z.array(PhotoCandidateSchema).min(1).max(4), round: z.number().int().min(0).max(MAX_PHOTO_ROUNDS - 1), previousReviews: z.array(z.object({intent: PhotoIntentSchema, explanation: z.string().max(1500)})).max(MAX_PHOTO_ROUNDS - 1).default([]) }),
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
  return new Set(intent.targetIds).size === intent.targetIds.length && intent.targetIds.every(id => ids.has(id)) && (intent.view !== "detail" || intent.targetIds.length > 0);
}

type Point3 = PhotoShot["target"];

function subjectCorners(item: PhotographyTarget, width: number, depth: number): Point3[] {
  const w = item.width ?? 1.5, d = item.depth ?? 1.5;
  const bottom = item.elevation ?? 0, top = bottom + (item.height ?? 0);
  const rotation = item.rotation * Math.PI / 180;
  return [-w / 2, w / 2].flatMap(x => [-d / 2, d / 2].flatMap(z => [bottom, top].map(y => [
    (item.x - .5) * width + x * Math.cos(rotation) - z * Math.sin(rotation), y,
    (item.y - .5) * depth + x * Math.sin(rotation) + z * Math.cos(rotation),
  ] as Point3)));
}

/** Full footprint containment avoids pulling a neighbouring oversized structure into a small zone shot. */
function containedInZone(item: PhotographyTarget, zone: NonNullable<PlanDocument["zones"]>[number], width: number, depth: number): boolean {
  const angle = zone.rotation * Math.PI / 180;
  const centerX = (zone.x - .5) * width, centerZ = (zone.y - .5) * depth;
  return subjectCorners(item, width, depth).every(point => {
    const x = point[0] - centerX, z = point[2] - centerZ;
    return Math.abs(x * Math.cos(angle) + z * Math.sin(angle)) <= zone.width / 2 + 1e-6
      && Math.abs(-x * Math.sin(angle) + z * Math.cos(angle)) <= zone.depth / 2 + 1e-6;
  });
}

/** Solve each perspective frustum plane for distance along this specific viewing direction. */
function fittingDistance(points: Point3[], target: Point3, azimuth: number, elevation: number): number {
  const cosA = Math.cos(azimuth), sinA = Math.sin(azimuth), cosE = Math.cos(elevation), sinE = Math.sin(elevation);
  const tanV = Math.tan(20 * Math.PI / 180), tanH = tanV * 16 / 9;
  return Math.max(.5, ...points.map(point => {
    const x = point[0] - target[0], y = point[1] - target[1], z = point[2] - target[2];
    const towardEye = x * cosA * cosE + y * sinE + z * sinA * cosE;
    const horizontal = x * sinA - z * cosA;
    const vertical = -x * cosA * sinE + y * cosE - z * sinA * sinE;
    return towardEye + Math.max(Math.abs(horizontal) / tanH, Math.abs(vertical) / tanV);
  }));
}

/** Nearby real visitor areas may refine a requested position, never override its direction. */
function visitorPositionHints(document: PlanDocument, desired: {x:number;y:number}, target: Point3) {
  const width = document.widthMeters!, depth = document.heightMeters!;
  const hints: {x:number;y:number}[] = [];
  const clamp = (value:number, low:number, high:number) => Math.max(low, Math.min(high, value));
  for (const zone of document.zones ?? []) {
    if (zone.purpose !== "circulation") continue;
    const w = zone.rotation === 90 ? zone.depth : zone.width, d = zone.rotation === 90 ? zone.width : zone.depth;
    if (w < .6 || d < .6) continue;
    hints.push({x:clamp(desired.x,zone.x*width-w/2+.3,zone.x*width+w/2-.3),y:clamp(desired.y,zone.y*depth-d/2+.3,zone.y*depth+d/2-.3)});
  }
  for (const entrance of document.entrances ?? []) {
    const x=entrance.x*width,y=entrance.y*depth,dx=target[0]+width/2-x,dy=target[2]+depth/2-y,length=Math.hypot(dx,dy);
    if (length > 1) hints.push({x:x+dx/length*.75,y:y+dy/length*.75});
  }
  // A small adjustment retains useful azimuth/distance control during image review.
  return hints.filter(point=>Math.hypot(point.x-desired.x,point.y-desired.y)<=1.25)
    .sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y));
}

/** These candidates frame geometry, not visibility: the model must inspect the actual rendered images for occlusion. */
export function generatePhotoCandidates(document: PlanDocument, intent: PhotoIntent, round = 0): PhotoShot[] {
  if (!document.scaleConfirmed || !document.widthMeters || !document.heightMeters || !validPhotoTargets(document, intent)) return [];
  const width = document.widthMeters, depth = document.heightMeters;
  // A named zone or collection remains authoritative. Only an untargeted overview defaults to installations.
  const targets = intent.targetIds.length
    ? photographyTargets(document).filter(item => intent.targetIds.includes(item.id))
    : intent.framing === "venue" ? [] : document.objects ?? [];
  const selectedZones = (document.zones ?? []).filter(zone => intent.targetIds.includes(zone.id));
  const zoneContents = (document.objects ?? []).filter(object => selectedZones.some(zone =>
    object.zoneId === zone.id || containedInZone(object, zone, width, depth)));
  // Keep the named footprint while also fitting the real height of its installations.
  const framedTargets = [...new Map([...targets, ...zoneContents].map(item => [item.id, item])).values()];
  const points: Point3[] = framedTargets.length ? framedTargets.flatMap(item => subjectCorners(item, width, depth))
    : [-width / 2, width / 2].flatMap(x => [-depth / 2, depth / 2].flatMap(z => [0, document.wallHeight ?? 3].map(y => [x, y, z] as Point3)));
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  const minZ = Math.min(...points.map(p => p[2])), maxZ = Math.max(...points.map(p => p[2]));
  const target: Point3 = [(minX + maxX) / 2, intent.view === "interior" ? EYE_HEIGHT : (minY + maxY) / 2, (minZ + maxZ) / 2];
  const world = navigationWorld(document);
  const visitorDistance = Math.max(3, Math.min(12, Math.max(maxX - minX, maxZ - minZ) * .9));
  const candidates: PhotoShot[] = [];
  const variations = [
    { angle: 0, elevation: 0, distance: 1.08 }, { angle: 35, elevation: 12, distance: 1.14 },
    { angle: -35, elevation: -10, distance: 1.04 }, { angle: 180, elevation: 20, distance: 1.1 },
    { angle: 90, elevation: 0, distance: 1.08 }, { angle: -90, elevation: 12, distance: 1.14 },
    { angle: 135, elevation: -10, distance: 1.04 }, { angle: -135, elevation: 20, distance: 1.1 },
  ];
  for (const variation of variations) {
    const angle = (intent.azimuth + variation.angle) * Math.PI / 180;
    const elevation = Math.max(15, Math.min(75, intent.elevation + variation.elevation)) * Math.PI / 180;
    // distanceScale changes context without cropping required subjects out of elevated views.
    const distance = intent.view === "interior" ? visitorDistance * variation.distance * intent.distanceScale
      : fittingDistance(points, target, angle, elevation) * Math.max(1.04, variation.distance * intent.distanceScale);
    let eye: PhotoShot["eye"];
    if (intent.view === "interior") {
      if (!world) return [];
      // A person sees a local part of the space; fitting the entire venue would put
      // the camera outside it. Nearby aisle/entrance positions are preferences only.
      const desired = {x: target[0] + Math.cos(angle) * distance + width / 2, y: target[2] + Math.sin(angle) * distance + depth / 2};
      const hints = visitorPositionHints(document, desired, target);
      const points = [...hints, ...[1, .8, 1.2, .6, 1.5, .4].map(factor => ({ x: target[0] + Math.cos(angle) * distance * factor + width / 2, y: target[2] + Math.sin(angle) * distance * factor + depth / 2 }))];
      const point = points.find(point => Math.hypot(point.x-width/2-target[0],point.y-depth/2-target[2]) >= .75 && canStand(point, world)
        && !candidates.some(shot => Math.hypot(shot.eye[0]+width/2-point.x,shot.eye[2]+depth/2-point.y)<.2));
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
    candidates.push({ id: `photo-${round}-${candidates.length + 1}`, eye, target, fov: intent.view === "interior" ? 60 : 40, zoom: 1, aspect: 16 / 9, cutaway: intent.view !== "interior", ceilingMode: intent.view === "interior" ? "solid" : "hidden", showStructure: true, showOverhead: true });
    if (candidates.length === 4) break;
  }
  return candidates;
}
