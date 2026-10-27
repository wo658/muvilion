/**
 * Regenerates web/fixtures/replay/sample-run.json by running the real agent loop
 * against the mock engine with the stub LLM, and writes each iteration's trajectories to
 * web/public/replay/traj/<run_id>.json (served statically to the 3D replay in replay mode).
 * Usage: pnpm record:replay
 *
 * Trajectories come from the mock engine for now; to record them from the real engine instead,
 * set TRAJ_ENGINE_URL=http://localhost:8000 (the agent recording itself stays mock + stub).
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { recordReplayTrajectories, recordSampleRun } from "@/lib/agent/recording";
import { createHttpEngine } from "@/lib/engine/client";
import { createMockEngine } from "@/lib/engine/mock";

async function main() {
  const rec = await recordSampleRun();
  const out = resolve(__dirname, "../fixtures/replay/sample-run.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(rec) + "\n");
  const done = rec.events.find((e) => e.type === "done");
  console.log(`wrote ${out}: ${rec.events.length} events`, done?.type === "done" ? done.data : "");

  const trajUrl = process.env.TRAJ_ENGINE_URL;
  const engine = trajUrl ? createHttpEngine({ baseUrl: trajUrl }) : createMockEngine();
  const trajs = await recordReplayTrajectories(rec, engine);
  const dir = resolve(__dirname, "../public/replay/traj");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith(".json")) rmSync(join(dir, f));
  for (const [runId, t] of trajs) {
    const file = join(dir, `${runId}.json`);
    writeFileSync(file, JSON.stringify(t) + "\n");
    console.log(`wrote ${file}: ${t.agents.length} agents, ${t.frames} frames, ${(statSync(file).size / 1024).toFixed(0)} KiB (${trajUrl ? "engine" : "mock"})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
