import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
const ease = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.18, 0.8, 0.2, 1),
} as const;
const lerp = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], ease);
function Intro() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: lerp(f, 19, 30, 1, 0),
        transform: `scale(${lerp(f, 0, 30, 0.94, 1.04)})`,
      }}
    >
      <div
        style={{
          fontSize: 128,
          fontWeight: 700,
          letterSpacing: -7,
          lineHeight: 1.13,
          textAlign: "center",
        }}
      >
        생각을,
        <br />
        <span style={{ color: T.accent }}>공간으로.</span>
      </div>
    </AbsoluteFill>
  );
}
function SourceCard({
  kind,
  index,
}: {
  kind: "plan" | "brief" | "brand";
  index: number;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: f - 17 - index * 6,
    fps,
    config: { damping: 19, stiffness: 160 },
  });
  const merge = lerp(f, 91, 117, 0, 1);
  const x = (index - 1) * 490 * (1 - merge);
  const y = lerp(enter, 0, 1, 190, 0) - Math.sin(merge * Math.PI) * 110;
  const rotation =
    [-7, 0, 7][index] * (1 - merge) + merge * [28, -20, 34][index];
  return (
    <div
      style={{
        position: "absolute",
        width: 420,
        height: 510,
        left: 750,
        top: 305,
        background: T.surface,
        border: `1px solid ${T.hairline}`,
        borderRadius: 30,
        boxShadow: `0 28px 90px ${T.shadowColor}`,
        transform: `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${enter * (1 - merge * 0.92)})`,
        opacity: lerp(f, 107, 119, 1, 0),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 70,
          padding: "24px 30px",
          boxSizing: "border-box",
          fontSize: 18,
          fontWeight: 650,
          letterSpacing: 2,
          color: T.muted,
        }}
      >
        {["01 / FLOOR PLAN", "02 / CREATIVE BRIEF", "03 / BRAND"][index]}
      </div>
      {kind === "plan" ? (
        <>
          <div
            style={{
              margin: "4px 28px",
              height: 300,
              background: T.bg,
              borderRadius: 10,
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Img
              src={staticFile("input-reveal/full-plan.png")}
              style={{ height: "100%", objectFit: "contain" }}
            />
          </div>
          <div style={{ padding: "21px 30px", fontSize: 29, fontWeight: 650 }}>
            공간의 시작.
            <div
              style={{
                marginTop: 10,
                fontSize: 19,
                color: T.muted,
                fontWeight: 400,
              }}
            >
              west-L3.pdf · Moscone
            </div>
          </div>
        </>
      ) : kind === "brief" ? (
        <div style={{ padding: "8px 34px" }}>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.03,
              letterSpacing: -1,
            }}
          >
            COMMUNITY
            <br />
            STUDIO
          </div>
          <div
            style={{
              height: 4,
              background: T.accent,
              width: 60,
              margin: "25px 0",
            }}
          />
          {["사람이 모이고", "이야기가 흐르는 공간."].map((t) => (
            <div
              key={t}
              style={{ fontSize: 25, lineHeight: 1.5, fontWeight: 500 }}
            >
              {t}
            </div>
          ))}
          <div
            style={{
              marginTop: 28,
              fontSize: 19,
              color: T.muted,
              lineHeight: 1.9,
            }}
          >
            스토리 갤러리 / 디지털 체험
            <br />
            커뮤니티 라운지 / 토크 스테이지
          </div>
          <div style={{ marginTop: 35, fontSize: 29, fontWeight: 650 }}>
            기획을 담고.
          </div>
        </div>
      ) : (
        <div style={{ padding: "30px" }}>
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: T.accent,
              letterSpacing: -3,
            }}
          >
            facebook
          </div>
          <div
            style={{
              marginTop: 25,
              padding: "18px 12px",
              background: T.sunken,
              borderRadius: 14,
              fontSize: 20,
              color: T.inkSoft,
            }}
          >
            ↗ meta.com/facebook-app
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            {[T.accent, T.bg, T.ink].map((color) => (
              <div
                key={color}
                style={{
                  height: 55,
                  width: 55,
                  borderRadius: 28,
                  background: color,
                  border: `1px solid ${T.hairline}`,
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: 32, fontSize: 29, fontWeight: 650 }}>
            브랜드를 더하면.
          </div>
          <div style={{ marginTop: 10, fontSize: 18, color: T.muted }}>
            공식 URL + 참고 설명
          </div>
        </div>
      )}
    </div>
  );
}
function Inputs() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ perspective: 1500 }}>
      <div
        style={{
          position: "absolute",
          top: 123,
          width: "100%",
          textAlign: "center",
          fontSize: 70,
          fontWeight: 650,
          letterSpacing: -3,
          opacity: lerp(f, 19, 36, 0, 1) * lerp(f, 86, 104, 1, 0),
        }}
      >
        도면. 기획서. 브랜드.
      </div>
      <SourceCard kind="plan" index={0} />
      <SourceCard kind="brief" index={1} />
      <SourceCard kind="brand" index={2} />
      <div
        style={{
          position: "absolute",
          top: 865,
          width: "100%",
          textAlign: "center",
          fontSize: 25,
          color: T.muted,
          opacity: lerp(f, 44, 58, 0, 1) * lerp(f, 86, 100, 1, 0),
        }}
      >
        세 가지 입력에서 시작되는 공간 디자인
      </div>
    </AbsoluteFill>
  );
}
function Transform() {
  const f = useCurrentFrame();
  const scale = lerp(f, 0, 15, 0.12, 1);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 440,
          height: 440,
          borderRadius: "50%",
          background: `radial-gradient(circle,${T.museGlow},${T.bg})`,
          filter: "blur(45px)",
          opacity: lerp(f, 0, 10, 0, 0.55) * lerp(f, 23, 40, 1, 0),
          transform: `scale(${lerp(f, 0, 40, 0.3, 3)})`,
        }}
      />
      <div
        style={{
          width: 910,
          height: 607,
          background: T.surface,
          borderRadius: 16,
          boxShadow: `0 30px 100px ${T.shadowColor}`,
          overflow: "hidden",
          opacity: lerp(f, 31, 45, 1, 0),
          transform: `perspective(1400px) rotateX(${lerp(f, 9, 43, 0, 51)}deg) rotateZ(${lerp(f, 10, 43, 0, -15)}deg) scale(${scale})`,
        }}
      >
        <Img
          src={staticFile("input-reveal/plan.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 90,
          fontSize: 26,
          color: T.muted,
          opacity: lerp(f, 0, 8, 0, 1) * lerp(f, 30, 42, 1, 0),
        }}
      >
        실제 PDF, Moscone West · Room 3011
      </div>
    </AbsoluteFill>
  );
}
function Result() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: lerp(f, 0, 12, 0, 1) }}>
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 78,
          fontWeight: 650,
          letterSpacing: -4,
          opacity: lerp(f, 4, 20, 0, 1),
        }}
      >
        공간이 펼쳐집니다.
      </div>
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 225,
          width: 1500,
          height: 730,
          overflow: "hidden",
          borderRadius: 28,
          boxShadow: `0 24px 90px ${T.shadowColor}`,
          background: T.surface,
          transform: `translateY(${lerp(f, 0, 27, 90, 0)}px) scale(${lerp(f, 0, 100, 0.82, 1.01)})`,
        }}
      >
        <Video
          src={staticFile("input-reveal/result.mp4")}
          muted
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </AbsoluteFill>
  );
}
function End() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        opacity: lerp(f, 0, 10, 0, 1),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          textAlign: "center",
          transform: `translateY(${lerp(f, 0, 22, 20, 0)}px)`,
        }}
      >
        <div style={{ fontSize: 106, fontWeight: 750, letterSpacing: -5 }}>
          muvilion<span style={{ color: T.accent }}>.</span>
        </div>
        <div
          style={{
            fontSize: 38,
            color: T.inkSoft,
            marginTop: 22,
            letterSpacing: -1,
          }}
        >
          자료에서 시작해, 공간으로.
        </div>
      </div>
    </AbsoluteFill>
  );
}
export const InputReveal = () => (
  <AbsoluteFill
    style={{
      background: T.bg,
      color: T.ink,
      fontFamily: '"Apple SD Gothic Neo",sans-serif',
    }}
  >
    <Sequence durationInFrames={31} name="생각을 공간으로">
      <Intro />
    </Sequence>
    <Sequence durationInFrames={121} name="실제 도면 · 기획서 · 브랜드 URL">
      <Inputs />
    </Sequence>
    <Sequence from={108} durationInFrames={46} name="입력 수렴 · PDF 펼침">
      <Transform />
    </Sequence>
    <Sequence from={142} durationInFrames={132} name="실제 앱 생성 결과">
      <Result />
    </Sequence>
    <Sequence from={267} durationInFrames={33} name="muvilion 엔딩">
      <End />
    </Sequence>
    <Audio src={staticFile("input-reveal/cue.wav")} />
    <div
      style={{
        position: "absolute",
        bottom: 22,
        width: "100%",
        textAlign: "center",
        fontSize: 19,
        color: T.muted,
      }}
    >
      실제 PDF 기반 앱 결과 · 입력 전환은 모션 연출 · 생성 시간 단축
    </div>
  </AbsoluteFill>
);
