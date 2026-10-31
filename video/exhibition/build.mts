import { writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  PlanDocumentSchema,
  type DesignObject,
  type SpaceZone,
} from "../../web/lib/plans/schema";
import { designWarnings } from "../../web/lib/plans/design";
import { TOKENS as T } from "../../web/lib/ui/tokens";
const require = createRequire(
  new URL("../../web/package.json", import.meta.url),
);
const sharp = require("sharp");
const W = 20,
  D = 16,
  objects: DesignObject[] = [],
  zones: SpaceZone[] = [];
function add(
  id: string,
  kind: DesignObject["kind"],
  label: string,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  color: string,
  options: Partial<DesignObject> = {},
) {
  objects.push({
    id,
    kind,
    label,
    x: x / W,
    y: y / D,
    width: w,
    depth: d,
    height: h,
    color,
    rotation: 0,
    provenance: "manual",
    ...options,
  });
}
function zone(
  id: string,
  label: string,
  purpose: SpaceZone["purpose"],
  x: number,
  y: number,
  w: number,
  d: number,
) {
  zones.push({
    id,
    label,
    purpose,
    x: x / W,
    y: y / D,
    width: w,
    depth: d,
    rotation: 0,
    assignable: false,
  });
}
zone("gallery", "Muse Gallery", "exhibition", 6.1, 7.8, 8.6, 10.4);
zone("lounge", "Connect Lounge", "lounge", 15, 10.8, 6.2, 5.7);
zone("aisle", "Arrival promenade", "circulation", 10.9, 9.8, 1.4, 10.4);
add("stage", "stage", "Muse Atelier", 8, 2.7, 11.8, 3.2, 0.22, T.ink);
add("screen", "equipment", "Muse Atelier", 8, 1.45, 10.8, 0.22, 3.8, T.ink, {
  appearance: "screen",
  elevation: 0.22,
});
add(
  "stage-table",
  "furniture",
  "Create with Muse",
  8,
  2.7,
  3,
  0.65,
  0.9,
  T.surface,
  { appearance: "table", elevation: 0.22 },
);
for (const [i, x, y] of [
  [0, 3.6, 6.3],
  [1, 7.8, 6.3],
  [2, 3.6, 10.4],
  [3, 7.8, 10.4],
]) {
  const name = ["Imagine", "Create", "Explore", "Connect"][i];
  add(
    `panel-${i}`,
    "partition",
    name,
    x,
    y - 1.05,
    3.2,
    0.18,
    2.65,
    i % 2 ? T.accent : T.ink,
  );
  add(`demo-${i}`, "furniture", name, x, y, 2.4, 0.75, 1.05, T.surface, {
    appearance: "counter",
  });
  add(
    `plinth-${i}`,
    "furniture",
    "Material study",
    x - 0.65,
    y + 1.1,
    0.65,
    0.65,
    0.85,
    T.surface,
    { modelAssetId: "display_plinth" },
  );
  add(
    `study-${i}`,
    "equipment",
    "Spatial model",
    x - 0.65,
    y + 1.1,
    0.35,
    0.35,
    0.38,
    T.accent,
    { elevation: 0.85 },
  );
}
for (const [i, x, y] of [
  [0, 13.1, 9.7],
  [1, 16.8, 9.7],
  [2, 13.1, 12.2],
  [3, 16.8, 12.2],
])
  add(
    `chair-${i}`,
    "furniture",
    "Lounge chair",
    x,
    y,
    0.9,
    1.05,
    1.1,
    T.objectSofa,
    { modelAssetId: "modern_arm_chair_01", rotation: i % 2 ? 90 : 0 },
  );
for (const [i, y] of [9.7, 12.2].entries())
  add(
    `coffee-${i}`,
    "furniture",
    "Stone coffee table",
    14.9,
    y,
    0.9,
    1.5,
    0.48,
    T.surface,
    { modelAssetId: "modern_coffee_table_01", rotation: 90 },
  );
for (let i = 0; i < 13; i++)
  add(
    `fin-${i}`,
    "partition",
    "Timber rhythm",
    18.1,
    6.3 + i * 0.52,
    0.22,
    0.18,
    3.1,
    T.objectSofa,
    { materialAssetId: "Wood051" },
  );
