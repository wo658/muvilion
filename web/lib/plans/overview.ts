import type { DesignObject } from "./schema";
import { TOKENS } from "@/lib/ui/tokens";
export const VENUE_COLORS = { existing: TOKENS.venueExisting, partition: TOKENS.venuePartition, entrance: TOKENS.venueEntrance, cap: TOKENS.venueCap };
/** Returns a catalog key; translate it at render time. */
export function partitionLabel(object: DesignObject) {
  return object.provenance === "ai" ? "AI-proposed partition" as const : "Planned partition" as const;
}
