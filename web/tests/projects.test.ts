import { describe, expect, it } from "vitest";
import { calibratedSize, doorOnBoundary, Draft, newProject, projectInput, spaceErrors } from "@/lib/projects/model";
import { importProject } from "@/lib/projects/storage";

function readyProject() {
  const d = newProject();
  d.boundary = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  d.width = 80; d.height = 40; d.scaleConfirmed = true; d.spaceConfirmed = true;
  d.marks = [
    { id: "in", kind: "entrance", a: { x: 0.1, y: 0.4 }, b: { x: 0.1, y: 0.5 } },
    { id: "out", kind: "exit", a: { x: 0.9, y: 0.4 }, b: { x: 0.9, y: 0.5 } },
    { id: "pillar", kind: "obstacle", a: { x: 0.2, y: 0.2 }, b: { x: 0.3, y: 0.4 } },
    { id: "queue", kind: "keepout", a: { x: 0.5, y: 0.5 }, b: { x: 0.6, y: 0.6 } },
  ];
  return d;
}

describe("project input flow", () => {
  it("requires confirmed dimensions and both entry and exit before simulation", () => {
    expect(spaceErrors(newProject())).toHaveLength(4);
    expect(() => projectInput(newProject())).toThrow();
    expect(spaceErrors(readyProject())).toEqual([]);
  });
  it("converts a cropped image's top-left coordinates to engine meters with y up", () => {
    const p = projectInput(readyProject());
    expect(p.venue.doors[0].a).toEqual({ x: 0, y: 25 });
    expect(p.venue.doors[1].b).toEqual({ x: 80, y: 20 });
    expect(p.venue.obstacles[0].polygon).toEqual([{ x: 10, y: 35 }, { x: 20, y: 35 }, { x: 20, y: 25 }, { x: 10, y: 25 }]);
    expect(p.venue.zones[0].buildable).toBe(false);
    expect(p.constraints?.min_aisle_width).toBe(3);
    expect(p.booths).toHaveLength(20);
  });
  it("calibrates non-square page pixels and uses the selected boundary", () => {
    const d = newProject();
    d.boundary = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    expect(calibratedSize(d, { x: 0.1, y: 0.1 }, { x: 0.6, y: 0.1 }, 60)).toEqual({ width: 96, height: 64 });
    expect(() => calibratedSize(d, { x: 0, y: 0 }, { x: 0, y: 0 }, 60)).toThrow();
  });
  it("snaps doors to the same edge and clamps their endpoints", () => {
    expect(doorOnBoundary({ x: 0, y: 0.2 }, { x: 0.12, y: 0.3 }, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 })).toEqual([{ x: 0.1, y: 0.2 }, { x: 0.1, y: 0.3 }]);
  });
  it("rejects out-of-bounds boundaries and excessive run conditions", () => {
    expect(Draft.safeParse({ ...newProject(), boundary: { x: 0.5, y: 0, w: 1, h: 1 } }).success).toBe(false);
    expect(Draft.safeParse({ ...newProject(), scenario: { kind: "entry", agents: 10000, duration_s: 300, seed: 0 } }).success).toBe(false);
  });
});

describe("portable guest backups", () => {
  it("restores as a new copy and retains original drawing bytes", async () => {
    const draft = readyProject();
    const file = new File([JSON.stringify({ format: "layout-engineer-backup", draft, file: "data:application/pdf;base64,JVBERg==" })], "plan.layout.json");
    const restored = await importProject(file);
    expect(restored.draft.id).not.toBe(draft.id);
    expect(restored.draft.name).toContain("복원");
    expect(restored.draft.marks).toEqual(draft.marks);
    expect(restored.file?.type).toBe("application/pdf");
    expect(await restored.file?.text()).toBe("%PDF");
  });
  it("rejects external file references and unrecognized formats", async () => {
    await expect(importProject(new File([JSON.stringify({ format: "layout-engineer-backup", draft: newProject(), file: "https://example.com/plan.pdf" })], "bad.json"))).rejects.toThrow();
    await expect(importProject(new File([JSON.stringify({ format: "other" })], "bad.json"))).rejects.toThrow();
  });
});