add(
  "lounge-sign",
  "hanging-sign",
  "Connect lounge",
  15,
  7.1,
  5,
  0.16,
  0.65,
  T.ink,
  { elevation: 2.7 },
);
add(
  "welcome",
  "furniture",
  "Welcome to Muse",
  4,
  14.2,
  3.5,
  1,
  1.1,
  T.surface,
  { modelAssetId: "reception_desk" },
);
add(
  "welcome-sign",
  "hanging-sign",
  "Muse Atelier",
  5.8,
  14.4,
  8,
  0.16,
  0.8,
  T.ink,
  { elevation: 3.7 },
);
for (const [i, x, y] of [
  [0, 1.1, 3],
  [1, 18.5, 3],
  [2, 1.1, 13.4],
  [3, 18.5, 14],
  [4, 12.6, 6.5],
])
  add(`plant-${i}`, "furniture", "Indoor tree", x, y, 1, 1, 1.8, T.foliage, {
    appearance: "plant",
  });
for (const [i, y] of [4.5, 8, 12].entries()) {
  add(`beam-${i}`, "beam", "Lighting rail", 9.8, y, 17.8, 0.18, 0.18, T.ink, {
    elevation: 4.6,
  });
  for (const x of [1, 18.6])
    add(
      `post-${i}-${x}`,
      "partition",
      "Portal support",
      x,
      y,
      0.14,
      0.14,
      4.6,
      T.ink,
    );
  for (const [j, x] of [4, 8, 13, 16].entries())
    add(`light-${i}-${j}`, "light", "Track spot", x, y, 0.2, 0.2, 0.3, T.ink, {
      modelAssetId: "track_spot",
      elevation: 4.22,
    });
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="960"><rect width="1200" height="960" fill="${T.surface}"/><rect x="30" y="30" width="1140" height="900" fill="none" stroke="${T.edge}" stroke-width="4"/><text x="60" y="90" font-family="sans-serif" font-size="30" fill="${T.ink}">MUSE ATELIER / 20 x 16 m</text>${objects
  .filter((o) => (o.elevation ?? 0) < 1.8)
  .map(
    (o) =>
      `<rect x="${(o.x * W - o.width / 2) * 60}" y="${(o.y * D - o.depth / 2) * 60}" width="${o.width * 60}" height="${o.depth * 60}" fill="${T.sunken}" stroke="${T.edge}"/>`,
  )
  .join("")}</svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
const document = PlanDocumentSchema.parse({
  schemaVersion: 1,
  source: {
    name: "Muse Atelier · 촬영용 공간",
    format: "image",
    page: 1,
    pages: 1,
    width: 1200,
    height: 960,
  },
  preview: `data:image/png;base64,${png.toString("base64")}`,
  widthMeters: W,
  heightMeters: D,
  scaleConfirmed: true,
  lines: [],
  texts: [],
  warnings: [
    "Authored fictional exhibition for a recorded product demo. Not an engine-generated or engineering-validated layout.",
  ],
  method: "opencv",
  floorBoundary: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  walkStart: { x: 0.545, y: 0.88 },
  visualStyle: "exhibition",
  wallHeight: 4.8,
  ceiling: { height: 5.2, status: "estimated", color: T.surface },
  objects,
  zones,
});
const warnings = designWarnings(document);
if (warnings.length) throw new Error(warnings.join("\n"));
const bundle = {
  projectVersion: 2,
  name: "Muse Atelier · 영상 촬영용 쇼룸",
  state: {
    projectVersion: 1,
    document,
    originalDrawingId: null,
    sources: {
      version: 1,
      drawingSelected: true,
      items: [
        {
          id: "showroom-brief",
          kind: "brief",
          name: "촬영용 쇼룸 기획",
          selected: true,
          text: "독립적으로 작성한 가상의 Meta / Muse 체험 전시. 중앙 갤러리, 라운지, 브랜드 월과 조명 포털. 실제 행사 재현이나 검증된 시공안이 아님.",
          notes: "수동 설계 · 실제 앱에서 촬영",
          images: [],
        },
      ],
    },
  },
  assets: [],
};
await mkdir(new URL("./generated/", import.meta.url), { recursive: true });
await writeFile(
  new URL("./generated/muse-atelier.muvilion.json", import.meta.url),
  JSON.stringify(bundle, null, 2),
);
console.log(
  JSON.stringify({ objects: objects.length, zones: zones.length, warnings }),
);
if (process.argv.includes("--create")) {
  const r = await fetch("http://localhost:3000/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify(bundle),
  });
  if (!r.ok) throw new Error(await r.text());
  const project = await r.json();
  await writeFile(
    new URL("./generated/local-project.json", import.meta.url),
    JSON.stringify({ id: project.id, name: project.name }),
  );
  console.log(`http://localhost:3000/?project=${project.id}`);
}
