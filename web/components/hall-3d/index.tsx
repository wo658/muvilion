"use client";

/** Client-only entry points for the 3D hall (WebGL never runs during SSR/prerender). */
import dynamic from "next/dynamic";

const Placeholder = () => (
  <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[8px] border border-hairline bg-surface text-xs text-muted">
    Loading 3D view…
  </div>
);

export const Hall3DPanel = dynamic(() => import("./viewer").then((m) => m.Hall3DPanel), { ssr: false, loading: Placeholder });
export const Hall3DCompare = dynamic(() => import("./viewer").then((m) => m.Hall3DCompare), { ssr: false, loading: Placeholder });
export const Hall3DStage = dynamic(() => import("./viewer").then((m) => m.Hall3DStage), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-sunken/60" aria-label="Loading the 3D model" />,
});
export type { StageFocus, ViewSpec } from "./viewer";
