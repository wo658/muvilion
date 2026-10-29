"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/lib/i18n/provider";
import { MUVI_MODEL, MUVI_DESIGNER_DURATION } from "@/lib/muvi/motions";
import { useMotionPaused } from "./use-motion-paused";

const Canvas = dynamic(() => import("./muvi-canvas"), { ssr: false });
const studies = [
  { motion: "inspect", title: "Inspect space", description: "Look around, compare areas, and lean toward a detail.", number: "01" },
  { motion: "measure", title: "Measure", description: "Pull the tape, check the marks, and zip it back.", number: "02" },
  { motion: "arrange", title: "Hammer", description: "Lift at the wrist, tap the same spot, and rebound.", number: "03" },
  { motion: "paint", title: "Paint", description: "Swish, swish! Big brush strokes with a little bounce.", number: "04" },
] as const;

export function MuviGallery() {
  const { t, locale, setLocale } = useI18n();
  const [selected, setSelected] = useState(2);
  const [stopped, setStopped] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [heading, setHeading] = useState("left");
  const workHeading = heading === "right" ? Math.PI / 4 : heading === "left" ? -Math.PI / 4 : Math.PI;
  const [revision, setRevision] = useState(0);
  const systemPaused = useMotionPaused();
  const paused = stopped || systemPaused;
  const study = studies[selected];
  return <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-7 px-5 py-8 text-ink">
    <nav className="flex items-center justify-between gap-4">
      <Link href="/muvi" className="font-semibold">Muvi / Motion studies</Link>
      <Button variant="outline" onClick={() => setLocale(locale === "ko" ? "en" : "ko")}>{locale === "ko" ? "Eng" : "한국어"}</Button>
    </nav>
    <header className="flex flex-col gap-2">
      <p className="text-xs tracking-widest text-muted">{t("Designer studies · 4 looping motions")}</p>
      <h1 className="text-3xl font-semibold">{t("A spatial designer at work.")}</h1>
      <p className="text-sm text-muted">{t("Reusable gestures for Muse at work, independent of the final result.")}</p>
    </header>
    <section className="grid gap-6 md:grid-cols-[1fr_260px]" aria-label={t("Muvi motion gallery")}>
      <div className="relative h-[min(58vh,540px)] min-h-80 overflow-hidden rounded-3xl border border-hairline bg-sunken" role="img" aria-label={t(study.title)}>
        {!hidden && <Canvas key={`${study.motion}-${revision}`} motion={study.motion} paused={paused} workHeading={workHeading}/>}
      </div>
      <div className="flex flex-col justify-center gap-5">
        <p className="text-xs text-muted">{study.number} / 04 · {MUVI_DESIGNER_DURATION} s</p>
        <h2 className="text-2xl font-semibold">{t(study.title)}</h2>
        <p className="text-sm leading-relaxed text-muted">{t(study.description)}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={systemPaused || hidden} onClick={() => setStopped(value => !value)}>{t(stopped ? "Play" : "Pause")}</Button>
          <Button variant="outline" disabled={hidden} onClick={() => setRevision(value => value + 1)}>{t("Replay")}</Button>
          <Button variant="ghost" onClick={() => setHidden(value => !value)}>{t(hidden ? "Show preview" : "Hide preview")}</Button>
        </div>
        <p className="text-xs text-muted" role="status">{systemPaused ? t("Animation is paused for your motion preference.") : t("Drag to orbit · Scroll to zoom")}</p>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">{t("Work direction")}</p>
          <ToggleGroup value={[heading]} variant="outline" aria-label={t("Work direction")} onValueChange={values => { if (values[0]) setHeading(values[0]); }}>
            <ToggleGroupItem value="left">{t("Left")}</ToggleGroupItem>
            <ToggleGroupItem value="right">{t("Right")}</ToggleGroupItem>
            <ToggleGroupItem value="back">{t("Away")}</ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted">{t("The floor marker indicates the work direction, not a generated object.")}</p>
        </div>
        <a href={MUVI_MODEL} download className="text-sm underline underline-offset-4">{t("Download 3D model")}</a>
      </div>
    </section>
    <ToggleGroup value={[study.motion]} onValueChange={values => { const index = studies.findIndex(item => item.motion === values[0]); if (index >= 0) setSelected(index); }} variant="outline" className="grid w-full grid-cols-2 gap-3 md:grid-cols-4" aria-label={t("Muvi motion")}>
      {studies.map(item => <ToggleGroupItem key={item.motion} value={item.motion} className="h-auto flex-col items-start gap-3 whitespace-normal p-4 text-left">
        <span className="text-xs text-muted">{item.number} / {MUVI_DESIGNER_DURATION} s</span>
        <span>{t(item.title)}</span>
        <span className="text-xs font-normal leading-relaxed text-muted">{t(item.description)}</span>
      </ToggleGroupItem>)}
    </ToggleGroup>
  </main>;
}
