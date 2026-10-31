import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
const smooth = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.2, 0.75, 0.2, 1),
} as const;
const frameStyle = {
  position: "absolute" as const,
  left: 160,
  top: 110,
  width: 1600,
  height: 900,
  borderRadius: 20,
  overflow: "hidden" as const,
  background: T.bg,
  boxShadow: `0 24px 80px ${T.shadowColor}`,
};

function Hero() {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        ...frameStyle,
        scale: interpolate(f, [0, 60], [0.93, 0.98], smooth),
        translate: `0 ${interpolate(f, [0, 22], [35, 0], smooth)}px`,
      }}
    >
      <Video
        src={staticFile("capture/orbit.mp4")}
        muted
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
function Request() {
  const f = useCurrentFrame();
  return (
    <>
      <div
        style={{
          ...frameStyle,
          scale: 0.98,
          filter: "blur(3px)",
          opacity: 0.5,
        }}
      >
        <Img
          src={staticFile("capture/overview.png")}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 360,
          color: T.accentInk,
          fontSize: 84,
          lineHeight: 1.18,
          fontWeight: 650,
          letterSpacing: -3,
        }}
      >
        원하는 변화를,
        <br />
        말해보세요.
      </div>
      <div
        style={{
          position: "absolute",
          left: 1080,
          top: 205,
          width: 700,
          height: 620,
          overflow: "hidden",
          borderRadius: 24,
          background: T.surface,
          translate: `0 ${interpolate(f, [0, 18], [45, 0], smooth)}px`,
          opacity: interpolate(f, [0, 10], [0, 1], smooth),
        }}
      >
        <Img
          src={staticFile("capture/final-full.jpg")}
          style={{
            position: "absolute",
            width: 3456,
            height: 1944,
            maxWidth: "none",
            left: -2736,
            top: 0,
          }}
        />
      </div>
    </>
  );
}
function Change() {
  const f = useCurrentFrame();
  return (
    <div style={{ ...frameStyle, scale: 0.98 }}>
      <Img
        src={staticFile("capture/overview.png")}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />
      <Img
        src={staticFile("capture/live-draft.png")}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          clipPath: `inset(0 ${interpolate(f, [2, 28], [100, 0], smooth)}% 0 0)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 34,
          bottom: 34,
          background: T.ink,
          color: T.accentInk,
          fontSize: 25,
          padding: "12px 22px",
          borderRadius: 10,
        }}
      >
        검토하고, 적용하세요.
      </div>
    </div>
  );
}
function Explore() {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        ...frameStyle,
        scale: interpolate(f, [0, 135], [0.98, 1.035], smooth),
      }}
    >
      <Video
        src={staticFile("capture/orbit.mp4")}
        trimBefore={60}
        muted
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
function Caption() {
  const f = useCurrentFrame();
  const title =
    f < 60
      ? "공간을 만드는 대화."
      : f < 120
        ? "작은 요청, 선명한 변화."
        : f < 165
          ? "아이디어가 공간에 반영되는 순간."
          : "직접 둘러보세요.";
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        right: 110,
        top: 38,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: T.accentInk,
      }}
    >
      <span style={{ fontSize: 35, fontWeight: 750, letterSpacing: -1 }}>
        muvilion<span style={{ color: T.museGlow }}>.</span>
      </span>
      <span style={{ fontSize: 29, fontWeight: 500 }}>{title}</span>
      <span style={{ fontSize: 18, letterSpacing: 3, color: T.hairline }}>
        MUSE ATELIER
      </span>
    </div>
  );
}
export const Showroom = () => (
  <AbsoluteFill
    style={{
      background: T.ink,
      fontFamily: '"Apple SD Gothic Neo", sans-serif',
    }}
  >
    <Sequence durationInFrames={60} name="완성 공간 · 실제 앱 녹화">
      <Hero />
    </Sequence>
    <Sequence from={60} durationInFrames={60} name="실제 Muse 요청 확대">
      <Request />
    </Sequence>
    <Sequence from={120} durationInFrames={45} name="수정 전후 · 실제 초안">
      <Change />
    </Sequence>
    <Sequence from={165} durationInFrames={135} name="적용 후 · 실제 앱 회전">
      <Explore />
    </Sequence>
    <Audio src={staticFile("capture/atelier-cue.wav")} />
    <Caption />
    <div
      style={{
        position: "absolute",
        bottom: 8,
        left: 110,
        fontSize: 15,
        color: T.hairline,
      }}
    >
      실제 앱 화면 · 수동 설계 쇼룸 + Muse 색상 편집 · 대기 구간 생략
    </div>
  </AbsoluteFill>
);
