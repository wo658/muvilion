import { describe, expect, it } from "vitest";
import { summarizeIteration } from "@/lib/agent/analysis";
import { createStubLLM } from "@/lib/agent/llm-stub";
import { LayoutRequest } from "@/lib/engine/contract";
import { mockLayout, mockSimulate } from "@/lib/engine/mock";
import { venueById } from "@/lib/venues";

describe("stub revision with organizer-pinned popular booths", () => {
  it("releases every popular pin of the request, and nothing else", async () => {
    const v = venueById("riverside-plaza")!.project;
    const constraints = v.constraints!;
    const layout = mockLayout(LayoutRequest.parse({ venue: v.venue, booths: v.booths, constraints })).layout;
    const sim = mockSimulate({ venue: v.venue, layout, booths: v.booths, scenario: { kind: "entry", agents: 200, duration_s: 300, seed: 42 } });
    const summary = summarizeIteration({ iteration: 0, venue: v.venue, specs: v.booths, layout, constraints, sim, violations: [] });
    // Make the top hotspot border a pinned popular food truck (as on the real engine).
    const truck = summary.popular_booths.find((b) => b.pinned)!;
    expect(truck).toBeTruthy();
    summary.hotspots[0] = { ...summary.hotspots[0], nearby_booths: [truck] };
    // The pins come from one request, so all popular pinned booths are released together.
    const pinnedPopular = [truck.id, ...summary.popular_booths.filter((b) => b.pinned && b.id !== truck.id).map((b) => b.id)];
    const llm = createStubLLM();
    const analysis = await llm.analyze({ summary, previous: null });
    const { revision } = await llm.revise({ summary, analysis, history: [] });
    expect(revision.actions).toEqual(pinnedPopular.map((id) => ({ type: "unpin_booth", booth_id: id })));
    expect(revision.rationale).toMatch(/organizer's approval/);
  });
});

describe("unpin_booth translation", () => {
  it("drops the released booth's anchor from previous so the solver re-places it", async () => {
    const { applyRevision } = await import("@/lib/agent/revision");
    const v = venueById("riverside-plaza")!.project;
    const constraints = v.constraints!;
    const request = LayoutRequest.parse({ venue: v.venue, booths: v.booths, constraints });
    const layout = mockLayout(request).layout;
    const pinned = Object.keys(constraints.fixed)[0];
    const { request: next } = applyRevision(
      { request, layout, specs: v.booths, venue: v.venue, hotspots: [] },
      { rationale: "release", actions: [{ type: "unpin_booth", booth_id: pinned }] },
    );
    expect(next.constraints.fixed[pinned]).toBeUndefined();
    expect(next.previous?.booths.some((b) => b.id === pinned)).toBe(false);
    expect(next.previous?.booths.length).toBe(layout.booths.length - 1);
  });
});
