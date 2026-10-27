import { describe, expect, it } from "vitest";
import { applyBrief, normalizeBrief, ruleBasedBrief, summarizeSite } from "@/lib/agent/brief";
import { loadAgentConfig } from "@/lib/agent/config";
import { createStubLLM } from "@/lib/agent/llm-stub";
import { LayoutRequest, defaultConstraints, type ProjectInput } from "@/lib/engine/contract";
import { mockLayout, mockValidate } from "@/lib/engine/mock";
import { boothRect, polygonBBox, rectsOverlap } from "@/lib/geometry";
import { venueById } from "@/lib/venues";

const scenario = loadAgentConfig({}).scenario;
const initial = (p: ProjectInput) => LayoutRequest.parse({ venue: p.venue, booths: p.booths, constraints: defaultConstraints() });
const site = (p: ProjectInput) => summarizeSite(p.venue, p.booths, scenario, defaultConstraints());

describe("design brief", () => {
  it("stub brief for the outdoor plaza translates into the first LayoutRequest", async () => {
    const p = structuredClone(venueById("riverside-plaza")!.project);
    const { brief, rejected } = await createStubLLM().designBrief({ site: site(p) });
    expect(rejected).toEqual([]);
    const t = applyBrief({ venue: p.venue, specs: p.booths, request: initial(p) }, brief);
    expect(t.rejected).toEqual([]);
    const c = t.request.constraints;
    expect(t.request.previous).toBeNull();
    expect(c.min_aisle_width).toBeGreaterThan(defaultConstraints().min_aisle_width);
    expect(c.door_clearance).toBeGreaterThan(defaultConstraints().door_clearance);
    // where the food trucks go is left to the solver and the revision loop (not pre-empted)
    expect(c.popular_door_distance).toBe(0);
    expect(c.keep_out).toEqual([]);
    // the kiosk is pinned beside the main gate, clear of obstacles, zones and the gate line
    const k = c.fixed.K1;
    expect(k).toBeDefined();
    const kr = boothRect({ ...k, w: 2, h: 2 });
    expect(Math.hypot(kr.x + 1 - 30, kr.y + 1)).toBeLessThan(20);
    expect(kr.x + kr.w <= 27 || kr.x >= 33).toBe(true);
    for (const o of p.venue.obstacles) expect(rectsOverlap(kr, polygonBBox(o.polygon))).toBe(false);
    // and the solver can place everything under it without validation errors
    const res = mockLayout(t.request);
    expect(res.status).not.toBe("infeasible");
    expect(res.layout.booths.find((b) => b.id === "K1")).toMatchObject(k);
    expect(mockValidate({ venue: p.venue, layout: res.layout, constraints: c }).violations.filter((v) => v.severity === "error")).toEqual([]);
  });

  it("indoor with moderate attendance keeps the defaults; high attendance moves popular booths away", () => {
    const p = structuredClone(venueById("sample-hall")!.project);
    const moderate = normalizeBrief(ruleBasedBrief(site(p)));
    expect(moderate.brief.items).toEqual([]);
    const busy = summarizeSite(p.venue, p.booths, { ...scenario, agents: 600 }, defaultConstraints());
    const high = normalizeBrief(ruleBasedBrief(busy));
    expect(high.brief.items).toEqual([{ type: "set_popular_door_distance", value: 8 }]);
    const t = applyBrief({ venue: p.venue, specs: p.booths, request: initial(p) }, high.brief);
    expect(t.request.constraints.popular_door_distance).toBe(8);
    expect(t.applied.map((a) => a.effect)).toEqual(["popular_door_distance 0 → 8 m"]);
  });

  it("an open area in front of a gate becomes a keep-out rect computed from the door geometry", () => {
    const p = structuredClone(venueById("riverside-plaza")!.project);
    const { brief } = normalizeBrief({ rationale: "plaza", keep_clear_at_doors: [{ door_id: "G-main", depth_m: 9, width_m: 12 }] });
    const t = applyBrief({ venue: p.venue, specs: p.booths, request: initial(p) }, brief);
    expect(t.request.constraints.keep_out).toEqual([{ x: 24, y: 0, w: 12, h: 9 }]);
    expect(t.applied[0].effect).toMatch(/^open area in front of G-main/);
  });

  it("validates model output: out-of-range values and unknown ids are rejected, not applied", () => {
    const p = structuredClone(venueById("riverside-plaza")!.project);
    const { brief, rejected } = normalizeBrief({
      rationale: "r",
      min_aisle_width: 0.5,
      door_clearance: null,
      keep_clear_at_doors: [{ door_id: "G-main", depth_m: 8, width_m: 10 }, { door_id: "G-main", depth_m: 99, width_m: 10 }],
      place_near_door: [{ booth_id: "NOPE", door_id: "G-main" }],
    });
    expect(rejected).toHaveLength(2); // aisle 0.5, depth 99
    const t = applyBrief({ venue: p.venue, specs: p.booths, request: initial(p) }, brief);
    expect(t.request.constraints.min_aisle_width).toBe(3);
    expect(t.request.constraints.keep_out).toHaveLength(1);
    expect(t.rejected.map((r) => r.reason)).toEqual(["unknown booth NOPE"]);
    expect(normalizeBrief({ nope: 1 }).rejected).toHaveLength(1);
  });

  it("summarizes the site for the LLM without layout metrics", () => {
    const s = site(venueById("riverside-plaza")!.project);
    expect(s.venue.setting).toBe("outdoor");
    expect(s.booths.by_kind).toEqual({ tent: 18, food_truck: 6, kiosk: 1 });
    expect(s.zones.find((z) => z.kind === "fire_lane")?.buildable).toBe(false);
    expect(JSON.stringify(s)).not.toMatch(/density_p|travel_time/);
  });
});

