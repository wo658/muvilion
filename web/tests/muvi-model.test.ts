import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Box3, Mesh, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MUVI_MOTIONS, MUVI_DESIGNER_MOTIONS } from "../lib/muvi/motions";

describe("shipped Muvi GLB", () => {
  it("loads offline with all usable, looping animation clips", async () => {
    const file = readFileSync(new URL("../public/mascot/muvi-v1.glb", import.meta.url));
    const model = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), "");
    expect(model.animations.map(clip => clip.name)).toEqual([...MUVI_MOTIONS]);
    expect(file.byteLength).toBeLessThan(900_000);
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
      if ((MUVI_DESIGNER_MOTIONS as readonly string[]).includes(clip.name)) {
        for (let step = 0; step <= 20; step++) {
          mixer.setTime(step / 20 * clip.duration);
          // Work gestures stay in place so callers can orient them beside any result.
          for (const name of ["FootL", "FootR"]) {
            const foot = model.scene.getObjectByName(name)!;
            expect(new Box3().setFromObject(foot, true).min.y).toBeGreaterThanOrEqual(-0.001);
            expect(Math.abs(foot.position.z)).toBeLessThan(0.35);
          }
          expect(Math.abs(model.scene.getObjectByName("Body")!.position.z)).toBeLessThan(0.35);
        }
      }
      if (clip.name === "arrange") {
        const contacts: Vector3[] = [];
        for (const phase of [0.275, 0.475, 0.735]) {
          mixer.setTime(phase * clip.duration);
          model.scene.updateMatrixWorld(true);
          const face = model.scene.getObjectByName("HammerFace")!;
          contacts.push(face.getWorldPosition(new Vector3()));
          const normal = new Vector3(0, 0, -1).applyQuaternion(face.getWorldQuaternion(new Quaternion()));
          expect(normal.z).toBeGreaterThan(0.9);
          expect(model.scene.getObjectByName("ImpactCore")!.scale.x).toBeGreaterThan(0.9);
        }
        for (const contact of contacts) expect(contact.distanceTo(contacts[0])).toBeLessThan(0.015);
        mixer.setTime(0.275 * clip.duration);
        const effect = model.scene.getObjectByName("HammerImpact")!;
        const anchor = effect.position.clone();
        const spark = model.scene.getObjectByName("ImpactSpark0")!;
        const initialRadius = spark.position.length();
        mixer.setTime(0.30 * clip.duration);
        expect(effect.position.distanceTo(anchor)).toBeLessThan(0.0001);
        expect(spark.position.length()).toBeGreaterThan(initialRadius);
        mixer.setTime(0.40 * clip.duration);
        expect(effect.scale.x).toBe(0);
      }
      expect(model.scene.getObjectByName("PaintBrush")!.scale.x).toBe(clip.name === "paint" ? 1 : 0);
      expect(model.scene.getObjectByName("Hammer")!.scale.x).toBe(clip.name === "arrange" ? 1 : 0);
      expect(model.scene.getObjectByName("TapeCase")!.scale.x).toBe(clip.name === "measure" ? 1 : 0);
      // Generic work clips carry no staged result objects into a real drawing space.
      for (const name of ["Desk", "Pencil", "Tape", "Partition", "Roller", "Swatch"]) {
        expect(model.scene.getObjectByName(name)).toBeUndefined();
      }
    }
    mixer.stopAllAction();
  });
});
