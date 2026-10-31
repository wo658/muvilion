/** Design assumptions in metres, not certified product dimensions. X width, Z depth, Y height. */
export const FIXTURE_TYPES = ["work-table", "meeting-table", "event-chair", "phone-stand", "studio-light", "lounge-sofa"] as const;
export type FixtureType = typeof FIXTURE_TYPES[number];
export const FIXTURES = {
  "work-table": { kind: "furniture", width: 1.2, depth: 0.6, height: 0.74, use: "Seated editing/consultation desk; worktop at 0.74 m." },
  "meeting-table": { kind: "furniture", width: 1.4, depth: 0.8, height: 0.74, use: "Four-person conversation table; worktop at 0.74 m." },
  "event-chair": { kind: "furniture", width: 0.5, depth: 0.55, height: 0.85, use: "Single event/work chair; seat height 0.45 m." },
  "phone-stand": { kind: "equipment", width: 0.6, depth: 0.6, height: 1.6, use: "Floor phone holder with 0.6 m base and top clamp; not a truss." },
  "studio-light": { kind: "light", width: 0.6, depth: 0.6, height: 2.1, use: "Standing softbox concept including base, pole and head; not a calibrated light source." },
  "lounge-sofa": { kind: "furniture", width: 1.8, depth: 0.8, height: 0.85, use: "Two-person lounge sofa concept; not a single armchair." },
} as const;
export type FixturePart = { size: [number, number, number]; position: [number, number, number] };
/** Parts reach exactly the same outer bounds used by plan and collision checks. */
export function fixtureParts(type: FixtureType): FixturePart[] {
  const { width: w, depth: d, height: h } = FIXTURES[type];
  const box = (size: FixturePart["size"], position: FixturePart["position"]): FixturePart => ({ size, position });
  if (type === "work-table" || type === "meeting-table") return [
    box([w, .04, d], [0, h - .02, 0]),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => box([.05, h - .04, .05], [x * (w / 2 - .05), (h - .04) / 2, z * (d / 2 - .05)]))),
  ];
  if (type === "event-chair" || type === "lounge-sofa") return [
    box([w, .1, d], [0, .4, 0]),
    box([w, h - .45, .08], [0, (h + .45) / 2, d / 2 - .04]),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => box([.05, .35, .05], [x * (w / 2 - .05), .175, z * (d / 2 - .05)]))),
  ];
  const headHeight = type === "phone-stand" ? .18 : .4;
  return [box([w, .04, d], [0, .02, 0]), box([.04, h - headHeight - .04, .04], [0, (h - headHeight + .04) / 2, 0]), box([type === "phone-stand" ? .1 : .5, headHeight, .08], [0, h - headHeight / 2, 0])];
}
