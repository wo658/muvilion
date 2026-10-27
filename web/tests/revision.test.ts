import { describe, expect, it } from "vitest";
import { LayoutRequest } from "@/lib/engine/contract";
import { mockLayout, mockSimulate } from "@/lib/engine/mock";
import { applyRevision, normalizeRevision } from "@/lib/agent/revision";
import { project } from "./helpers";

function baseline() {
  const p = project();
  const request = LayoutRequest.parse({ venue: p.venue, booths: p.booths, seed: 3 });
  const layout = mockLayout(request).layout;
  const sim = mockSimulate({
    venue: p.venue,
    layout,
    booths: p.booths,
    scenario: { kind: "entry", agents: 200, duration_s: 300, seed: 42 },
    grid_cell: 2,
  });
  return { p, request, layout, sim };
}

describe("normalizeRevision", () => {
  it("keeps valid actions and reports invalid ones without applying them", () => {
    const { revision, rejected } = normalizeRevision({
      rationale: "r",
      actions: [
        { type: "set_popular_door_distance", value: 12 },
        { type: "move_booth", booth_id: "B03" }, // missing direction/distance
        { type: "set_min_aisle_width", value: 0.2 }, // out of bounds
        { type: "pin_booth", booth_id: "B01", value: null },
      ],
    });
    expect(revision.actions.map((a) => a.type)).toEqual(["set_popular_door_distance", "pin_booth"]);
    expect(rejected).toHaveLength(2);
  });

  it("rejects a malformed revision entirely", () => {
    const { revision, rejected } = normalizeRevision({ actions: "nope" });
    expect(revision.actions).toEqual([]);
    expect(rejected).toHaveLength(1);
  });
});

describe("applyRevision → LayoutRequest", () => {
  it("sets previous, keeps seed/time limit and venue, changes only what was asked", () => {
    const { p, request, layout } = baseline();
    const { request: next, applied, rejected } = applyRevision(
      { venue: p.venue, specs: p.booths, request, layout, hotspots: [] },
      { rationale: "x", actions: [{ type: "set_popular_door_distance", value: 12 }, { type: "set_min_aisle_width", value: 3.2 }] },
    );
    expect(rejected).toEqual([]);
    expect(applied).toHaveLength(2);
    expect(next.previous).toEqual(layout);
    expect(next.seed).toBe(3);
    expect(next.time_limit_s).toBe(request.time_limit_s);
    expect(next.venue).toEqual(request.venue);
    expect(next.constraints).toEqual({ ...request.constraints, popular_door_distance: 12, min_aisle_width: 3.2 });
    // input not mutated
    expect(request.constraints.popular_door_distance).toBe(0);
    expect(LayoutRequest.safeParse(next).success).toBe(true);
  });

  it("move_booth shifts only that booth's anchor in previous, computed in code and clamped to the hall", () => {
    const { p, request, layout } = baseline();
    const b03 = layout.booths.find((b) => b.id === "B03")!;
    const { request: next } = applyRevision(
      { venue: p.venue, specs: p.booths, request, layout, hotspots: [] },
      { rationale: "", actions: [{ type: "move_booth", booth_id: "B03", direction: "north", distance_m: 100 }] },
    );
    const moved = next.previous!.booths.find((b) => b.id === "B03")!;
    expect(moved.x).toBe(b03.x);
    expect(moved.y).toBe(p.venue.height - request.constraints.wall_margin - b03.h);
    const others = next.previous!.booths.filter((b) => b.id !== "B03");
    expect(others).toEqual(layout.booths.filter((b) => b.id !== "B03"));
  });

  it("widen_aisle_at_hotspot derives the keep-out from the hotspot zone", () => {
    const { p, request, layout, sim } = baseline();
    expect(sim.hotspots.length).toBeGreaterThan(0);
    const z = sim.hotspots[0].zone;
    const { request: next } = applyRevision(
      { venue: p.venue, specs: p.booths, request, layout, hotspots: sim.hotspots },
      { rationale: "", actions: [{ type: "widen_aisle_at_hotspot", hotspot_index: 0, margin_m: 0.5 }] },
    );
    expect(next.constraints.keep_out).toEqual([{ x: z.x - 0.5, y: z.y - 0.5, w: z.w + 1, h: z.h + 1 }]);
  });

  it("pin/unpin and rejects unknown booths and hotspots", () => {
    const { p, request, layout } = baseline();
    const b01 = layout.booths.find((b) => b.id === "B01")!;
    const pinned = applyRevision(
      { venue: p.venue, specs: p.booths, request, layout, hotspots: [] },
      {
        rationale: "",
        actions: [
          { type: "pin_booth", booth_id: "B01" },
          { type: "pin_booth", booth_id: "NOPE" },
          { type: "widen_aisle_at_hotspot", hotspot_index: 4, margin_m: 0 },
          { type: "unpin_booth", booth_id: "B02" },
        ],
      },
    );
    expect(pinned.request.constraints.fixed).toEqual({ B01: { x: b01.x, y: b01.y } });
    expect(pinned.rejected.map((r) => r.reason)).toEqual([
      "unknown booth NOPE",
      "no hotspot #4 in the last simulation",
      "B02 is not pinned",
    ]);
    const unpinned = applyRevision(
      { venue: p.venue, specs: p.booths, request: pinned.request, layout, hotspots: [] },
      { rationale: "", actions: [{ type: "unpin_booth", booth_id: "B01" }] },
    );
    expect(unpinned.request.constraints.fixed).toEqual({});
  });
});
