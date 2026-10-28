"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useMotionPaused } from "./use-motion-paused";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { MUVI_MODEL, MUVI_MOTIONS, type MuviMotion } from "@/lib/muvi/motions";

const MuviCanvas = dynamic(() => import("./muvi-canvas"), {
  ssr: false,
  loading: () => <Image src="/mascot/muvi-face.svg" alt="Muvi" width={120} height={120} className="m-auto"/>,
});

export function MuviGreeting({ thinking = false }: { thinking?: boolean }) {
  const { t } = useI18n();
  const paused = useMotionPaused();
  return <Link href="/muvi" target="_blank" rel="noopener noreferrer" className="mx-auto flex w-48 shrink-0 flex-col items-center" aria-label={t("Meet Muvi in 3D (new tab)")}>
    <div className="h-36 w-48" aria-hidden="true"><MuviCanvas compact motion={thinking ? "think" : "hello"} paused={paused}/></div>
    <span className="text-xs text-muted-foreground">{t("Meet Muvi ↗")}</span>
  </Link>;
}

const labels = { idle: "Idle", hello: "Hello", walk: "Walk", run: "Run", think: "Think", idea: "Idea", cheer: "Cheer", rest: "Rest" } as const satisfies Record<MuviMotion, MessageKey>;
export function MuviPlayground() {
  const { t } = useI18n();
  const [motion, setMotion] = useState<MuviMotion>("hello");
  const [stopped, setStopped] = useState(false);
  const [target, setTarget] = useState<[number, number, number] | null>(null);
  const [revision, setRevision] = useState(0);
  const systemPaused = useMotionPaused();
  const paused = systemPaused || stopped;
  const move = (point: [number, number, number]) => { if (!paused) { setTarget(point); setMotion(motion === "run" ? "run" : "walk"); } };
  return <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-5 py-8">
    <header className="flex items-center justify-between gap-4"><Link href="/" className="text-sm font-semibold">muvilion</Link><Link href="/" className="text-sm underline underline-offset-4">{t("Back to studio")}</Link></header>
    <div className="flex flex-col gap-2"><p className="text-xs tracking-widest text-muted-foreground">MEET MUVI</p><h1 className="text-3xl font-semibold">{t("A little curiosity. A space of our own.")}</h1><p className="text-sm text-muted-foreground">{t("Wave, wonder and wander. Bring Muvi to life.")}</p></div>
    <div className="relative h-[min(55vh,520px)] min-h-72 overflow-hidden rounded-3xl border border-border bg-sunken" tabIndex={0} role="group" aria-label={t("Muvi 3D viewer. Arrow keys to move")} onKeyDown={event => {
      const directions: Record<string, [number, number, number]> = { ArrowLeft: [-2, 0, 0], ArrowRight: [2, 0, 0], ArrowUp: [0, 0, -2], ArrowDown: [0, 0, 2] };
      if (directions[event.key]) { event.preventDefault(); move(directions[event.key]); }
    }}>
      <MuviCanvas key={revision} motion={motion} paused={paused} target={target} onTarget={move} onArrive={() => { setTarget(null); setMotion("idle"); }}/>
    </div>
    <div className="flex flex-col items-center gap-4">
      <ToggleGroup className="flex-wrap justify-center" aria-label={t("Muvi motion")} value={[motion]} variant="outline" onValueChange={values => { if (values[0]) { setTarget(null); setMotion(values[0] as MuviMotion); } }}>
        {MUVI_MOTIONS.map(value => <ToggleGroupItem key={value} value={value}>{t(labels[value])}</ToggleGroupItem>)}
      </ToggleGroup>
      <p className="text-center text-xs text-muted-foreground" role="status">{systemPaused ? t("Animation is paused for your motion preference.") : t("Drag to orbit · Scroll to zoom · Click the floor or use arrow keys to walk")}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" disabled={systemPaused} onClick={() => setStopped(value => !value)}>{stopped ? t("Play") : t("Pause")}</Button>
        <Button variant="outline" onClick={() => { setTarget(null); setMotion("hello"); setRevision(value => value + 1); }}>{t("Reset view")}</Button>
        <a href={MUVI_MODEL} download className="text-sm underline underline-offset-4">{t("Download 3D model")}</a>
        <a href="/mascot/muvi-face.svg" download className="text-sm underline underline-offset-4">{t("Download 2D icon")}</a>
      </div>
    </div>
  </main>;
}
