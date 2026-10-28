import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Box3, Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MUVI_MOTIONS } from "../lib/muvi/motions";

describe("shipped Muvi GLB", () => {
  it("loads offline with all eight usable, looping animation clips", async () => {
    const file = readFileSync(new URL("../public/mascot/muvi-v1.glb", import.meta.url));
    const model = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), "");
    expect(model.animations.map(clip => clip.name)).toEqual([...MUVI_MOTIONS]);
    expect(file.byteLength).toBeLessThan(500_000);
    const bounds = new Box3().setFromObject(model.scene);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeGreaterThan(2);
    model.scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      expect([...node.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
    });
    const mixer = new AnimationMixer(model.scene);
    for (const clip of model.animations) {
      expect(clip.validate()).toBe(true);
      for (const track of clip.tracks) {
        const size = track.getValueSize();
        expect(model.scene.getObjectByName(track.name.split(".")[0])).toBeDefined();
        for (let i = 0; i < size; i++) expect(track.values[i]).toBeCloseTo(track.values[track.values.length - size + i], 5);
      }
      mixer.stopAllAction(); mixer.clipAction(clip).play(); mixer.update(clip.duration / 4);
      expect(new Box3().setFromObject(model.scene).isEmpty()).toBe(false);
    }
    mixer.stopAllAction();
  });
});
