// Choose collision-free eye-level walkthrough paths for the interior film clips.
// Run from web/ (for its path aliases): pnpm exec tsx ../video/launch/plan-interior-paths.ts
// Each clip is framed on one of the demo's feature wall surfaces. Candidate glides in front of the
// surface are checked with the app's own walk rules (canStand/canTravel) with extra clearance, and
// the sight line to the surface must not cross walls or tall installations. The camera always looks
// at the surface centre, so the feature wall stays in frame while the parallax reveals the room.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { navigationWorld } from "@/lib/plans/camera";
import { canStand, canTravel, EYE_HEIGHT, type WalkPoint, type WalkWorld } from "@/lib/plans/walk";
import { wallSurfaceFrame } from "@/lib/plans/wall-surfaces";
import { deriveWalls } from "@/lib/plans/walls";
import type { PlanDocument } from "@/lib/plans/schema";

const repo = resolve(__dirname, "../..");
// name → wall surface id. Keep the first three per sample: the film scenes use these names.
const CLIPS: Record<string, [string, string][]> = {
  popup: [
    ["popup-interior-entry", "photo:z-checkin"],
    ["popup-interior-fitting", "ws-fit-a"],
    ["popup-interior-lounge", "ws-east-plaster"],
    ["popup-interior-alley", "ws-photo1"],
    ["popup-interior-live", "ws-video-live"],
    ["popup-interior-studio", "ws-west-frame"],
  ],
  kintex: [
    ["kintex-interior-stage", "ws-stage-led"],
    ["kintex-interior-studio", "ws-shoot-b"],
    ["kintex-interior-salon", "ws-talk-threads"],
    ["kintex-interior-welcome", "ws-welcome"],
    ["kintex-interior-live", "ws-led-east"],
  ],
};
const result: Record<string, unknown> = {};
for (const [sample, clips] of Object.entries(CLIPS)) {
  const bundle = JSON.parse(readFileSync(resolve(repo, `data/samples/${sample}/recorded.json`), "utf8"));
  const doc = bundle.state.document as PlanDocument;
  const walk = navigationWorld(doc)!;
  // The camera floats at eye height, so furniture lower than 1.2 m (seats, counters, stage decks)
  // may pass below it; anything taller, walls and the floor boundary still block the glide.
  const world: WalkWorld = { ...walk, objects: walk.objects.filter(o => (o.elevation ?? 0) + o.height >= 1.2 && (o.elevation ?? 0) < 2.1) };
  const walls = deriveWalls(doc, { pairParallelEdges: true });
  const tall: WalkWorld = { ...walk, objects: walk.objects.filter(o => (o.elevation ?? 0) < 1.5 && (o.elevation ?? 0) + o.height > 1.75) };
  const big = world.width > 80;
  for (const [name, surfaceId] of clips) {
    // "photo:<zone>" frames the subject of the demo's saved report photo of that zone instead.
    const photo = surfaceId.startsWith("photo:") ? bundle.state.planningArtifacts[0].photos.find((p: { targetId: string }) => p.targetId === surfaceId.slice(6)) : null;
    const surface = photo ? { text: undefined } : doc.wallSurfaces?.find(s => s.id === surfaceId);
    const frame = photo ? (() => {
      const [ex, , ez] = photo.shot.eye, [tx, , tz] = photo.shot.target;
      return { x: tx + walk.width / 2, y: tz + walk.depth / 2, angle: Math.atan2(-(ex - tx), ez - tz), width: 6, elevation: 0, height: 2.4 };
    })() : surface && wallSurfaceFrame(doc, surface as NonNullable<PlanDocument["wallSurfaces"]>[number], walls);
    if (!surface || !frame) { console.warn(`skip ${name}: no surface ${surfaceId}`); continue; }
    // If the decorated face cannot be seen from any clear standing point (e.g. it faces backstage),
    // frame the host from its other side and record that in the plan.
    let best: { score: number; from: WalkPoint; to: WalkPoint; d: number[]; l: number[]; clear: number; side: number } | null = null;
    for (const side of [1, -1]) {
    const nx = -Math.sin(frame.angle) * side, ny = Math.cos(frame.angle) * side, ux = Math.cos(frame.angle), uy = Math.sin(frame.angle);
    const at = (d: number, l: number): WalkPoint => ({ x: frame.x + nx * d + ux * l, y: frame.y + ny * d + uy * l });
    const face = at(0.8, 0);
    const sees = (p: WalkPoint) => canTravel(p, face, tall, 0.1);
    const ideal = Math.max(big ? 7 : 5, frame.width * 0.9);
    for (const clear of big ? [0.9, 0.6, 0.4] : [0.6, 0.45, 0.35]) {
      for (const glide of big ? [6, 4.5, 3.5] : [4.5, 3.5, 2.5]) {
        for (let d0 = 2.5; d0 <= (big ? 14 : 9); d0 += 0.5) for (let d1 = Math.max(2.5, d0 - 2.5); d1 <= d0; d1 += 0.5) {
          const dl = Math.sqrt(Math.max(0, glide * glide - (d0 - d1) ** 2));
          for (let l0 = -6; l0 <= 6; l0 += 0.5) for (const sign of [-1, 1]) {
            const l1 = l0 + sign * dl;
            if (Math.abs(l0) > d0 * 0.8 || Math.abs(l1) > d1 * 0.8) continue;
            const s = at(d0, l0), e = at(d1, l1);
            if (!canStand(s, world, clear) || !canStand(e, world, clear) || !canTravel(s, e, world, clear)) continue;
            let ok = true;
            for (let i = 0; i <= 12 && ok; i++) ok = sees({ x: s.x + (e.x - s.x) * i / 12, y: s.y + (e.y - s.y) * i / 12 });
            if (!ok) continue;
            const score = glide * 2 - Math.abs((d0 + d1) / 2 - ideal) * 0.5 - Math.abs(l0 + l1) * 0.25;
            if (!best || score > best.score) best = { score, from: s, to: e, d: [d0, d1], l: [l0, l1], clear, side };
          }
        }
        if (best) break;
      }
      if (best) break;
    }
    if (best) break;
    }
    if (!best) { console.warn(`skip ${name}: no clear path to ${surfaceId}`); continue; }
    const toScene = (p: WalkPoint) => [p.x - walk.width / 2, p.y - walk.depth / 2];
    const lookY = Math.max(EYE_HEIGHT, frame.elevation + frame.height * 0.55);
    result[name] = { sample, surface: surfaceId, text: surface.text, from: toScene(best.from), to: toScene(best.to),
      target: [frame.x - walk.width / 2, lookY, frame.y - walk.depth / 2], distance: best.d, lateral: best.l, clearance: best.clear, decoratedFaceVisible: best.side === 1 };
    console.log(name, JSON.stringify(result[name]));
  }
}
const out = resolve(repo, "video/out/latest-captures");
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "interior-paths.json"), JSON.stringify(result, null, 2));
