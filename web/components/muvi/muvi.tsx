"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/lib/i18n/provider";
import { MUVI_MODEL, MUVI_MOTIONS, type MuviMotion } from "@/lib/muvi/motions";

const MuviCanvas = dynamic(() => import("./muvi-canvas"), {
  ssr: false,
  loading: () => <Image src="/mascot/muvi-face.svg" alt="Muvi" width={120} height={120} className="m-auto"/>,
});
function subscribe(listener: () => void) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  document.addEventListener("visibilitychange", listener);
  return () => { media.removeEventListener("change", listener); document.removeEventListener("visibilitychange", listener); };
}
function shouldPause() { return document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches; }
const serverPaused = () => true;

export function MuviGreeting({ thinking = false }: { thinking?: boolean }) {
  const { locale } = useI18n();
  const paused = useSyncExternalStore(subscribe, shouldPause, serverPaused);
  return <Link href="/muvi" target="_blank" rel="noopener noreferrer" className="mx-auto flex w-48 shrink-0 flex-col items-center" aria-label={locale === "ko" ? "뮤비 3D 만나기 (새 탭)" : "Meet Muvi in 3D (new tab)"}>
    <div className="h-36 w-48" aria-hidden="true"><MuviCanvas compact motion={thinking ? "think" : "hello"} paused={paused}/></div>
    <span className="text-xs text-muted-foreground">{locale === "ko" ? "뮤비 만나기 ↗" : "Meet Muvi ↗"}</span>
  </Link>;
}

const labels = {
  ko: { idle: "대기", hello: "인사", walk: "걷기", run: "달리기", think: "생각", idea: "아이디어", cheer: "환호", rest: "휴식" },
  en: { idle: "Idle", hello: "Hello", walk: "Walk", run: "Run", think: "Think", idea: "Idea", cheer: "Cheer", rest: "Rest" },
};
export function MuviPlayground() {
  const { locale } = useI18n();
  const ko = locale === "ko";
  const [motion, setMotion] = useState<MuviMotion>("hello");
  const [stopped, setStopped] = useState(false);
  const [target, setTarget] = useState<[number, number, number] | null>(null);
  const [revision, setRevision] = useState(0);
  const systemPaused = useSyncExternalStore(subscribe, shouldPause, serverPaused);
  const paused = systemPaused || stopped;
  const move = (point: [number, number, number]) => { if (!paused) { setTarget(point); setMotion(motion === "run" ? "run" : "walk"); } };
  return <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-5 py-8">
    <header className="flex items-center justify-between gap-4"><Link href="/" className="text-sm font-semibold">muvilion</Link><Link href="/" className="text-sm underline underline-offset-4">{ko ? "스튜디오로 돌아가기" : "Back to studio"}</Link></header>
    <div className="flex flex-col gap-2"><p className="text-xs tracking-widest text-muted-foreground">MEET MUVI</p><h1 className="text-3xl font-semibold">{ko ? "작은 호기심, 함께 만드는 공간." : "A little curiosity. A space of our own."}</h1><p className="text-sm text-muted-foreground">{ko ? "인사하고, 생각하고, 함께 걸어요. 뮤비를 움직여 보세요." : "Wave, wonder and wander. Bring Muvi to life."}</p></div>
    <div className="relative h-[min(55vh,520px)] min-h-72 overflow-hidden rounded-3xl border border-border bg-sunken" tabIndex={0} role="group" aria-label={ko ? "뮤비 3D 보기. 방향키로 이동" : "Muvi 3D viewer. Arrow keys to move"} onKeyDown={event => {
      const directions: Record<string, [number, number, number]> = { ArrowLeft: [-2, 0, 0], ArrowRight: [2, 0, 0], ArrowUp: [0, 0, -2], ArrowDown: [0, 0, 2] };
      if (directions[event.key]) { event.preventDefault(); move(directions[event.key]); }
    }}>
      <MuviCanvas key={revision} motion={motion} paused={paused} target={target} onTarget={move} onArrive={() => { setTarget(null); setMotion("idle"); }}/>
    </div>
    <div className="flex flex-col items-center gap-4">
      <ToggleGroup className="flex-wrap justify-center" aria-label={ko ? "뮤비 동작" : "Muvi motion"} value={[motion]} variant="outline" onValueChange={values => { if (values[0]) { setTarget(null); setMotion(values[0] as MuviMotion); } }}>
        {MUVI_MOTIONS.map(value => <ToggleGroupItem key={value} value={value}>{labels[locale][value]}</ToggleGroupItem>)}
      </ToggleGroup>
      <p className="text-center text-xs text-muted-foreground" role="status">{systemPaused ? (ko ? "동작 줄이기 설정에 따라 정지 화면으로 표시합니다." : "Animation is paused for your motion preference.") : (ko ? "드래그로 회전 · 스크롤로 확대 · 바닥 클릭 또는 방향키로 이동" : "Drag to orbit · Scroll to zoom · Click the floor or use arrow keys to walk")}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" disabled={systemPaused} onClick={() => setStopped(value => !value)}>{stopped ? (ko ? "재생" : "Play") : (ko ? "일시정지" : "Pause")}</Button>
        <Button variant="outline" onClick={() => { setTarget(null); setMotion("hello"); setRevision(value => value + 1); }}>{ko ? "처음 위치로" : "Reset view"}</Button>
        <a href={MUVI_MODEL} download className="text-sm underline underline-offset-4">{ko ? "3D 모델 다운로드" : "Download 3D model"}</a>
        <a href="/mascot/muvi-face.svg" download className="text-sm underline underline-offset-4">{ko ? "2D 아이콘 다운로드" : "Download 2D icon"}</a>
      </div>
    </div>
  </main>;
}
