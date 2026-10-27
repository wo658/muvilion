/**
 * Regenerates web/fixtures/replay/sample-run.json by running the real agent loop
 * against the mock engine with the stub LLM. Usage: pnpm record:replay
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { recordSampleRun } from "@/lib/agent/recording";

async function main() {
  const rec = await recordSampleRun();
  const out = resolve(__dirname, "../fixtures/replay/sample-run.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(rec) + "\n");
  const done = rec.events.find((e) => e.type === "done");
  console.log(`wrote ${out}: ${rec.events.length} events`, done?.type === "done" ? done.data : "");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
