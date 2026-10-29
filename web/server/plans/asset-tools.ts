import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { ASSET_CATEGORIES, searchDesignAssets } from "@/lib/assets/catalog";

const PARTITION_GUIDANCE = "For booth layouts, arrange wall modules as separate partition objects around a booth zone and leave an entrance. Each module is not a complete booth. Dimensions are model bounds only; do not claim structural stability, rigging or safety validation.";

export const assetTools = {
  search_design_assets: tool({
    description: "Search locally bundled CC0 materials, furniture, partitions, equipment and lights. Read-only: returns valid asset IDs, uses and model bounds; never downloads or edits the plan. Use an empty query and category all to list the available assets.",
    inputSchema: z.object({
      query: z.string().trim().max(120).default("").describe("Korean or English keywords; empty lists the selected category."),
      category: z.enum(ASSET_CATEGORIES).default("all"),
    }),
    execute: async input => ({
      assets: searchDesignAssets(input),
      license: "CC0-1.0",
      partitionGuidance: PARTITION_GUIDANCE,
      scope: "Local bundled assets only. Model dimensions are file bounds in metres, not surveyed product measurements. Materials apply to object surfaces, not the floor or ceiling. Lights are visual fixtures, not verified illumination or rigging.",
    }),
  }),
};

export const ASSET_INSTRUCTIONS = `<design_assets>
Use search_design_assets to discover bundled materials, furniture, partitions, equipment and lights before suggesting asset IDs. If a search is empty, try an empty query; do not invent IDs or external URLs.
For a 3D model set modelAssetId and its matching kind from the result. Prefer the returned file-bound width/depth/height unless the brief requests a different size; these are visual model dimensions, not confirmed product measurements. The renderer fits uniformly inside the object's dimensions, which remain the collision envelope. Assets marked aiGenerated are generated concept models, not verified manufactured products.
${PARTITION_GUIDANCE} Use the partition kind for wall modules, not booth; a booth zone reserves the footprint without making it a solid box. Truss equipment models are visual references, not evidence of load capacity or a validated support structure.
For a schematic object's finish set materialAssetId; models keep their original materials so never combine both IDs. This tool cannot finish the existing floor, walls or ceiling. If requested, explain the limitation rather than pretending to apply it.
Preserve asset IDs on unchanged objects. A light model is a visual fixture, not an actual lighting simulation. No tool mutates the workspace: design proposals still require the user's Apply.
</design_assets>`;