describe("mock solver steps", () => {
  it.each(["sample-hall", "riverside-plaza"])("%s: improving solutions, overlap-free, last = final", (id) => {
    const p = venueById(id)!.project;
    const res = mockLayout(initial(p));
    expect(res.steps.length).toBeGreaterThan(2);
    expect(res.steps.length).toBeLessThanOrEqual(12);
    const obj = res.steps.map((s) => s.objective);
    for (let i = 1; i < obj.length; i++) expect(obj[i]).toBeLessThan(obj[i - 1]);
    const ts = res.steps.map((s) => s.t_s);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1]);
    for (const s of res.steps) {
      expect(s.booths.map((b) => b.id).sort()).toEqual(res.layout.booths.map((b) => b.id).sort());
      const rs = s.booths.map(boothRect);
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(rectsOverlap(rs[i], rs[j])).toBe(false);
    }
    expect(res.steps[res.steps.length - 1].booths).toEqual(res.layout.booths);
    expect(res.steps[0].booths).not.toEqual(res.layout.booths);
  });

  it("warm-started revisions report a single step", () => {
    const p = venueById("sample-hall")!.project;
    const first = mockLayout(initial(p));
    const res = mockLayout({ ...initial(p), previous: first.layout });
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0].booths).toEqual(res.layout.booths);
  });
});

describe("zone rules", () => {
  it("a booth pinned on the fire lane fails zone_unbuildable + fire_lane_blocked, and the stub unpins it", async () => {
    const p = structuredClone(venueById("riverside-plaza")!.project);
    const c = { ...defaultConstraints(), fixed: { M01: { x: 30, y: 19 } } };
    const res = mockLayout(LayoutRequest.parse({ venue: p.venue, booths: p.booths, constraints: c }));
    const v = mockValidate({ venue: p.venue, layout: res.layout, constraints: c }).violations;
    const zone = v.filter((x) => x.rule_id === "zone_unbuildable" || x.rule_id === "fire_lane_blocked");
    expect(zone.map((x) => x.rule_id).sort()).toEqual(["fire_lane_blocked", "zone_unbuildable"]);
    expect(zone.every((x) => x.source === "venue:zones/Z-fire" && x.severity === "error")).toBe(true);
    const { summarizeIteration } = await import("@/lib/agent/analysis");
    const summary = summarizeIteration({ iteration: 0, venue: p.venue, specs: p.booths, layout: res.layout, constraints: c, sim: null, violations: v });
    const fix = await createStubLLM().proposeFixes({ summary, attempt: 0 });
    expect(fix.revision.actions).toContainEqual({ type: "unpin_booth", booth_id: "M01" });
  });
});
