import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MATERIAL_ASSET_IDS, MODEL_ASSET_IDS, getMaterialAsset, getModelAsset, searchDesignAssets } from "@/lib/assets/catalog";

const root = resolve(import.meta.dirname, "../public");
const manifest = JSON.parse(readFileSync(join(root, "assets/cc0/manifest.json"), "utf8")) as {
  assets: { id: string; entrypoint?: string; files: { path: string }[] }[];
};

describe("bundled design asset catalog", () => {
  it("only exposes the twelve downloaded assets with safe known IDs", () => {
    expect([...MATERIAL_ASSET_IDS, ...MODEL_ASSET_IDS].sort()).toEqual(manifest.assets.map(asset => asset.id).sort());
    expect(searchDesignAssets({})).toHaveLength(12);
    expect(getModelAsset("https://example.com/model.gltf")).toBeUndefined();
    expect(getMaterialAsset("../../secret")).toBeUndefined();
    expect(getModelAsset()).toBeUndefined();
  });

  it("finds assets in Korean and English without an exact phrase match", () => {
    expect(searchDesignAssets({ query: "라운지 의자", category: "furniture" })[0].id).toBe("modern_arm_chair_01");
    expect(searchDesignAssets({ query: "WHITE PLASTER", category: "material" }).map(asset => asset.id)).toContain("Plaster001");
    expect(searchDesignAssets({ query: "조명", category: "light" })).toHaveLength(3);
    expect(searchDesignAssets({ category: "material" })).toHaveLength(6);
    expect(searchDesignAssets({ query: "not-an-available-asset" })).toEqual([]);
  });

  it("resolves material maps to files recorded in the provenance manifest", () => {
    for (const id of MATERIAL_ASSET_IDS) {
      const material = getMaterialAsset(id)!;
      const files = manifest.assets.find(asset => asset.id === id)!.files;
      for (const url of Object.values(material.maps)) {
        expect(files.some(file => `/assets/cc0/${file.path}` === url)).toBe(true);
        expect(existsSync(join(root, url))).toBe(true);
      }
    }
    expect(getMaterialAsset("Metal036")!.maps.metalness).toBeDefined();
    expect(getMaterialAsset("Wood051")!.maps.metalness).toBeUndefined();
  });

  it("resolves complete local glTF packages and identifies mesh dimensions as asset bounds", () => {
    for (const id of MODEL_ASSET_IDS) {
      const model = getModelAsset(id)!;
      expect(model.url).toBe(`/assets/cc0/${manifest.assets.find(asset => asset.id === id)!.entrypoint}`);
      const file = join(root, model.url);
      const gltf = JSON.parse(readFileSync(file, "utf8"));
      for (const ref of [...gltf.buffers, ...gltf.images]) {
        expect(ref.uri).not.toMatch(/^(?:https?:|\/|\.\.)/);
        expect(existsSync(join(dirname(file), ref.uri))).toBe(true);
      }
      expect(model.width).toBeGreaterThan(0);
      expect(model.depth).toBeGreaterThan(0);
      expect(model.height).toBeGreaterThan(0);
      expect(model.dimensionSource).toBe("gltf-scene-bounds");
    }
    // Source is a set of fixtures, not a single luminaire or chair.
    expect(getModelAsset("modular_street_seating")!.description).toContain("세트");
    expect(getModelAsset("mounted_fluorescent_lights")!.description).toContain("세트");
    expect(getModelAsset("modern_coffee_table_01")!.depth).toBeCloseTo(1.20183, 5);
  });
});
