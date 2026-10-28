/** Original Muvi geometry and reusable rigid-part animation rig. No external assets. */
import { mkdir, writeFile } from "node:fs/promises";
import { AnimationClip, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry, Shape, Vector3, QuadraticBezierCurve3, TubeGeometry, Quaternion, Euler, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { MUVI_MOTIONS, type MuviMotion } from "../lib/muvi/motions";

// GLTFExporter only needs FileReader's asynchronous binary path for this texture-free model.
class BinaryReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
}
Object.defineProperty(globalThis, "FileReader", { value: BinaryReader, configurable: true });

const skin = new MeshStandardMaterial({ color: "#b8b9ef", roughness: 0.72 });
const ink = new MeshStandardMaterial({ color: "#25283e", roughness: 0.32 });
const blush = new MeshStandardMaterial({ color: "#ffc5ab", roughness: 0.85 });
const shine = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
const sphere = new SphereGeometry(1, 24, 16);
const model = new Group(); model.name = "Muvi";
const body = new Group(); body.name = "Body"; model.add(body);
function oval(parent: Group, name: string, position: number[], scale: number[], material = skin) {
  const mesh = new Mesh(sphere, material); mesh.name = name;
  mesh.position.set(...position as [number, number, number]); mesh.scale.set(...scale as [number, number, number]);
  parent.add(mesh); return mesh;
}

// A continuous rounded M-shaped pillow, not a pair of intersecting ear spheres.
const outline = new Shape();
outline.moveTo(0, 1.78);
outline.bezierCurveTo(-0.14, 1.90, -0.29, 2.18, -0.49, 2.07);
outline.bezierCurveTo(-0.78, 1.98, -0.88, 1.56, -0.84, 1.19);
outline.bezierCurveTo(-0.81, 0.88, -0.66, 0.86, -0.63, 0.64);
outline.bezierCurveTo(-0.65, 0.31, -0.38, 0.27, 0, 0.27);
outline.bezierCurveTo(0.38, 0.27, 0.65, 0.31, 0.63, 0.64);
outline.bezierCurveTo(0.66, 0.86, 0.81, 0.88, 0.84, 1.19);
outline.bezierCurveTo(0.88, 1.56, 0.78, 1.98, 0.49, 2.07);
outline.bezierCurveTo(0.29, 2.18, 0.14, 1.90, 0, 1.78);
const perimeter = outline.getSpacedPoints(96).slice(0, -1);
const positions: number[] = [], indices: number[] = [];
const rings = 32, count = perimeter.length;
for (let ring = 0; ring <= rings; ring++) {
  const angle = Math.PI * ring / rings;
  const radial = Math.sin(angle), z = 0.53 * Math.cos(angle);
  for (const p of perimeter) positions.push(p.x * radial, 1.18 + (p.y - 1.18) * radial, z);
}
for (let ring = 0; ring < rings; ring++) for (let i = 0; i < count; i++) {
  const a = ring * count + i, b = ring * count + (i + 1) % count, c = a + count, d = b + count;
  indices.push(a, c, b, b, c, d);
}
const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
const shell = new Mesh(geometry, skin); shell.name = "Silhouette"; body.add(shell);
for (const side of [-1, 1]) {
  const eye = new Group(); eye.name = side < 0 ? "EyeL" : "EyeR"; eye.position.set(side * 0.29, 1.27, 0.505); body.add(eye);
  oval(eye, `${eye.name}Surface`, [0, 0, 0], [0.092, 0.125, 0.045], ink);
  oval(eye, `${eye.name}Highlight`, [-0.023, 0.045, 0.041], [0.022, 0.028, 0.009], shine);
  oval(body, side < 0 ? "CheekL" : "CheekR", [side * 0.47, 1.06, 0.454], [0.13, 0.077, 0.024], blush);
  const arm = new Group(); arm.name = side < 0 ? "ArmL" : "ArmR"; arm.position.set(side * 0.73, 0.84, 0); body.add(arm);
  oval(arm, `${arm.name}Surface`, [side * 0.10, -0.19, 0.03], [0.18, 0.29, 0.20]);
  const foot = new Group(); foot.name = side < 0 ? "FootL" : "FootR"; foot.position.set(side * 0.29, 0.19, 0); model.add(foot);
  oval(foot, `${foot.name}Surface`, [0, -0.025, 0.095], [0.24, 0.165, 0.30]);
}
const smile = new Mesh(new TubeGeometry(new QuadraticBezierCurve3(new Vector3(-0.105, 1.105, 0.537), new Vector3(0, 0.99, 0.555), new Vector3(0.105, 1.105, 0.537)), 20, 0.018, 8, false), ink);
smile.name = "Smile"; body.add(smile);

