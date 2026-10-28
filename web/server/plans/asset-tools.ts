import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { searchDesignAssets } from "@/lib/assets/catalog";

export const assetTools = {
  search_design_assets: tool({
    description: "Search the locally bundled CC0 materials, furniture and lights. Read-only: returns valid asset IDs, uses and model bounds; never downloads or edits the plan. Use an empty query and category all to list all 12 assets.",
    inputSchema: z.object({
      query: z.string().trim().max(120).default("").describe("Korean or English keywords; empty lists the selected category."),
      category: z.enum(["all", "material", "furniture", "light"]).default("all"),
    }),
    execute: async input => ({
      assets: searchDesignAssets(input),
      license: "CC0-1.0",
      scope: "Local bundled assets only. Model dimensions are file bounds in metres, not surveyed product measurements. Materials apply to object surfaces, not the floor or ceiling. Lights are visual fixtures, not verified illumination or rigging.",
    }),
  }),
};

export const ASSET_INSTRUCTIONS = `<design_assets>
Use search_design_assets to discover bundled materials, furniture and lights before suggesting asset IDs. If a search is empty, try an empty query; do not invent IDs or external URLs.
For a 3D model set modelAssetId and its matching kind (furniture or light). Prefer the returned file-bound width/depth/height unless the brief requests a different size; these are visual model dimensions, not confirmed product measurements. The renderer fits uniformly inside the object's dimensions, which remain the collision envelope.
For a schematic object's finish set materialAssetId; models keep their original materials so never combine both IDs. This tool cannot finish the existing floor, walls or ceiling. If requested, explain the limitation rather than pretending to apply it.
Preserve asset IDs on unchanged objects. A light model is a visual fixture, not an actual lighting simulation. No tool mutates the workspace: design proposals still require the user's Apply.
</design_assets>`;
