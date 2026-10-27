import { describe, expect, it } from "vitest";
import { LayoutRequest } from "@/lib/engine/contract";
import { mockLayout } from "@/lib/engine/mock";
import { APPEAR_MS, EMPTY_MS, PLACEMENT_MS, placementFrame } from "@/lib/ui/placement";
import { venueById } from "@/lib/venues";

describe("placement animation", () => {
  const p = venueById("riverside-plaza")!.project;
  const res = mockLayout(LayoutRequest.parse({ venue: p.venue, booths: p.booths }));

  it("starts on the empty site, drops booths in at the first feasible solution, ends on the final layout", () => {
    const empty = placementFrame(res.steps, res.layout.booths, 0);
    expect(empty.phase).toBe("empty");
    expect(empty.booths.every((b) => b.alpha === 0)).toBe(true);
    const appear = placementFrame(res.steps, res.layout.booths, EMPTY_MS + APPEAR_MS - 1);
    expect(appear.phase).toBe("appearing");
    expect(appear.booths.map(({ x, y }) => ({ x, y }))).toEqual(res.steps[0].booths.map(({ x, y }) => ({ x, y })));
    const mid = placementFrame(res.steps, res.layout.booths, EMPTY_MS + APPEAR_MS + 1000);
    expect(mid.phase).toBe("settling");
    expect(mid.step).toBeGreaterThan(0);
    const done = placementFrame(res.steps, res.layout.booths, PLACEMENT_MS);
    expect(done.phase).toBe("done");
    expect(done.booths.map(({ alpha, ...b }) => (void alpha, b))).toEqual(res.layout.booths);
    expect(PLACEMENT_MS).toBeGreaterThanOrEqual(3000);
    expect(PLACEMENT_MS).toBeLessThanOrEqual(5000);
  });

  it("works without steps (older engines): booths simply appear in place", () => {
    const f = placementFrame([], res.layout.booths, EMPTY_MS + APPEAR_MS + 10);
    expect(f.booths.map((b) => b.x)).toEqual(res.layout.booths.map((b) => b.x));
  });
});
