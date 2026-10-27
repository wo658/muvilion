import { describe, expect, it } from "vitest";
import { summarizeIteration } from "@/lib/agent/analysis";
import { createStubLLM } from "@/lib/agent/llm-stub";
import { LayoutRequest } from "@/lib/engine/contract";
import { mockLayout, mockSimulate } from "@/lib/engine/mock";
import { venueById } from "@/lib/venues";

describe("stub revision with organizer-pinned popular booths", () => {
  it("only releases the pins (no entrance-distance rule in the same revision)", async () => {
    const v = venueById("riverside-plaza")!.project;
    const constraints = v.constraints!;
    const layout = mockLayout(LayoutRequest.parse({ venue: v.venue, booths: v.booths, constraints })).layout;
    const sim = mockSimulate({ venue: v.venue, layout, booths: v.booths, scenario: { kind: "entry", agents: 200, duration_s: 300, seed: 42 } });
    const summary = summarizeIteration({ iteration: 0, venue: v.venue, specs: v.booths, layout, constraints, sim, violations: [] });
    // Make the top hotspot border a pinned popular food truck (as on the real engine).
    const truck = summary.popular_booths.find((b) => b.pinned)!;
    expect(truck).toBeTruthy();
    summary.hotspots[0] = { ...summary.hotspots[0], nearby_booths: [truck] };
    const pinnedPopular = [truck.id];
    const llm = createStubLLM();
    const analysis = await llm.analyze({ summary, previous: null });
    const { revision } = await llm.revise({ summary, analysis, history: [] });
    expect(revision.actions).toEqual(pinnedPopular.map((id) => ({ type: "unpin_booth", booth_id: id })));
    expect(revision.rationale).toMatch(/organizer's approval/);
  });
});
