import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sample from "@/fixtures/sample_hall.json";
import outdoor from "@/fixtures/outdoor_plaza.json";
import {
  LayoutRequest,
  LayoutResponse,
  ProjectInput,
  SimResult,
  ValidateResponse,
  defaultConstraints,
} from "@/lib/engine/contract";
import { createMockEngine } from "@/lib/engine/mock";

describe("contract", () => {
  it("parses the sample hall fixture", () => {
    const p = ProjectInput.parse(sample);
    expect(p.venue.width).toBe(40);
    expect(p.venue.height).toBe(30);
    expect(p.venue.doors.map((d) => d.kind)).toEqual(["entrance", "exit", "emergency"]);
    expect(p.venue.unknowns.length).toBeGreaterThan(0);
    expect(p.booths).toHaveLength(24);
    expect(p.booths.find((b) => b.id === "B03")?.popularity).toBe(0.95);
  });

  it.each(["sample_hall.json", "outdoor_plaza.json"])("web copy of %s matches the repo-root fixture", (name) => {
    const root = resolve(__dirname, "../../fixtures", name);
    if (!existsSync(root)) return;
    expect(JSON.parse(readFileSync(root, "utf8"))).toEqual(JSON.parse(readFileSync(resolve(__dirname, "../fixtures", name), "utf8")));
  });

  it("parses the outdoor plaza fixture", () => {
    const p = ProjectInput.parse(outdoor);
    expect(p.venue.setting).toBe("outdoor");
    expect(p.venue.zones.some((z) => z.kind === "fire_lane" && !z.buildable)).toBe(true);
    expect(p.booths.filter((b) => b.kind === "food_truck")).toHaveLength(6);
    expect(p.booths.filter((b) => b.kind === "tent")).toHaveLength(18);
  });

  it("fills Pydantic defaults", () => {
    const p = ProjectInput.parse(sample);
    const req = LayoutRequest.parse({ venue: p.venue, booths: p.booths });
    expect(req.constraints).toEqual(defaultConstraints());
    expect(req.constraints.min_aisle_width).toBe(3);
    expect(req.constraints.door_clearance).toBe(5);
    expect(req.previous).toBeNull();
    expect(req.time_limit_s).toBe(10);
  });

  it("rejects invalid values the engine would reject", () => {
    expect(() => LayoutResponse.parse({ layout: { id: "x", venue_id: "v", booths: [] }, status: "maybe", solve_time_s: 0 })).toThrow();
    expect(() => ProjectInput.parse({ ...sample, booths: [{ id: "b", label: "b", w: 0, h: 1 }] })).toThrow();
  });

  it("mock engine outputs satisfy the contract", async () => {
    const p = ProjectInput.parse(sample);
    const e = createMockEngine();
    const l = await e.layout(LayoutRequest.parse({ venue: p.venue, booths: p.booths }));
    expect(l.status).not.toBe("infeasible");
    expect(l.layout.booths).toHaveLength(24);
    const v = await e.validate({ venue: p.venue, layout: l.layout, constraints: defaultConstraints() });
    expect(ValidateResponse.parse(v).ok).toBe(true);
    const s = await e.simulate({
      venue: p.venue,
      layout: l.layout,
      booths: p.booths,
      scenario: { kind: "entry", agents: 200, duration_s: 300, seed: 1 },
      grid_cell: 2,
    });
    expect(SimResult.parse(s).grid.peak).toHaveLength(s.grid.cols * s.grid.rows);
    // deterministic
    const s2 = await e.simulate({
      venue: p.venue,
      layout: l.layout,
      booths: p.booths,
      scenario: { kind: "entry", agents: 200, duration_s: 300, seed: 1 },
      grid_cell: 2,
    });
    expect(s2).toEqual(s);
  });
});
