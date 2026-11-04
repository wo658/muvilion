// Shared morphing panel and composer from the 2026-11-03 Kimi-inspired teaser.
import React from "react";
import { AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
import muviFace from "../../web/public/mascot/muvi-face.svg";
const font = '"SF Pro Display",Arial,sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const smooth = { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) };
const m = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], smooth);

const sfx = (file: string) => staticFile(`launch/${file}`);

const MORPH = 18;

type Box = { w: number; h: number; cy: number; r: number };
const FULL: Box = { w: 1920, h: 1080, cy: 540, r: 0 };
const COMPOSER: Box = { w: 1240, h: 400, cy: 540, r: 40 };
const PILL: Box = { w: 780, h: 120, cy: 540, r: 60 };
const CARD: Box = { w: 1560, h: 816, cy: 566, r: 32 };
const lerp = (a: Box, b: Box, t: number): Box => ({
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
  cy: a.cy + (b.cy - a.cy) * t,
  r: a.r + (b.r - a.r) * t,
});


function Panel({
  frames,
  from,
  rest,
  to,
  children,
}: {
  frames: number;
  from?: Box;
  rest: Box;
  to?: Box;
  children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const enter = from ? m(f, 0, MORPH, 0, 1) : 1;
  const exit = to ? m(f, frames - MORPH, frames, 0, 1) : 0;
  let box = from ? lerp(from, rest, enter) : rest;
  if (to) box = lerp(box, to, exit);
  const fade = from ? 1 : m(f, 0, 14, 0, 1);
  const out = to ? 1 : m(f, frames - 14, frames, 1, 0);
  // Content fades with a shape change; a same-shape handoff is a quick
  // crossfade, and growing into or out of full bleed keeps the picture.
  const enterFade =
    !from || from === FULL
      ? 1
      : from === rest
        ? m(f, 0, 8, 0, 1)
        : m(f, MORPH * 0.4, MORPH, 0, 1);
  const exitFade =
    !to || to === FULL
      ? 1
      : to === rest
        ? m(f, frames - 6, frames, 1, 0.6)
        : m(f, frames - MORPH, frames - MORPH * 0.4, 1, 0);
  const content = enterFade * exitFade;
  const scale = Math.max(box.w / rest.w, box.h / rest.h);
  return (
    <div
      style={{
        position: "absolute",
        left: 960 - box.w / 2,
        top: box.cy - box.h / 2,
        width: box.w,
        height: box.h,
        borderRadius: box.r,
        overflow: "hidden",
        background: T.surface,
        border: box.r > 1 ? `1px solid ${T.hairline}` : "none",
        boxShadow: box.r > 1 ? `0 30px 90px ${T.shadowColor}` : "none",
        opacity: fade * out,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: (box.w - rest.w * scale) / 2,
          top: (box.h - rest.h * scale) / 2,
          width: rest.w,
          height: rest.h,
          transformOrigin: "0 0",
          scale,
          opacity: content,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Muvi({ size }: { size: number }) {
  return <Img src={muviFace} style={{ width: size, height: size }} />;
}


const PROMPT =
  "Turn this floor plan into a pop-up experience. Bring the brief, the brand and the visitor journey together.";
const SOURCES = [
  { label: "Floor plan", src: staticFile("launch-current/floor-plan.png") },
  { label: "Brief", src: staticFile("launch-current/popup-report.png") },
  { label: "Brand", src: staticFile("launch-current/fitting-bar.webp") },
];
const SEND = 236;

// A centered composer: sources drop in, the request is typed and sent, and
// the composer folds into the first status pill.
function Prompt({ frames }: { frames: number }) {
  const f = useCurrentFrame();
  const typed = Math.round(
    interpolate(f, [60, 200], [0, PROMPT.length], clamp),
  );
  const sent = m(f, SEND, SEND + 14, 0, 1);
  return (
    <AbsoluteFill style={{ background: T.bg, fontFamily: font, color: T.ink }}>
      <Panel frames={frames} from={COMPOSER} rest={COMPOSER} to={PILL}>
        <div
          style={{
            width: COMPOSER.w,
            height: COMPOSER.h,
            padding: "44px 52px 36px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", gap: 18, marginBottom: 26 }}>
            {SOURCES.map((s, i) => {
              const t = m(f, 8 + i * 10, 38 + i * 10, 0, 1);
              return (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "10px 20px 10px 10px",
                    borderRadius: 18,
                    background: T.sunken,
                    opacity: t,
                    translate: `0 ${(1 - t) * -70}px`,
                  }}
                >
                  <Img
                    src={s.src}
                    style={{
                      width: 76,
                      height: 54,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: `1px solid ${T.hairline}`,
                    }}
                  />
                  <span style={{ fontSize: 24, color: T.inkSoft }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              fontSize: 46,
              lineHeight: 1.3,
              letterSpacing: -0.8,
              flex: 1,
            }}
          >
            {typed === 0 ? (
              <span style={{ color: T.muted }}>Describe the space…</span>
            ) : (
              PROMPT.slice(0, typed)
            )}
            {f >= 50 && f < SEND && Math.floor(f / 15) % 2 === 0 && (
              <span style={{ color: T.accent }}>|</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 40, color: T.muted, width: 40 }}>+</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 20px 8px 10px",
                borderRadius: 999,
                background: T.accentSoft,
                color: T.accent,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              <Muvi size={34} /> Muse · Design
            </div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                background: typed === PROMPT.length ? T.accent : T.sunken,
                color: T.accentInk,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                scale: 1 - Math.sin(sent * Math.PI) * 0.14,
              }}
            >
              ↑
            </div>
          </div>
        </div>
      </Panel>
      <Sequence from={56} durationInFrames={150}>
        <Audio src={staticFile("designer-ad/photo-typing.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={SEND}>
        <Audio src={sfx("pop.wav")} volume={0.7} />
      </Sequence>
    </AbsoluteFill>
  );
}

// A status pill with a shimmering line; it grows into whatever comes next.
function Status({
  frames,
  text,
  to,
}: {
  frames: number;
  text: string;
  to?: Box;
}) {
  const f = useCurrentFrame();
  const sweep = interpolate(f, [0, frames - MORPH], [-40, 140], clamp);
  return (
    <AbsoluteFill style={{ background: T.bg, fontFamily: font }}>
      <Panel frames={frames} from={PILL} rest={PILL} to={to}>
        <div
          style={{
            width: PILL.w,
            height: PILL.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <Muvi size={52} />
          <span
            style={{
              fontSize: 40,
              letterSpacing: -0.6,
              fontWeight: 500,
              backgroundImage: `linear-gradient(100deg, ${T.ink} ${sweep - 30}%, ${T.faint} ${sweep}%, ${T.ink} ${sweep + 30}%)`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            {text}
          </span>
        </div>
      </Panel>
      <Audio src={sfx("chime.wav")} volume={0.6} />
    </AbsoluteFill>
  );
}


function End() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        fontFamily: font,
        color: T.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 30,
          opacity: m(f, 0, 16, 0, 1),
          scale: m(f, 0, 40, 0.92, 1),
        }}
      >
        <Muvi size={120} />
        <span style={{ fontSize: 120, fontWeight: 650, letterSpacing: -5 }}>
          muvilion
        </span>
      </div>
      <div
        style={{
          marginTop: 34,
          fontSize: 38,
          color: T.inkSoft,
          opacity: m(f, 24, 44, 0, 1),
        }}
      >
        Ideas become spaces.
      </div>
      <Audio src={sfx("hit.wav")} volume={0.8} />
    </AbsoluteFill>
  );
}


export { Panel, Prompt, Status, End, FULL, COMPOSER, CARD };
