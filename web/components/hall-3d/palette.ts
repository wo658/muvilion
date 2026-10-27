"use client";

/** Scene colors for light/dark (mirrors the CSS variables in app/globals.css). */
import { useSyncExternalStore } from "react";

export type Palette = {
  background: string;
  floor: string;
  grid: string;
  wall: string;
  obstacle: string;
  popular: string;
  move: string;
  hotspot: string;
  labelBg: string;
  labelFg: string;
  door: { entrance: string; exit: string; emergency: string };
};

const LIGHT: Palette = {
  background: "#eef0f4",
  floor: "#fbfbfc",
  grid: "#c9ced8",
  wall: "#2b2f36",
  obstacle: "#9aa1ad",
  popular: "#7c2d12",
  move: "#7c3aed",
  hotspot: "#dc2626",
  labelBg: "rgba(255,255,255,0.85)",
  labelFg: "#3d2a00",
  door: { entrance: "#16a34a", exit: "#2563eb", emergency: "#dc2626" },
};

const DARK: Palette = {
  background: "#0e1014",
  floor: "#1b1f27",
  grid: "#2f3541",
  wall: "#c9ced8",
  obstacle: "#4b5260",
  popular: "#fdba74",
  move: "#a78bfa",
  hotspot: "#f87171",
  labelBg: "rgba(22,25,32,0.85)",
  labelFg: "#fde68a",
  door: { entrance: "#4ade80", exit: "#60a5fa", emergency: "#f87171" },
};

const query = "(prefers-color-scheme: dark)";

export function usePalette(): Palette {
  const dark = useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
  return dark ? DARK : LIGHT;
}
