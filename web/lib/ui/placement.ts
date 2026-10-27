/**
 * "Empty site → placed layout" animation, as pure math over the solver's improving solutions
 * (LayoutResponse.steps). Shared by the 2D plan and the 3D scene.
 *
 *   0 ……… EMPTY_MS            the empty site (venue only)
 *   …… + APPEAR_MS            booths fade/drop in at the first feasible solution
 *   …… + GLIDE_MS             booths glide through every later solution (eased per segment)
 *   then                      final layout (= last step)
 */
import type { Booth, LayoutStep } from "@/lib/engine/contract";

export const EMPTY_MS = 700;
export const APPEAR_MS = 650;
export const GLIDE_MS = 2700;
export const PLACEMENT_MS = EMPTY_MS + APPEAR_MS + GLIDE_MS;

export type AnimatedBooth = Booth & { /** 0 = not yet placed, 1 = solid */ alpha: number };
export type PlacementPhase = "empty" | "appearing" | "settling" | "done";
export type PlacementFrame = { phase: PlacementPhase; booths: AnimatedBooth[]; step: number; steps: number; progress: number };

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function placementFrame(steps: LayoutStep[], finalBooths: Booth[], tMs: number): PlacementFrame {
  const seq = steps.length > 0 ? steps.map((s) => s.booths) : [finalBooths];
  const n = seq.length;
  const progress = Math.min(1, Math.max(0, tMs / PLACEMENT_MS));
  const solid = (bs: Booth[], alpha = 1): AnimatedBooth[] => bs.map((b) => ({ ...b, alpha }));
  if (tMs >= PLACEMENT_MS) return { phase: "done", booths: solid(finalBooths), step: n - 1, steps: n, progress: 1 };
  if (tMs < EMPTY_MS) return { phase: "empty", booths: solid(seq[0], 0), step: 0, steps: n, progress };
  if (tMs < EMPTY_MS + APPEAR_MS || n === 1) {
    const a = Math.min(1, (tMs - EMPTY_MS) / APPEAR_MS);
    const booths = seq[0].map((b, i) => {
      // stagger: booths drop in one after another
      const local = Math.min(1, Math.max(0, a * 1.6 - (i / Math.max(1, seq[0].length)) * 0.6));
      return { ...b, alpha: easeOut(local) };
    });
    return { phase: "appearing", booths, step: 0, steps: n, progress };
  }
  const g = (tMs - EMPTY_MS - APPEAR_MS) / GLIDE_MS; // 0..1 over the remaining n-1 segments
  const seg = Math.min(n - 2, Math.floor(g * (n - 1)));
  const f = easeInOut(Math.min(1, g * (n - 1) - seg));
  const from = new Map(seq[seg].map((b) => [b.id, b]));
  const booths = seq[seg + 1].map((b) => {
    const a = from.get(b.id) ?? b;
    return { ...b, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, alpha: 1 };
  });
  return { phase: "settling", booths, step: seg + 1, steps: n, progress };
}
