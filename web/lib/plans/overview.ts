import type { DesignObject } from "./schema";
export const VENUE_COLORS = { existing: "#a5afb8", partition: "#82b9df", entrance: "#17876f", cap: "#657582" };
/** Display-only cutaway: never rewrite physical dimensions or navigation obstacles. */
export function displayWallHeight(height: number, cutaway: boolean, interior: boolean) {
  return cutaway && !interior ? Math.min(height, 1.1) : height;
}
export function partitionLabel(object: DesignObject) {
  return object.provenance === "ai" ? "AI 제안 가벽" : "계획 가벽";
}
