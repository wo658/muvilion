/**
 * Smoke test: can the configured model (Muse via Meta Model API by default) call two
 * tools in sequence through the AI SDK? Skips cleanly when no API key is set.
 *
 *   pnpm smoke:tools            (reads .env.local / .env if present)
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/agent/model";

for (const f of [".env.local", ".env"]) {
  const p = resolve(__dirname, "..", f);
  if (existsSync(p)) process.loadEnvFile(p);
}

async function main() {
  const m = getModel(process.env);
  if (!m.hasKey) {
    console.log(`[smoke-tools] SKIP: no API key for provider "${m.provider}" (set MODEL_API_KEY or BASETEN_API_KEY).`);
    return;
  }
  console.log(`[smoke-tools] provider=${m.provider} model=${m.modelId}`);
  const calls: string[] = [];
  const result = await generateText({
    model: m.model,
    instructions: "You are a tool-using assistant. Always use the tools; never guess values.",
    prompt:
      "Look up hall 'sample-hall' with get_hall, then call booth_capacity with that hall's width_m and height_m and booth_area_m2 = 9. Finally reply with one sentence stating the capacity returned by the tool.",
    tools: {
      get_hall: tool({
        description: "Get the dimensions of a hall by id.",
        inputSchema: z.object({ hall_id: z.string() }),
        execute: async ({ hall_id }) => {
          calls.push(`get_hall(${hall_id})`);
          return { hall_id, width_m: 40, height_m: 30 };
        },
      }),
      booth_capacity: tool({
        description: "Compute how many booths of a given area fit if 40% of the hall area is usable.",
        inputSchema: z.object({ width_m: z.number(), height_m: z.number(), booth_area_m2: z.number() }),
        execute: async ({ width_m, height_m, booth_area_m2 }) => {
          calls.push(`booth_capacity(${width_m}, ${height_m}, ${booth_area_m2})`);
          return { capacity: Math.floor((width_m * height_m * 0.4) / booth_area_m2) };
        },
      }),
    },
    stopWhen: isStepCount(5),
    timeout: 60_000,
  });
  const sequence = result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
  console.log("[smoke-tools] tool calls:", calls.join(" → ") || "(none)");
  console.log("[smoke-tools] steps:", result.steps.length, "sequence:", sequence.join(" → "));
  console.log("[smoke-tools] final text:", result.text);
  const ok = sequence.indexOf("get_hall") !== -1 && sequence.indexOf("booth_capacity") > sequence.indexOf("get_hall");
  console.log(ok ? "[smoke-tools] PASS" : "[smoke-tools] FAIL: expected get_hall then booth_capacity");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[smoke-tools] ERROR:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
