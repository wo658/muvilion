import { describe, expect, it } from "vitest";
import { matchProjects, monogram, recentProjects } from "@/lib/projects/rail";

const project = (id: string, name: string, updatedAt: string) => ({ id, name, revision: 1, updatedAt });

describe("project rail", () => {
  it("builds distinct two-letter monograms", () => {
    expect(monogram("KINTEX · 2홀")).toBe("K2");
    expect(monogram("Moscone West · L1 전시홀")).toBe("M전");
    expect(monogram("Untitled")).toBe("UN");
    expect(monogram("  ")).toBe("?");
  });
  it("keeps the open project among the recent tiles", () => {
    const items = ["a", "b", "c", "d"].map((id, i) => project(id, id, `2026-10-0${9 - i}`));
    expect(recentProjects(items, "d", 2).map(item => item.id)).toEqual(["a", "d"]);
    expect(recentProjects(items, "a", 2).map(item => item.id)).toEqual(["a", "b"]);
  });
  it("filters by name without case", () => {
    expect(matchProjects([project("a", "KINTEX 1홀", "x"), project("b", "LVCC", "x")], "kin").map(item => item.id)).toEqual(["a"]);
  });
});