function clip(motion: MuviMotion) {
  const duration = motion === "run" ? 0.6 : motion === "walk" ? 1 : 3;
  const times = Array.from({ length: 61 }, (_, i) => i / 60 * duration);
  const tracks = [];
  for (const name of ["Body", "ArmL", "ArmR", "FootL", "FootR", "EyeL", "EyeR"]) {
    const node = model.getObjectByName(name)!;
    const translation: number[] = [], rotation: number[] = [], scale: number[] = [];
    for (const time of times) {
      const phase = time / duration * Math.PI * 2, wave = Math.sin(phase), bounce = (1 - Math.cos(phase * 2)) / 2;
      const p = node.position.clone(), s = node.scale.clone(), e = new Euler();
      const left = name.endsWith("L"), sign = left ? 1 : -1;
      if (name === "Body") {
        p.y += 0.018 * (1 - Math.cos(phase));
        if (motion === "walk" || motion === "run") { p.y += bounce * (motion === "run" ? 0.12 : 0.04); e.z = wave * 0.035; e.x = motion === "run" ? 0.12 : 0; }
        if (motion === "think") e.z = -0.12 + wave * 0.025;
        if (motion === "cheer") p.y += bounce * 0.32;
        if (motion === "rest") { p.y -= 0.15; e.x = -0.06; }
      }
      if (name.startsWith("Arm")) {
        if (motion === "walk" || motion === "run") e.x = wave * sign * (motion === "run" ? 0.9 : 0.55);
        if (motion === "hello" && left) { e.z = -1.65 + wave * 0.3; e.x = -0.15; }
        if (motion === "think" && !left) { e.z = 2.3; e.x = -0.65; }
        if (motion === "idea" && !left) e.z = 1.9 + wave * 0.08;
        if (motion === "cheer") e.z = -sign * (1.8 + wave * 0.15);
      }
      if (name.startsWith("Foot")) {
        if (motion === "walk" || motion === "run") { e.x = -wave * sign * 0.65; p.y += Math.max(0, wave * sign) * 0.13; p.z += wave * sign * 0.13; }
        if (motion === "cheer") { p.y += bounce * 0.32; e.z = sign * bounce * 0.3; }
        if (motion === "rest") { p.z += 0.25; e.x = -0.4; }
      }
      if (name.startsWith("Eye")) s.y = motion === "rest" ? 0.15 : Math.max(0.08, 1 - Math.exp(-Math.pow((time / duration - 0.82) / 0.025, 2)));
      translation.push(p.x, p.y, p.z); rotation.push(...new Quaternion().setFromEuler(e).toArray()); scale.push(s.x, s.y, s.z);
    }
    tracks.push(new VectorKeyframeTrack(`${name}.position`, times, translation), new QuaternionKeyframeTrack(`${name}.quaternion`, times, rotation), new VectorKeyframeTrack(`${name}.scale`, times, scale));
  }
  return new AnimationClip(motion, duration, tracks);
}
async function main() {
  const animations = MUVI_MOTIONS.map(clip);
  const output = await new GLTFExporter().parseAsync(model, { binary: true, animations });
  await mkdir("public/mascot", { recursive: true });
  await writeFile("public/mascot/muvi-v1.glb", Buffer.from(output as ArrayBuffer));
  console.log(`Muvi: ${animations.length} animation clips, ${(output as ArrayBuffer).byteLength} bytes`);
}
void main();
