import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MATERIAL_ASSET_IDS, MODEL_ASSET_IDS, getMaterialAsset, getModelAsset, searchDesignAssets } from "@/lib/assets/catalog";

const root = resolve(import.meta.dirname, "../public");
const manifest = JSON.parse(readFileSync(join(root, "assets/cc0/manifest.json"), "utf8")) as {
  assets: { id: string; entrypoint?: string; files: { path: string }[] }[];
};

describe("bundled design asset catalog", () => {
  it("only exposes downloaded assets with safe known IDs", () => {
    expect([...MATERIAL_ASSET_IDS, ...MODEL_ASSET_IDS].sort()).toEqual(manifest.assets.map(asset => asset.id).sort());
    expect(searchDesignAssets({})).toHaveLength(manifest.assets.length);
    expect(getModelAsset("https://example.com/model.gltf")).toBeUndefined();
    expect(getMaterialAsset("../../secret")).toBeUndefined();
    expect(getModelAsset()).toBeUndefined();
  });

  it("finds assets in Korean and English without an exact phrase match", () => {
    expect(searchDesignAssets({ query: "라운지 의자", category: "furniture" })[0].id).toBe("modern_arm_chair_01");
    expect(searchDesignAssets({ query: "WHITE PLASTER", category: "material" }).map(asset => asset.id)).toContain("Plaster001");
    expect(searchDesignAssets({ query: "조명", category: "light" }).map(asset => asset.id)).toContain("modern_ceiling_lamp_01");
    expect(searchDesignAssets({ category: "material" })).toHaveLength(MATERIAL_ASSET_IDS.length);
    expect(searchDesignAssets({ query: "not-an-available-asset" })).toEqual([]);
  });

  it("finds modular exhibition walls separately from equipment and preserves earlier furniture", () => {
    expect(searchDesignAssets({ category: "partition" }).map(asset => asset.id)).toEqual(expect.arrayContaining(["gallery_wall", "movable_partition"]));
    expect(searchDesignAssets({ query: "가벽", category: "partition" }).every(asset => asset.kind === "partition")).toBe(true);
    expect(getModelAsset("gallery_wall")!.url).toMatch(/\.glb$/);
    expect(getModelAsset("gallery_wall")!.aiGenerated).toBe(true);
    expect(getModelAsset("floor_plan_board")!.kind).toBe("equipment");
    expect(getModelAsset("truss_horizontal")!.kind).toBe("equipment");
    expect(getModelAsset("modern_arm_chair_01")!.url).toMatch(/\.gltf$/);
    expect(searchDesignAssets({ category: "equipment" }).map(asset => asset.id)).toContain("truss_vertical");
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
      const bytes = readFileSync(file);
      let gltf;
      let binaryBytes: number | undefined;
      if (model.url.endsWith(".glb")) {
        expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
        expect(bytes.readUInt32LE(4)).toBe(2);
        expect(bytes.readUInt32LE(8)).toBe(bytes.length);
        expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
        const jsonEnd = 20 + bytes.readUInt32LE(12);
        gltf = JSON.parse(bytes.toString("utf8", 20, jsonEnd));
        expect(bytes.readUInt32LE(jsonEnd + 4)).toBe(0x004e4942);
        binaryBytes = bytes.readUInt32LE(jsonEnd);
        expect(jsonEnd + 8 + binaryBytes).toBe(bytes.length);
      } else {
        gltf = JSON.parse(bytes.toString("utf8"));
      }
      for (const ref of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) {
        if (ref.uri) {
          expect(ref.uri).not.toMatch(/^(?:https?:|\/|\.\.)/);
          expect(existsSync(join(dirname(file), ref.uri))).toBe(true);
        } else if (ref.byteLength !== undefined) {
          expect(binaryBytes).toBeDefined();
          expect(ref.byteLength).toBeLessThanOrEqual(binaryBytes!);
          expect(binaryBytes! - ref.byteLength).toBeLessThan(4);
        } else {
          expect(gltf.bufferViews[ref.bufferView]).toBeDefined();
        }
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
