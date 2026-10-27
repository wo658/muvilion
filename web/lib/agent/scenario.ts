/**
 * Identical-conditions guard. A run locks one scenario (kind, agents, duration,
 * seed), the grid cell, the venue and the booth demand (popularity) up front;
 * every simulate request must be built through the guard and is re-checked
 * before it is sent, and every result must echo the locked scenario. Comparing
 * iterations is only meaningful if nothing but the layout changed.
 */
import {
  Scenario,
  SimulateRequest,
  type BoothSpec,
  type Layout,
  type SimResult,
  type Venue,
} from "@/lib/engine/contract";
import { hashString } from "@/lib/geometry";

export class ScenarioMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioMismatchError";
  }
}

/** JSON with sorted keys so fingerprints do not depend on property order. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

export class ScenarioGuard {
  readonly scenario: Readonly<Scenario>;
  readonly gridCell: number;
  readonly fingerprint: string;
  private readonly conditionsKey: string;
  private readonly venue: Venue;
  private readonly booths: BoothSpec[];

  constructor(scenario: Scenario, gridCell: number, venue: Venue, booths: BoothSpec[]) {
    this.scenario = Object.freeze(Scenario.parse(structuredClone(scenario)));
    this.gridCell = gridCell;
    this.venue = structuredClone(venue);
    this.booths = structuredClone(booths);
    this.conditionsKey = stable({ s: this.scenario, g: gridCell, v: this.venue, b: this.booths });
    this.fingerprint = hashString(this.conditionsKey);
  }

  /** The only sanctioned way to build a simulate request during a run. */
  request(layout: Layout): SimulateRequest {
    const req = SimulateRequest.parse({
      venue: structuredClone(this.venue),
      layout,
      booths: structuredClone(this.booths),
      scenario: { ...this.scenario },
      grid_cell: this.gridCell,
    });
    this.assertRequest(req);
    return req;
  }

  assertRequest(req: SimulateRequest): void {
    const key = stable({ s: req.scenario, g: req.grid_cell, v: req.venue, b: req.booths });
    if (key !== this.conditionsKey) {
      const diffs: string[] = [];
      if (stable(req.scenario) !== stable(this.scenario)) diffs.push(`scenario ${stable(req.scenario)} ≠ locked ${stable(this.scenario)}`);
      if (req.grid_cell !== this.gridCell) diffs.push(`grid_cell ${req.grid_cell} ≠ locked ${this.gridCell}`);
      if (stable(req.venue) !== stable(this.venue)) diffs.push("venue changed");
      if (stable(req.booths) !== stable(this.booths)) diffs.push("booth specs changed");
      throw new ScenarioMismatchError(`simulate request violates identical conditions: ${diffs.join("; ")}`);
    }
  }

  assertResult(res: SimResult): void {
    if (stable(Scenario.parse(res.scenario)) !== stable(this.scenario)) {
      throw new ScenarioMismatchError(
        `engine ran a different scenario: ${stable(res.scenario)} ≠ locked ${stable(this.scenario)}`,
      );
    }
  }
}
