import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import recording from "@/fixtures/replay/sample-run.json";
import type { AgentEvent } from "@/lib/agent/events";
import { Trajectories, type Layout } from "@/lib/engine/contract";
import { mockSimulate } from "@/lib/engine/mock";
import { replayTrajectoryUrl, simulateRequestFor } from "@/lib/trajectory/request";

const { events, engine } = recording as { events: AgentEvent[]; engine: "mock" | "http" };

describe("replay trajectory fixtures", () => {
  it("exist for every simulated iteration of the recording and match its run ids", () => {
    let run: Extract<AgentEvent, { type: "run" }>["data"] | undefined;
    const layouts = new Map<number, Layout>();
    let n = 0;
    for (const e of events) {
      if (e.type === "run") run = e.data;
      if (e.type === "layout") layouts.set(e.data.iteration, e.data.response.layout);
      if (e.type !== "sim") continue;
      const file = resolve(__dirname, "../public", `.${replayTrajectoryUrl(e.data.result.run_id)}`);
      expect(existsSync(file), file).toBe(true);
      const t = Trajectories.parse(JSON.parse(readFileSync(file, "utf8")));
      expect(t.run_id).toBe(e.data.result.run_id);
      expect(t.layout_id).toBe(e.data.result.layout_id);
      expect(t.dt).toBe(e.data.params.trajectory_dt);
      // the request the UI rebuilds yields the same run id (checkable offline only for a mock recording)
      if (engine === "mock") expect(mockSimulate(simulateRequestFor(run!, layouts.get(e.data.iteration)!, e.data)).run_id).toBe(t.run_id);
      n++;
    }
    expect(n).toBe(3);
  });
});
