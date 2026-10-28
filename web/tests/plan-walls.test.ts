import { describe, expect, it } from "vitest";
import { deriveWalls } from "../lib/plans/walls";
import type { PlanDocument, PlanLine } from "../lib/plans/schema";
const line = (id: string, ax: number, ay: number, bx: number, by: number): PlanLine => ({ id, a: { x: ax / 10, y: ay / 10 }, b: { x: bx / 10, y: by / 10 }, kind: "wall", origin: "vector", confidence: 1 });
const doc = (lines: PlanLine[], confirmed = true) => ({ lines, widthMeters: 10, heightMeters: 10, scaleConfirmed: confirmed, source: { width: 100, height: 100 } }) as PlanDocument;
describe("derived preview walls", () => {
  it("merges reversed duplicates and overlaps without mutating evidence", () => {
    const d = doc([line("a", 1, 1, 5, 1), line("b", 5, 1, 1, 1), line("c", 4, 1, 8, 1)]);
    const before = JSON.stringify(d); const walls = deriveWalls(d);
    expect(walls).toHaveLength(1); expect(walls[0].evidenceIds).toEqual(["a", "b", "c"]);
    expect(walls[0].a).toEqual({ x: 1, y: 1 }); expect(walls[0].b).toEqual({ x: 8, y: 1 });
    expect(JSON.stringify(d)).toBe(before);
    expect(deriveWalls({ ...d, lines: [...d.lines].reverse() })).toEqual(walls);
  });
  it("uses physical coordinates for diagonals on unequal drawing extents", () => {
    const d = doc([line("a", 0, 0, 4, 4), line("b", 3, 3, 6, 6)]); d.heightMeters = 20;
    const [wall] = deriveWalls(d); expect(wall.b.x).toBeCloseTo(6); expect(wall.b.y).toBeCloseTo(12);
  });
  it("joins only tiny confirmed gaps and preserves door openings", () => {
    expect(deriveWalls(doc([line("a", 0, 1, 3, 1), line("b", 3.004, 1, 5, 1)]))).toHaveLength(1);
    expect(deriveWalls(doc([line("a", 0, 1, 3, 1), line("b", 3.02, 1, 5, 1)]))).toHaveLength(2);
    expect(deriveWalls(doc([line("a", 0, 1, 3, 1), line("b", 3.004, 1, 5, 1)], false))).toHaveLength(2);
  });
  it("leaves nearby parallel lines separate by default", () => {
    expect(deriveWalls(doc([line("a", 0, 1, 5, 1), line("b", 0, 1.2, 5, 1.2)]))).toHaveLength(2);
  });
  it("optionally pairs unique long matching edges with inferred thickness", () => {
    const d = doc([line("a", 0, 1, 5, 1), line("b", 5, 1.2, 0, 1.2)]);
    const [wall] = deriveWalls(d, { pairParallelEdges: true });
    expect(wall.thickness).toBeCloseTo(0.2); expect(wall.a.y).toBeCloseTo(1.1);
    expect(wall.thicknessSource).toBe("inferred-parallel-edges"); expect(wall.evidenceIds).toEqual(["a", "b"]);
    expect(deriveWalls({ ...d, scaleConfirmed: false }, { pairParallelEdges: true })).toHaveLength(2);
  });
  it("rejects ambiguous third edges, short or mismatched separate walls", () => {
    const pairs = { pairParallelEdges: true };
    expect(deriveWalls(doc([line("a", 0, 1, 5, 1), line("b", 0, 1.2, 5, 1.2), line("c", 0, 1.1, 5, 1.1)]), pairs)).toHaveLength(3);
    expect(deriveWalls(doc([line("a", 0, 1, 5, 1), line("b", 0, 1.2, 5, 1.2), line("c", 2, 1.1, 3, 1.1)]), pairs)).toHaveLength(3);
    expect(deriveWalls(doc([line("a", 0, 1, 2, 1), line("b", 0, 1.2, 2, 1.2)]), pairs)).toHaveLength(2);
    expect(deriveWalls(doc([line("a", 0, 1, 5, 1), line("b", 1, 1.2, 5, 1.2)]), pairs)).toHaveLength(2);
  });
  it("pairs diagonal edges in metric space and preserves gaps in both edges", () => {
    const offset = 0.2 / Math.sqrt(2);
    const walls = deriveWalls(doc([line("a", 1, 1, 5, 5), line("b", 1 - offset, 1 + offset, 5 - offset, 5 + offset)]), { pairParallelEdges: true });
    expect(walls).toHaveLength(1); expect(walls[0].thickness).toBeCloseTo(0.2);
    const doors = deriveWalls(doc([line("a", 0, 1, 3, 1), line("b", 4, 1, 8, 1), line("c", 0, 1.2, 3, 1.2), line("d", 4, 1.2, 8, 1.2)]), { pairParallelEdges: true });
    expect(doors).toHaveLength(2); expect(doors[0].b.x).toBe(3); expect(doors[1].a.x).toBe(4);
  });
  it("uses illustrative fallback when dimensions are absent", () => {
    const d = { ...doc([line("a", 1, 1, 5, 1)], false), widthMeters: null, heightMeters: null };
    expect(deriveWalls(d)[0].b).toEqual({ x: 5, y: 1 });
  });
  it("ignores non-wall and degenerate evidence", () => {
    const unknown = { ...line("unknown", 0, 1, 5, 1), kind: "unknown" as const };
    expect(deriveWalls(doc([unknown, line("zero", 0, 0, 0, 0)]))).toEqual([]);
  });
});
