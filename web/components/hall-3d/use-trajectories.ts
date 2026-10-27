"use client";

/**
 * Loads Trajectories for one iteration. Replay runs read the static fixture
 * (/replay/traj/<run_id>.json); live runs POST the iteration's exact SimulateRequest to
 * /api/trajectories (same request → same run_id → engine cache hit). Results are cached per run_id
 * for the page lifetime; failures are not cached so "Retry" refetches.
 */
import { useEffect, useState } from "react";
import { Trajectories, type SimulateRequestInput } from "@/lib/engine/contract";
import { replayTrajectoryUrl } from "@/lib/trajectory/request";

export type TrajectorySource = { runId: string; mode: "live" | "replay"; request: SimulateRequestInput };

const cache = new Map<string, Promise<Trajectories>>();

async function fetchTrajectories(src: TrajectorySource): Promise<Trajectories> {
  const res =
    src.mode === "replay"
      ? await fetch(replayTrajectoryUrl(src.runId))
      : await fetch(`/api/trajectories?expect=${encodeURIComponent(src.runId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(src.request),
        });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${res.status} loading trajectories for ${src.runId}`);
  }
  const parsed = Trajectories.safeParse(await res.json());
  if (!parsed.success) throw new Error(`trajectories for ${src.runId} do not match the contract`);
  return parsed.data;
}

export function loadTrajectories(src: TrajectorySource): Promise<Trajectories> {
  const key = `${src.mode}:${src.runId}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchTrajectories(src);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export type TrajectoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: Trajectories }
  | { status: "error"; error: string; retry: () => void };

export function useTrajectories(src: TrajectorySource | undefined): TrajectoryState {
  const key = src ? `${src.mode}:${src.runId}` : "";
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; data?: Trajectories; error?: string } | null>(null);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    loadTrajectories(src).then(
      (data) => alive && setResult({ key, attempt, data }),
      (e: unknown) => alive && setResult({ key, attempt, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
    // src identity changes every render; the key captures what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  if (!src) return { status: "idle" };
  if (!result || result.key !== key || result.attempt !== attempt) return { status: "loading" };
  if (result.data) return { status: "ready", data: result.data };
  return { status: "error", error: result.error ?? "unknown error", retry: () => setAttempt((a) => a + 1) };
}
