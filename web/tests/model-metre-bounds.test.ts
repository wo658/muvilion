import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MODEL_ASSET_IDS, getModelAsset } from "@/lib/assets/catalog";
import { fitAssetBounds } from "@/lib/assets/fit";

type GeometryDocument = {
  buffers: { uri?: string; byteLength: number }[];
  meshes: { primitives: { material?: number }[] }[];
  materials?: unknown; textures?: unknown; images?: unknown;
};
if (!globalThis.ProgressEvent) vi.stubGlobal("ProgressEvent", class extends Event {});
afterAll(() => vi.unstubAllGlobals());

describe("bundled model physical extents", () => {
  it.each(MODEL_ASSET_IDS)("%s uses transformed file geometry matching the metre catalog and renderer", async id => {
    const asset = getModelAsset(id)!, file = join(process.cwd(), "public", asset.url);
    const bytes = readFileSync(file);
    let gltf: GeometryDocument, binary: Buffer | undefined;
    if (file.endsWith(".glb")) {
      const jsonEnd = 20 + bytes.readUInt32LE(12);
      gltf = JSON.parse(bytes.toString("utf8", 20, jsonEnd));
      binary = bytes.subarray(jsonEnd + 8);
    } else gltf = JSON.parse(bytes.toString("utf8"));
    // Geometry-only test: retain exact vertices and node transforms; no image/browser dependency.
    for (const buffer of gltf.buffers) buffer.uri = `data:application/octet-stream;base64,${(buffer.uri ? readFileSync(join(dirname(file), buffer.uri)) : binary!).toString("base64")}`;
    delete gltf.images; delete gltf.textures; delete gltf.materials;
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) delete primitive.material;
    const { scene } = await new GLTFLoader().parseAsync(JSON.stringify(gltf), "");
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene, true), size = bounds.getSize(new Vector3());
    expect(size.toArray()).toEqual([expect.closeTo(asset.width, 3), expect.closeTo(asset.height, 3), expect.closeTo(asset.depth, 3)]);
    const fit = fitAssetBounds(bounds.min.toArray(), bounds.max.toArray(), [asset.width, asset.height, asset.depth]);
    expect(size.x * fit.scale[0]).toBeCloseTo(asset.width, 8);
    expect(size.y * fit.scale[1]).toBeCloseTo(asset.height, 8);
    expect(size.z * fit.scale[2]).toBeCloseTo(asset.depth, 8);
  });
});
