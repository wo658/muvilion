import type { PlanDocument } from "./schema";

export type RegionalProgress = {
  total: number;
  completed: number;
  failed: number;
  settled: number;
};

/** Small bounded worker pool. Aborted/unstarted work is never counted as reviewed. */
export async function runRegionalBatches<Batch, Result>(
  batches: readonly Batch[],
  request: (batch: Batch, signal: AbortSignal) => Promise<Result>,
  signal: AbortSignal,
  onProgress: (progress: RegionalProgress) => void,
): Promise<{ results: Result[]; errors: string[]; progress: RegionalProgress; cancelled: boolean }> {
  const results: Result[] = [];
  const errors: string[] = [];
  const progress: RegionalProgress = { total: batches.length, completed: 0, failed: 0, settled: 0 };
  let next = 0;
  onProgress({ ...progress });
  async function worker() {
    while (!signal.aborted && next < batches.length) {
      const batch = batches[next++];
      try {
        const result = await request(batch, signal);
        results.push(result);
        progress.completed++;
        progress.settled++;
      } catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === "AbortError")) break;
        errors.push(error instanceof Error ? error.message.slice(0, 240) : "A region could not be reviewed.");
        progress.failed++;
        progress.settled++;
      }
      onProgress({ ...progress });
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  return { results, errors, progress: { ...progress }, cancelled: signal.aborted };
}


/** Full-page review resolves long structural runs; cropped evidence retains small-room detail. */
function isLongWallCandidate(document: PlanDocument, line: PlanDocument["lines"][number]) {
  return Math.hypot((line.b.x - line.a.x) * document.source.width, (line.b.y - line.a.y) * document.source.height)
    >= 0.12 * Math.min(document.source.width, document.source.height);
}

/** Global image context can disambiguate trenches, grids and partitions hidden by crops. */
export function globalWallAuditBatches(base: PlanDocument, proposed: PlanDocument): PlanDocument[] {
  const unknown = new Set(base.lines.filter(line => line.kind === "unknown").map(line => line.id));
  const candidates = proposed.lines.filter(line => line.kind === "wall" && unknown.has(line.id) && isLongWallCandidate(base, line));
  const batches: PlanDocument[] = [];
  for (let offset = 0; offset < candidates.length; offset += 250) {
    batches.push({
      ...base,
      lines: candidates.slice(offset, offset + 250).map(line => ({ ...line, kind: "unknown", confidence: 0 })),
      objects: [],
      warnings: ["Global long-wall-context audit. Review long candidate lines against the entire original drawing; repeated floor trenches, service paths and grid lines are not structural walls."],
    });
  }
  return batches;
}

/** An unreviewed/rejected long wall remains unknown; short regional walls and user labels stay. */
export function applyGlobalWallAudit(base: PlanDocument, proposed: PlanDocument, reviewed: PlanDocument[], stats: Pick<RegionalProgress, "completed" | "total" | "failed">): PlanDocument {
  const originals = new Map(base.lines.map(line => [line.id, line]));
  const candidates = new Set(proposed.lines.filter(line => line.kind === "wall" && originals.get(line.id)?.kind === "unknown" && isLongWallCandidate(base, line)).map(line => line.id));
  const retained = new Map<string, number>();
  const seen = new Set<string>();
  for (const document of reviewed) for (const line of document.lines) {
    if (!candidates.has(line.id) || seen.has(line.id)) throw new Error("Global wall audit returned unexpected or duplicate line IDs.");
    seen.add(line.id);
    if (line.kind === "wall" && line.confidence >= 0.7) retained.set(line.id, line.confidence);
  }
  return {
    ...proposed,
    lines: proposed.lines.map(line => {
      const original = originals.get(line.id);
      if (original && original.kind !== "unknown") return original;
      if (!candidates.has(line.id)) return line;
      const confidence = retained.get(line.id);
      return confidence !== undefined ? { ...original!, kind: "wall", confidence } : original!;
    }),
    warnings: [...proposed.warnings, `Global long-wall audit: ${stats.completed}/${stats.total} batches reviewed; ${stats.failed} failed. ${retained.size}/${candidates.size} long wall candidates retained; rejected or unchecked long walls remain unknown. Short regional wall candidates are preserved. Whole-page review is not a guarantee of accuracy.`].slice(-100),
  };
}
