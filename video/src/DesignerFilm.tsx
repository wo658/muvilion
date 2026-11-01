import {
  AbsoluteFill,
  Sequence,
  interpolate,
  Easing,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
import traces from "./DesignerMinuteTraces";
import { ContinuousReveal } from "./ContinuousReveal";
import {
  PhotoPrompt,
  PhotoFinish,
  LiquidBridge,
  TypeBeat,
} from "./DesignerLiquidPhoto";
import { AdEnd } from "./DesignerAdSpace";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const smooth = { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) };
const mix = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], smooth);
const asset = (file: string) => staticFile(`designer-minute/${file}`);
function Pointer({ clip, rate = 1 }: { clip: string; rate?: number }) {
  const f = useCurrentFrame();
  const t = (f / 30) * rate;
  const events = traces[clip] ?? [];
  if (!events.length) return null;
  let previous = {
    ...events[0],
    x: events[0].x - 120,
    y: events[0].y + 70,
    time: 0,
  };
  let next = events[0];
  for (let i = 0; i < events.length; i++) {
    if (events[i].time <= t) {
      previous = events[i];
      next = events[i + 1] ?? events[i];
    } else {
      next = events[i];
      break;
    }
  }
  const x = mix(
    t,
    Math.max(previous.time, next.time - 0.5),
    next.time + 0.001,
    previous.x,
    next.x,
  );
  const y = mix(
    t,
    Math.max(previous.time, next.time - 0.5),
    next.time + 0.001,
    previous.y,
    next.y,
  );
  const clicked = events.find(
    (e) => e.click && t >= e.time && t < e.time + 0.45,
  );
  const pulse = clicked ? (t - clicked.time) / 0.45 : 0;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: mix(f, 0, 6, 0, 1),
      }}
    >
      {clicked && (
        <div
          style={{
            position: "absolute",
            left: clicked.x,
            top: clicked.y,
            width: 20 + 60 * pulse,
            height: 20 + 60 * pulse,
            border: `3px solid ${T.accent}`,
            borderRadius: "50%",
            transform: "translate(-50%,-50%)",
            opacity: 1 - pulse,
          }}
        />
      )}
      <svg
        width={34}
        height={42}
        viewBox="0 0 34 42"
        style={{
          position: "absolute",
          left: x,
          top: y,
          filter: `drop-shadow(0 2px 4px ${T.overlay})`,
          transform: `scale(${clicked ? 0.95 : 1})`,
        }}
      >
        <path
          d="M3 2 L3 31 L11 24 L18 39 L24 36 L17 22 L29 22 Z"
          fill={T.surface}
          stroke={T.ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
type ShotProps = {
  clip: string;
  title: string;
  step: string;
  duration: number;
  rate?: number;
  zoom?: number;
  focus?: string;
  note?: string;
  enter?: boolean;
};
function Shot({
  clip,
  title,
  step,
  duration,
  rate = 1,
  zoom = 1,
  focus = "50% 50%",
  note,
  enter = false,
}: ShotProps) {
  const f = useCurrentFrame();
  const events = traces[clip] ?? [];
  const event = events.find((e) => e.click) ?? { x: 1173, y: 546, time: 0.8 };
  const peak = Math.max(28, (event.time * 30) / rate);
  const tracking =
    clip === "apply" || clip === "views" || clip === "photo-retake";
  const camera = tracking
    ? interpolate(
        f,
        [0, peak, peak + 24, duration - 25, duration],
        [1.08, 1.48, 1.48, 1.12, 1.08],
        smooth,
      )
    : mix(f, 0, duration, 1.08, zoom + 0.18);
  const aim = tracking ? `${event.x / 12.8}% ${event.y / 7.2}%` : focus;
  return (
    <AbsoluteFill style={{ background: T.bg, perspective: 1800 }}>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 28,
          fontSize: 64,
          maxWidth: 1450,
          lineHeight: 1.1,
          textWrap: "balance",
          fontWeight: 650,
          letterSpacing: -3,
          opacity: mix(f, 0, 9, 0, 1),
          transform: `translateY(${mix(f, 0, 17, 18, 0)}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          right: 160,
          top: 57,
          fontSize: 20,
          color: T.muted,
          letterSpacing: 2,
        }}
      >
        {step}
      </div>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 130,
          width: 1600,
          height: 900,
          borderRadius: 24,
          overflow: "hidden",
          background: T.surface,
          boxShadow: `inset 0 2px 3px ${T.surface}, 0 24px 70px ${T.shadowColor}`,
          border: `1px solid ${T.hairline}`,
          transform: `translateY(${mix(f, 0, 15, 25, 0)}px) rotateX(${mix(f, 0, 18, 2, 0)}deg)`,
          opacity: mix(f, 0, 7, 0, 1),
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 1280,
            height: 720,
            transformOrigin: "0 0",
            transform: "scale(1.25)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: "inset(0 13px 8px 0)",
              transform: `scale(${camera})`,
              transformOrigin: aim,
            }}
          >
            <Video
              src={asset(`${clip}.mp4`)}
              muted
              playbackRate={rate}
              objectFit="contain"
              style={{ width: 1280, height: 720 }}
            />
            <Pointer clip={clip} rate={rate} />
          </div>
        </div>
        {enter && f >= 150 && (
          <div
            style={{
              position: "absolute",
              right: 40,
              bottom: 36,
              padding: "15px 22px",
              borderRadius: 13,
              color: T.accentInk,
              background: T.ink,
              fontSize: 29,
              fontWeight: 600,
              opacity: mix(f, 150, 158, 0, 1),
            }}
          >
            Enter ↵
          </div>
        )}
        {note && (
          <div
            style={{
              position: "absolute",
              left: 24,
              bottom: 20,
              padding: "9px 16px",
              borderRadius: 9,
              color: T.muted,
              background: T.bg,
              fontSize: 18,
            }}
          >
            {note}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
export const DesignerFilm = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        color: T.ink,
        fontFamily: '"SF Pro Display",Arial,sans-serif',
      }}
    >
      <Sequence durationInFrames={15 * fps} name="01 · Liquid context to space">
        <ContinuousReveal audio={false} />
      </Sequence>
      <Sequence
        from={15 * fps}
        durationInFrames={5 * fps}
        name="02 · Real design review"
      >
        <Shot
          clip="generation-d"
          title="AI arranges your space."
          step=""
          duration={150}
          rate={5}
          note="Actual app · 5× speed"
        />
      </Sequence>
      <Sequence
        from={20 * fps}
        durationInFrames={5 * fps}
        name="03 · Apply the design"
      >
        <Shot clip="apply" title="Review. Then apply." step="" duration={150} />
      </Sequence>
      <Sequence
        from={25 * fps}
        durationInFrames={5 * fps}
        name="04 · Change perspective"
      >
        <Shot
          clip="views"
          title="Explore every angle."
          step=""
          duration={150}
        />
      </Sequence>
      <Sequence
        from={30 * fps}
        durationInFrames={3 * fps}
        name="05 · Orbit the real space"
      >
        <Shot
          clip="orbit"
          title="Move through your design."
          step=""
          duration={90}
        />
      </Sequence>
      <Sequence
        from={33 * fps}
        durationInFrames={2 * fps}
        name="A moment for the idea"
      >
        <TypeBeat />
      </Sequence>
      <Sequence
        from={35 * fps}
        durationInFrames={6 * fps}
        name="06 · Photograph request"
      >
        <PhotoPrompt />
      </Sequence>
      <Sequence
        from={41 * fps}
        durationInFrames={4 * fps}
        name="07 · Actual camera review"
      >
        <Shot
          clip="photo-new"
          title="Find the best angle."
          step=""
          duration={120}
          rate={3}
          note="Actual camera workflow · 3× speed"
        />
      </Sequence>
      <Sequence
        from={45 * fps}
        durationInFrames={4 * fps}
        name="08 · Actual retake"
      >
        <Shot
          clip="photo-retake"
          title="Capture. Refine. Repeat."
          step=""
          duration={120}
        />
      </Sequence>
      <Sequence
        from={49 * fps}
        durationInFrames={8 * fps}
        name="08 · Actual captured image"
      >
        <PhotoFinish />
      </Sequence>
      <Sequence from={57 * fps} durationInFrames={3 * fps} name="09 · Close">
        <AdEnd />
      </Sequence>
      <LiquidBridge />
      <Audio
        src={staticFile("designer-film/music.m4a")}
        volume={(f) =>
          interpolate(f, [0, 15, 1710, 1800], [0.65, 0.65, 0.65, 0], clamp)
        }
      />
    </AbsoluteFill>
  );
};
