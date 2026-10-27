"use client";

/** Client-only entry points for the 3D hall (WebGL never runs during SSR/prerender). */
import dynamic from "next/dynamic";

const Placeholder = () => (
  <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-[var(--border)] text-xs text-[var(--muted)]">
    Loading 3D view…
  </div>
);

export const Hall3DPanel = dynamic(() => import("./viewer").then((m) => m.Hall3DPanel), { ssr: false, loading: Placeholder });
export const Hall3DCompare = dynamic(() => import("./viewer").then((m) => m.Hall3DCompare), { ssr: false, loading: Placeholder });
export type { ViewSpec } from "./viewer";
