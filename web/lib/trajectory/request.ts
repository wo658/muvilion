/**
 * Rebuilds the exact SimulateRequest of one iteration from the agent stream (data-run +
 * data-layout + data-sim), so POST /trajectories returns tracks with the same run_id as the
 * SimResult already on screen. Shared by the UI and scripts/record-replay.ts.
 */
import type { RunInfo, SimInfo } from "@/lib/agent/events";
import type { Layout, SimulateRequestInput } from "@/lib/engine/contract";

export function simulateRequestFor(
  run: Pick<RunInfo, "venue" | "booths" | "gridCell">,
  layout: Layout,
  sim: Pick<SimInfo, "result"> & { params?: SimInfo["params"] },
): SimulateRequestInput {
  return {
    venue: run.venue,
    layout,
    booths: run.booths,
    scenario: sim.result.scenario,
    grid_cell: sim.params?.grid_cell ?? run.gridCell,
    max_wall_time_s: sim.params?.max_wall_time_s ?? 60,
    trajectory_dt: sim.params?.trajectory_dt ?? 0.5,
    crowd_threshold: sim.params?.crowd_threshold ?? sim.result.congestion?.threshold ?? 2,
  };
}

/** Static replay fixture path (served from web/public). */
export function replayTrajectoryUrl(runId: string): string {
  return `/replay/traj/${encodeURIComponent(runId)}.json`;
}
