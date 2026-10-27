/** Plain status line for Muse's typing indicator, from the step that is running. */
import type { RunInfo, StepInfo } from "@/lib/agent/events";

export function museStatus(steps: StepInfo[], run: RunInfo | undefined): string {
  const latest = [...new Map(steps.map((s) => [s.id, s])).values()];
  const running = latest.filter((s) => s.status === "running").pop();
  if (!running) return run ? "Thinking…" : "Getting started…";
  const visitors = run?.scenario.agents ?? 300;
  switch (running.step) {
    case "brief":
      return "Looking over the space…";
    case "generate":
      return running.iteration === 0 ? "Placing booths…" : "Rearranging booths…";
    case "validate":
      return "Checking walkways and exits…";
    case "simulate":
      return `Sending ${visitors} virtual visitors through…`;
    case "compare":
      return "Comparing with the last try…";
    case "analyze":
      return "Looking at where it got crowded…";
    case "revise":
      return "Working out a fix…";
    case "report":
      return "Writing up the summary…";
  }
}
