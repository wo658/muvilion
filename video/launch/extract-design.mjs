/* global process, console */
// Slim geometry extract of the saved Seongsu Muse demo for the launch-film opening.
// Usage (from video/): node launch/extract-design.mjs [../data/samples/popup/recorded.json]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.argv[2] ?? resolve(here, "../../data/samples/popup/recorded.json"));
const out = resolve(here, "../public/launch-current/popup-design.json");
const bundle = JSON.parse(readFileSync(src, "utf8"));
const doc = bundle.state.document;
const r = (v) => Math.round(v * 10000) / 10000;

const design = {
  source: "data/samples/popup/recorded.json (saved Muse demo; slim geometry extract for the launch film)",
  name: bundle.name,
  width: doc.widthMeters,
  depth: doc.heightMeters,
  wallHeight: doc.wallHeight ?? null,
  ceiling: doc.ceiling ? { height: doc.ceiling.height, status: doc.ceiling.status } : null,
  floorBoundary: (doc.floorBoundary ?? []).map((p) => [r(p.x), r(p.y)]),
  walls: doc.lines
    .filter((l) => l.kind === "wall")
    .map((l) => ({ id: l.id, a: [r(l.a.x), r(l.a.y)], b: [r(l.b.x), r(l.b.y)] })),
  zones: (doc.zones ?? []).map((z) => ({
    label: z.label, purpose: z.purpose, x: r(z.x), y: r(z.y), w: r(z.width), d: r(z.depth), rot: z.rotation,
  })),
  objects: (doc.objects ?? []).map((o) => ({
    id: o.id, kind: o.kind, label: o.label, fixture: o.fixtureType ?? null, asset: o.modelAssetId ?? o.materialAssetId ?? null,
    x: r(o.x), y: r(o.y), w: r(o.width), d: r(o.depth), h: r(o.height), e: o.elevation ?? 0, rot: o.rotation, color: o.color,
  })),
  wallSurfaces: (doc.wallSurfaces ?? []).map((s) => ({
    id: s.id, hostType: s.hostType, hostId: s.hostId, side: s.side, start: s.start, end: s.end,
    elevation: s.elevation, height: s.height, color: s.color, graphic: s.graphic ?? null,
    graphicColor: s.graphicColor ?? null, text: s.text ?? null,
  })),
  sources: bundle.state.sources.items.map((s) => ({ kind: s.kind, name: s.name, text: s.text ?? "" })),
};
writeFileSync(out, JSON.stringify(design));
console.log(`${out}: ${design.objects.length} objects, ${design.wallSurfaces.length} wall surfaces, kinds`,
  [...new Set(design.objects.map((o) => o.kind))].join(","));
