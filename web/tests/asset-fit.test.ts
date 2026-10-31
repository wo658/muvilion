import { describe, expect, it } from "vitest";
import { fitAssetBounds } from "@/lib/assets/fit";

describe("asset model fitting", () => {
  it("keeps an off-origin model inside its collision envelope and places its bottom at zero", () => {
    const min = [-3, -2, 4] as const;
    const max = [1, 2, 6] as const;
    const fit = fitAssetBounds(min, max, [2, 2, 1]);
    expect(fit.scale).toEqual([0.5, 0.5, 0.5]);
    expect(min.map((value, axis) => (value + fit.offset[axis]) * fit.scale[axis])).toEqual([-1, 0, -0.5]);
    expect(max.map((value, axis) => (value + fit.offset[axis]) * fit.scale[axis])).toEqual([1, 2, 0.5]);
  });

  it("rejects aspect-ratio changes rather than silently shrinking a model", () => {
    expect(() => fitAssetBounds([0, 0, 0], [2, 1, 4], [4, 4, 1])).toThrow("proportions");
  });

  it("rejects empty or corrupt bounds so the object can use its schematic fallback", () => {
    expect(() => fitAssetBounds([0, 0, 0], [0, 0, 0], [1, 1, 1])).toThrow();
    expect(() => fitAssetBounds([0, 0, 0], [Infinity, 1, 1], [1, 1, 1])).toThrow();
  });
});
