"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/lib/i18n/provider";
import { MUVI_MODEL } from "@/lib/muvi/motions";
import { useMotionPaused } from "./use-motion-paused";

const Canvas = dynamic(() => import("./muvi-canvas"), { ssr: false });
const studies = [
  { motion: "sketch", title: "Sketch", description: "Sketch a floor plan with a pencil.", number: "01" },
  { motion: "measure", title: "Measure", description: "Stretch a tape and check the proportions.", number: "02" },
  { motion: "partition", title: "Raise a partition", description: "Lean in, lift the panel, and set it upright.", number: "03" },
  { motion: "paint", title: "Paint", description: "Roll the finish with an easy, steady rhythm.", number: "04" },
] as const;

export function MuviGallery() {
  const { t, locale, setLocale } = useI18n();
  const [selected, setSelected] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [hidden, setHidden] = useState(false);
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
      <p className="text-sm text-muted">{t("Decorative motion studies, independent of drawing edits.")}</p>
    </header>
    <section className="grid gap-6 md:grid-cols-[1fr_260px]" aria-label={t("Muvi motion gallery")}>
      <div className="relative h-[min(58vh,540px)] min-h-80 overflow-hidden rounded-3xl border border-hairline bg-sunken" role="img" aria-label={t(study.title)}>
        {!hidden && <Canvas key={`${study.motion}-${revision}`} motion={study.motion} paused={paused}/>}
      </div>
      <div className="flex flex-col justify-center gap-5">
        <p className="text-xs text-muted">{study.number} / 04 · 4 s</p>
        <h2 className="text-2xl font-semibold">{t(study.title)}</h2>
        <p className="text-sm leading-relaxed text-muted">{t(study.description)}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={systemPaused || hidden} onClick={() => setStopped(value => !value)}>{t(stopped ? "Play" : "Pause")}</Button>
          <Button variant="outline" disabled={hidden} onClick={() => setRevision(value => value + 1)}>{t("Replay")}</Button>
          <Button variant="ghost" onClick={() => setHidden(value => !value)}>{t(hidden ? "Show preview" : "Hide preview")}</Button>
        </div>
        <p className="text-xs text-muted" role="status">{systemPaused ? t("Animation is paused for your motion preference.") : t("Drag to orbit · Scroll to zoom")}</p>
        <a href={MUVI_MODEL} download className="text-sm underline underline-offset-4">{t("Download 3D model")}</a>
      </div>
    </section>
    <ToggleGroup value={[study.motion]} onValueChange={values => { const index = studies.findIndex(item => item.motion === values[0]); if (index >= 0) setSelected(index); }} variant="outline" className="grid w-full grid-cols-2 gap-3 md:grid-cols-4" aria-label={t("Muvi motion")}>
      {studies.map(item => <ToggleGroupItem key={item.motion} value={item.motion} className="h-auto flex-col items-start gap-3 whitespace-normal p-4 text-left">
        <span className="text-xs text-muted">{item.number} / 4 s</span>
        <span>{t(item.title)}</span>
        <span className="text-xs font-normal leading-relaxed text-muted">{t(item.description)}</span>
      </ToggleGroupItem>)}
    </ToggleGroup>
  </main>;
}
