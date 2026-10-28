"use client";
import { useSyncExternalStore } from "react";
function subscribe(listener: () => void) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  document.addEventListener("visibilitychange", listener);
  return () => { media.removeEventListener("change", listener); document.removeEventListener("visibilitychange", listener); };
}
function shouldPause() { return document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches; }
const serverPaused = () => true;

export function useMotionPaused() { return useSyncExternalStore(subscribe, shouldPause, serverPaused); }
