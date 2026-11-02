import { describe, expect, it } from "vitest";
import { floorBox, itemsBox, overviewPose, topPose } from "@/lib/plans/camera";
import { PlanDocumentSchema } from "@/lib/plans/schema";

// Moscone West L3 at Muse-confirmed scale: a tall 138 × 179 m page with a reviewed floor outline.
const hall = PlanDocumentSchema.parse({
  schemaVersion: 1, source: { name: "west-L3.pdf", format: "pdf", page: 1, pages: 1, width: 1836, height: 2376 },
  preview: "data:image/png;base64,AA==", widthMeters: 138.4, heightMeters: 179.1, scaleConfirmed: true,
  lines: [], texts: [], warnings: [], method: "muse",
  floorBoundary: [{ x: .23, y: .02 }, { x: .99, y: .02 }, { x: .99, y: .93 }, { x: .23, y: .93 }],
  objects: [{ id: "stage", kind: "stage", label: "Stage", x: .5, y: .5, width: 8, depth: 4, height: 1, rotation: 90, color: "#335577" }],
});
const tanHalf = Math.tan(20 * Math.PI / 180);

describe("camera fitting", () => {
  it.each([16 / 9, 1, 0.6])("keeps the whole floor in the top view at aspect %f", aspect => {
    const box = floorBox(hall), pose = topPose(hall, aspect);
    const height = pose.eye[1];
    expect(height * tanHalf).toBeGreaterThanOrEqual(box.depth / 2);
    expect(height * tanHalf * aspect).toBeGreaterThanOrEqual(box.width / 2);
    expect(pose.target[0]).toBeCloseTo(box.cx);
    expect(pose.target[2]).toBeCloseTo(box.cz);
  });
  it("frames the reviewed floor, not the paper margins, in the overview", () => {
    const box = floorBox(hall);
    expect(box.width).toBeCloseTo(.76 * 138.4);
    const pose = overviewPose(hall, 16 / 9);
    expect(pose.target[0]).toBeCloseTo(box.cx);
    const distance = Math.hypot(pose.eye[0] - pose.target[0], pose.eye[1] - pose.target[1], pose.eye[2] - pose.target[2]);
    expect(distance).toBeGreaterThan(Math.hypot(box.width, box.depth) / 2);
  });
  it("boxes an operation's elements with rotation and a readable minimum", () => {
    const box = itemsBox(hall, ["stage"])!;
    expect(box.cx).toBeCloseTo(0);
    expect(box.width).toBe(6);
    expect(box.depth).toBe(8);
    expect(box.top).toBe(1);
    expect(itemsBox(hall, ["missing"])).toBeNull();
  });
});
