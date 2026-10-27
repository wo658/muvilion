/**
 * Server-side builder of a planning-run UI message stream, shared by POST /api/agent and the
 * `intent: "run"` branch of POST /api/chat.
 *
 * - replay: streams the venue's recording (paced by `speed`; 0 = no delays);
 * - live: requires LIVE_AGENT=on (the kill switch), takes `project` (default: the venue's sample
 *   project), and holds a live-run cap slot (lib/agent/caps.ts) until the stream ends.
 *
 * Every event goes through the same encoder (lib/agent/stream.ts), so the assistant message has
 * the same parts whichever endpoint streamed it. `startMetadata` only adds message metadata to the
 * `start` chunk.
 */
import { createUIMessageStream } from "ai";
import indoorRecording from "@/fixtures/replay/sample-hall.json";
import outdoorRecording from "@/fixtures/replay/riverside-plaza.json";
import { ProjectInput, Scenario } from "@/lib/engine/contract";
import type { Env } from "@/lib/env";
import { DEFAULT_VENUE_ID, venueById } from "@/lib/venues";
import { acquireLiveRun } from "./caps";
import { applyScenarioOverride, applyVenueOverrides, liveAgentEnabled } from "./config";
import type { AgentEvent, AgentUIMessage, MuseMetadata } from "./events";
import { createAgentLLM, createRunDeps, runAgentLoop } from "./index";
import { asReplay, createEventEncoder, replayDelayMs } from "./stream";

const RECORDINGS: Record<string, { events: AgentEvent[] }> = {
  "sample-hall": indoorRecording as { events: AgentEvent[] },
  "riverside-plaza": outdoorRecording as { events: AgentEvent[] },
};

export type RunStreamInput = {
  mode?: string;
  speed?: number;
  venue?: string;
  project?: unknown;
  scenario?: unknown;
};

export type StreamError = { ok: false; status: number; error: string; message: string };
export type RunStreamResult = { ok: true; mode: "live" | "replay"; stream: ReadableStream } | StreamError;

/** A JSON error response for a rejected request (status, `{ error, message }`). */
export const errorResponse = (e: StreamError) => Response.json({ error: e.error, message: e.message }, { status: e.status });

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

export function startRunStream(
  input: RunStreamInput,
  opts: { signal: AbortSignal; env?: Env; startMetadata?: MuseMetadata },
): RunStreamResult {
  const env = opts.env ?? process.env;
  const { signal: reqSignal, startMetadata } = opts;
  const live = liveAgentEnabled(env);
  const mode = input.mode ?? (live ? "live" : "replay");
  const speed = Number(input.speed ?? 1);
  if (mode !== "live" && mode !== "replay") return { ok: false, status: 400, error: "bad_mode", message: `mode must be "live" or "replay"` };

  const venueId = input.venue ?? DEFAULT_VENUE_ID;
  const venue = venueById(venueId);
  if (!venue) return { ok: false, status: 400, error: "bad_venue", message: `unknown venue "${venueId}"` };
  const meta: MuseMetadata | undefined = startMetadata ? { ...startMetadata, mode: mode as "live" | "replay" } : undefined;

  if (mode === "replay") {
    const recording = RECORDINGS[venue.id];
    if (!recording) return { ok: false, status: 404, error: "no_recording", message: `no replay recorded for ${venue.id}` };
    const events = asReplay(recording.events);
    const stream = createUIMessageStream<AgentUIMessage>({
      execute: async ({ writer }) => {
        writer.write(meta ? { type: "start", messageMetadata: meta } : { type: "start" });
        const emit = createEventEncoder(writer);
        let prev: AgentEvent | undefined;
        for (const e of events) {
          if (reqSignal.aborted) break;
          await sleep(replayDelayMs(e, speed, prev), reqSignal);
          emit(e);
          prev = e;
        }
        emit.close();
        writer.write({ type: "finish" });
      },
    });
    return { ok: true, mode, stream };
  }

  if (!live) {
    return {
      ok: false,
      status: 403,
      error: "live_disabled",
      message: 'Live agent runs are disabled (LIVE_AGENT is not "on"). Use mode=replay.',
    };
  }

  const parsed = ProjectInput.safeParse(input.project ?? venue.project);
  if (!parsed.success) return { ok: false, status: 400, error: "bad_project", message: parsed.error.message };

  const scenario = input.scenario === undefined ? undefined : Scenario.safeParse(input.scenario);
  if (scenario && !scenario.success) return { ok: false, status: 400, error: "bad_scenario", message: scenario.error.message };

  const cap = acquireLiveRun(env);
  if (!cap.ok) return { ok: false, status: 429, error: "cap_reached", message: cap.reason };

  const deps = createRunDeps(env);
  const { engine } = deps;
  // The venue's scenario and target overrides apply when the project is that venue's.
  const config = applyScenarioOverride(applyVenueOverrides(deps.config, venueById(parsed.data.venue.id)), scenario?.success ? scenario.data : undefined);
  const timeoutS = Number(env.AGENT_RUN_TIMEOUT_S ?? 280);
  const signal = AbortSignal.any([reqSignal, AbortSignal.timeout(timeoutS * 1000)]);

  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      writer.write(meta ? { type: "start", messageMetadata: meta } : { type: "start" });
      const emit = createEventEncoder(writer);
      try {
        const llm = createAgentLLM(env, config, (what, err) =>
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
  return { ok: true, mode, stream };
}
