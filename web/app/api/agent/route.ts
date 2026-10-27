/**
 * Agent endpoint.
 *   GET  /api/agent              → status (is live mode enabled, engine/LLM kinds)
 *   POST /api/agent[?mode=replay|live][&speed=1][&venue=<venue id>]
 *        body (optional): { mode?, speed?, venue?, project?: ProjectInput }  (useChat also sends `messages`, ignored)
 * Streams an AI SDK UI message stream with typed `data-*` parts (see lib/agent/events.ts).
 * Live runs require LIVE_AGENT=on and use `project` (default: the venue's sample project);
 * replays stream the recording of `venue` (default: the indoor hall).
 */
import { createUIMessageStreamResponse } from "ai";
import { connection } from "next/server";
import { capStatus } from "@/lib/agent/caps";
import { liveAgentEnabled, loadAgentConfig } from "@/lib/agent/config";
import { getModel } from "@/lib/agent/model";
import { errorResponse, startRunStream } from "@/lib/agent/run-stream";

export const maxDuration = 300;

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
  const body = (await req.json().catch(() => ({}))) as { mode?: string; speed?: number; venue?: string; project?: unknown };
  const speed = url.searchParams.get("speed");
  const run = startRunStream(
    {
      mode: url.searchParams.get("mode") ?? body.mode,
      speed: speed !== null ? Number(speed) : body.speed,
      venue: url.searchParams.get("venue") ?? body.venue,
      project: body.project,
    },
    { signal: req.signal },
  );
  if (!run.ok) return errorResponse(run);
  return createUIMessageStreamResponse({ stream: run.stream, headers: { "x-agent-mode": run.mode } });
}
