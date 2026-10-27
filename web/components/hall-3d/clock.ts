/**
 * Shared playback clock (simulated seconds). Mutable and outside React so every canvas reads the
 * same `t` inside useFrame without re-rendering; React UI subscribes for coarse updates.
 * The clock advances from one requestAnimationFrame loop (usePlaybackLoop), never from a canvas,
 * so side-by-side canvases always show the same moment.
 */
import { useEffect, useSyncExternalStore } from "react";

export type ClockState = { t: number; playing: boolean; speed: number; loop: boolean; duration: number };

export type Clock = ClockState & {
  /** Bumped on every change (seek, play/pause, tick). */
  version: number;
  set(patch: Partial<ClockState>): void;
  subscribe(fn: () => void): () => void;
};

export const SPEEDS = [1, 5, 20] as const;

export function createClock(init: Partial<ClockState> = {}): Clock {
  const listeners = new Set<() => void>();
  const clock: Clock = {
    t: 0,
    playing: false,
    speed: 5,
    loop: true,
    duration: 300,
    ...init,
    version: 0,
    set(patch) {
      Object.assign(clock, patch);
      clock.t = Math.min(Math.max(0, clock.t), clock.duration);
      clock.version++;
      for (const l of listeners) l();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
  return clock;
}

/** Advance `clock` in real time while playing (speed × wall seconds), looping or stopping at the end. */
export function usePlaybackLoop(clock: Clock) {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const wall = Math.min(0.25, (now - last) / 1000); // clamp tab-switch gaps
      last = now;
      if (clock.playing && clock.duration > 0) {
        let t = clock.t + wall * clock.speed;
        if (t >= clock.duration) {
          if (clock.loop) t = 0;
          else {
            clock.set({ t: clock.duration, playing: false });
            raf = requestAnimationFrame(frame);
            return;
          }
        }
        clock.set({ t });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
}

/**
 * Coarse React view of the clock: re-renders at most every `stepS` simulated seconds while
 * playing (and on every seek / setting change), so the scrubber does not re-render at 60 fps.
 */
export function useClockView(clock: Clock, stepS = 0.5): ClockState {
  const key = useSyncExternalStore(
    clock.subscribe,
    () => `${Math.floor(clock.t / stepS)}|${clock.playing}|${clock.speed}|${clock.loop}|${clock.duration}|${clock.t === 0 || clock.t === clock.duration}`,
    () => "ssr",
  );
  void key;
  return { t: clock.t, playing: clock.playing, speed: clock.speed, loop: clock.loop, duration: clock.duration };
}
