import { getModelAsset } from "./catalog";
import { FIXTURES } from "./fixtures";
import type { DesignObject } from "@/lib/plans/schema";

/** Round-off only. Never turn a changed aspect ratio into a miniature model. */
export const DIMENSION_TOLERANCE_METRES = 0.005;
export function canonicalDimensions(object: DesignObject) {
  return object.fixtureType ? FIXTURES[object.fixtureType] : getModelAsset(object.modelAssetId);
}
export function dimensionsMatch(object: DesignObject) {
  const basis = canonicalDimensions(object);
  return !basis || (["width", "depth", "height"] as const).every(key => Math.abs(object[key] - basis[key]) <= DIMENSION_TOLERANCE_METRES);
}
export function resolvePhysicalDimensions(object: DesignObject): DesignObject {
  const basis = canonicalDimensions(object);
  if (!basis) return object;
  if (!dimensionsMatch(object)) throw new Error(`${object.id}: use native dimensions width=${basis.width}, depth=${basis.depth}, height=${basis.height} metres. Rotate with rotation=90; never swap width/depth. Use separate modules or schematic geometry for another size.`);
  return { ...object, width: basis.width, depth: basis.depth, height: basis.height };
}
