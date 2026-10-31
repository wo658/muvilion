import {
  AbsoluteFill,
  Sequence,
  interpolate,
  Easing,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
import traces from "./DesignerMinuteTraces";

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
function Opening() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: T.ink,
        color: T.accentInk,
        justifyContent: "center",
        paddingLeft: 155,
      }}
    >
      <div
        style={{
          fontSize: 25,
          letterSpacing: 5,
          color: T.hairline,
          marginBottom: 36,
        }}
      >
        MUVILION / THE FIRST MINUTE
      </div>
      {["Start with a plan.", "Make it a space."].map((word, i) => {
        const p = spring({
          frame: f - i * 13,
          fps,
          config: { damping: 19, stiffness: 160 },
        });
        return (
          <div
            key={word}
            style={{
              fontSize: 138,
              lineHeight: 1.04,
              letterSpacing: -8,
              fontWeight: 650,
              opacity: p,
              transform: `translateY(${(1 - p) * 100}px)`,
              color: i ? T.museGlow : T.accentInk,
            }}
          >
            {word}
          </div>
        );
      })}
      <div
        style={{
          width: mix(f, 18, 65, 0, 680),
          height: 5,
          background: T.accent,
          marginTop: 45,
        }}
      />
    </AbsoluteFill>
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
  const camera = mix(f, 0, 24, zoom * 0.96, zoom);
  return (
    <AbsoluteFill style={{ background: T.bg, perspective: 1800 }}>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 28,
          fontSize: 64,
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
          boxShadow: `0 14px 70px ${T.shadowColor}`,
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
              transform: `scale(${camera})`,
              transformOrigin: focus,
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
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: `${(f / duration) * 100}%`,
            height: 3,
            background: T.accent,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}
function Ending() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: T.ink,
        color: T.accentInk,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 148,
          fontWeight: 700,
          letterSpacing: -8,
          transform: `scale(${mix(f, 0, 25, 0.92, 1)})`,
          opacity: mix(f, 0, 10, 0, 1),
        }}
      >
        Your space<span style={{ color: T.museGlow }}>.</span>
      </div>
      <div
        style={{
          fontSize: 36,
          color: T.hairline,
          marginTop: 30,
          opacity: mix(f, 6, 20, 0, 1),
        }}
      >
        Built from your context.
      </div>
    </AbsoluteFill>
  );
}
export const DesignerFilm = () => (
  <AbsoluteFill
    style={{
      background: T.bg,
      color: T.ink,
      fontFamily: '"SF Pro Display","Arial",sans-serif',
    }}
  >
    <Sequence durationInFrames={90} name="01 · A plan becomes a space">
      <Opening />
    </Sequence>
    <Sequence
      from={90}
      durationInFrames={120}
      name="02 · Click Drawing settings"
    >
      <Shot
        clip="plan"
        title="Read the room."
        step="01 / THE DRAWING"
        duration={120}
      />
    </Sequence>
    <Sequence
      from={210}
      durationInFrames={120}
      name="03 · Zoom and fit the actual PDF"
    >
      <Shot
        clip="scale"
        title="Start with real context."
        step="01 / THE DRAWING"
        duration={120}
        zoom={1.12}
        focus="32% 46%"
      />
    </Sequence>
    <Sequence
      from={330}
      durationInFrames={150}
      name="04 · Open the English brief"
    >
      <Shot
        clip="brief"
        title="Add the purpose."
        step="02 / THE BRIEF"
        duration={150}
        zoom={1.2}
      />
    </Sequence>
    <Sequence
      from={480}
      durationInFrames={120}
      name="05 · Open brand reference"
    >
      <Shot
        clip="brand"
        title="Bring the brand."
        step="03 / THE REFERENCE"
        duration={120}
        zoom={1.24}
      />
    </Sequence>
    <Sequence
      from={600}
      durationInFrames={210}
      name="06 · Type and press Enter"
    >
      <Shot
        clip="request"
        title="Tell Muse what you imagine."
        step="04 / THE REQUEST"
        duration={210}
        zoom={1.52}
        focus="100% 100%"
        enter
      />
    </Sequence>
    <Sequence
      from={810}
      durationInFrames={150}
      name="07 · Actual furniture placement"
    >
      <Shot
        clip="generation-b"
        title="Watch it take shape."
        step="05 / LIVE DESIGN"
        duration={150}
        rate={5}
        note="Actual app recording · 5× speed"
      />
    </Sequence>
    <Sequence
      from={960}
      durationInFrames={150}
      name="08 · Actual lounge and stage"
    >
      <Shot
        clip="generation-c"
        title="Furniture. Flow. Feeling."
        step="05 / LIVE DESIGN"
        duration={150}
        rate={5}
        note="Actual app recording · 5× speed"
      />
    </Sequence>
    <Sequence
      from={1110}
      durationInFrames={150}
      name="09 · Actual review and corrections"
    >
      <Shot
        clip="generation-d"
        title="Refined in the same space."
        step="05 / LIVE DESIGN"
        duration={150}
        rate={5}
        note="Actual app recording · 5× speed"
      />
    </Sequence>
    <Sequence
      from={1260}
      durationInFrames={150}
      name="10 · Click Apply changes"
    >
      <Shot
        clip="apply"
        title="You make the call."
        step="06 / APPLY"
        duration={150}
      />
    </Sequence>
    <Sequence
      from={1410}
      durationInFrames={150}
      name="11 · Click Top and Overview"
    >
      <Shot
        clip="views"
        title="Change your perspective."
        step="07 / EXPLORE"
        duration={150}
      />
    </Sequence>
    <Sequence
      from={1560}
      durationInFrames={180}
      name="12 · Drag to orbit the actual space"
    >
      <Shot
        clip="orbit"
        title="Look around. Make it yours."
        step="07 / EXPLORE"
        duration={180}
      />
    </Sequence>
    <Sequence
      from={1740}
      durationInFrames={60}
      name="13 · End of the opening minute"
    >
      <Ending />
    </Sequence>
    <Audio
      src={staticFile("designer-film/music.m4a")}
      volume={(f) =>
        interpolate(f, [0, 15, 1710, 1800], [0.7, 0.7, 0.7, 0], clamp)
      }
    />
  </AbsoluteFill>
);
