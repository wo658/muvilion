/**
 * Agent endpoint.
 *   GET  /api/agent              → status (is live mode enabled, engine/LLM kinds)
 *   POST /api/agent[?mode=replay|live][&speed=1]
 *        body (optional): { mode?, speed?, project?: ProjectInput }  (useChat also sends `messages`, ignored)
 * Streams an AI SDK UI message stream with typed `data-*` parts (see lib/agent/events.ts).
 * Live runs require LIVE_AGENT=on; otherwise only replay of the recorded sample run is served.
 */
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { connection } from "next/server";
import sample from "@/fixtures/sample_hall.json";
import recording from "@/fixtures/replay/sample-run.json";
import { createAgentLLM, createRunDeps, runAgentLoop } from "@/lib/agent";
import { acquireLiveRun, capStatus } from "@/lib/agent/caps";
import { liveAgentEnabled, loadAgentConfig } from "@/lib/agent/config";
import type { AgentEvent, AgentUIMessage } from "@/lib/agent/events";
import { asReplay, createEventEncoder, replayDelayMs } from "@/lib/agent/stream";
import { getModel } from "@/lib/agent/model";
import { ProjectInput } from "@/lib/engine/contract";

export const maxDuration = 300;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

export async function GET() {
  await connection();
  const env = process.env;
  const m = getModel(env);
  return Response.json({
    live: liveAgentEnabled(env),
    engine: env.ENGINE_MOCK === "1" || env.ENGINE_MOCK === "true" ? "mock" : "http",
    llm: env.AGENT_LLM === "stub" ? "stub" : `${m.provider}:${m.modelId}`,
    hasModelKey: m.hasKey,
    maxIterations: loadAgentConfig(env).maxIterations,
    caps: capStatus(),
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { mode?: string; speed?: number; project?: unknown };
  const live = liveAgentEnabled();
  const mode = url.searchParams.get("mode") ?? body.mode ?? (live ? "live" : "replay");
  const speed = Number(url.searchParams.get("speed") ?? body.speed ?? 1);

  if (mode !== "live" && mode !== "replay") {
    return Response.json({ error: "bad_mode", message: `mode must be "live" or "replay"` }, { status: 400 });
  }

  if (mode === "replay") {
    const events = asReplay((recording as { events: AgentEvent[] }).events);
    const stream = createUIMessageStream<AgentUIMessage>({
      execute: async ({ writer }) => {
        writer.write({ type: "start" });
        const emit = createEventEncoder(writer);
        for (const e of events) {
          if (req.signal.aborted) break;
          await sleep(replayDelayMs(e, speed), req.signal);
          emit(e);
        }
        emit.close();
        writer.write({ type: "finish" });
      },
    });
    return createUIMessageStreamResponse({ stream, headers: { "x-agent-mode": "replay" } });
  }

  if (!live) {
    return Response.json(
      { error: "live_disabled", message: "Live agent runs are disabled (LIVE_AGENT is not \"on\"). Use mode=replay." },
      { status: 403 },
    );
  }

  const parsed = ProjectInput.safeParse(body.project ?? sample);
  if (!parsed.success) {
    return Response.json({ error: "bad_project", message: parsed.error.message }, { status: 400 });
  }

  const cap = acquireLiveRun();
  if (!cap.ok) return Response.json({ error: "cap_reached", message: cap.reason }, { status: 429 });

  const { config, engine } = createRunDeps();
  const timeoutS = Number(process.env.AGENT_RUN_TIMEOUT_S ?? 280);
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(timeoutS * 1000)]);

  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      const emit = createEventEncoder(writer);
      try {
        const llm = createAgentLLM(process.env, config, (what, err) =>
          emit({
            type: "error",
            data: {
              message: `model call "${what}" failed (${err instanceof Error ? err.message : String(err)}); used the rule-based fallback for this step`,
              recoverable: true,
            },
          }),
        );
        await runAgentLoop({
          project: parsed.data,
          engine,
          llm,
          config,
          emit,
          runId: crypto.randomUUID(),
          mode: "live",
          signal,
        });
      } catch (err) {
        emit({ type: "error", data: { message: err instanceof Error ? err.message : String(err), recoverable: false } });
      } finally {
        cap.release();
        emit.close();
        writer.write({ type: "finish" });
      }
    },
    onError: (err) => (err instanceof Error ? err.message : String(err)),
  });
  return createUIMessageStreamResponse({ stream, headers: { "x-agent-mode": "live" } });
}
