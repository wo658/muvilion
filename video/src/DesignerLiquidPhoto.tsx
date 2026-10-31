import {
  AbsoluteFill,
  Img,
  interpolate,
  Easing,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { TOKENS as T } from "../../web/lib/ui/tokens";
const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const m = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], {
    ...c,
    easing: Easing.bezier(0.65, 0, 0.2, 1),
  });
const glass = `linear-gradient(140deg,${T.surface},${T.accentSoft})`;
export function PhotoPrompt() {
  const f = useCurrentFrame();
  const p = m(f, 133, 178, 0, 1);
  const text = "Capture the space. Find its best angle.";
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 78,
          fontWeight: 650,
          letterSpacing: -4,
          position: "absolute",
          top: 180,
          opacity: 1 - p,
        }}
      >
        Designed to be seen.
      </div>
      <div
        style={{
          width: 1250,
          padding: 55,
          height: 240,
          borderRadius: 48,
          background: glass,
          border: `1px solid ${T.hairline}`,
          boxShadow: `inset 0 2px 3px ${T.surface},0 30px 90px ${T.shadowColor}`,
          transform: `scale(${1 - p * 0.96},${1 + Math.sin(p * Math.PI) * 0.18 - p * 0.96}) translateY(${p * 180}px)`,
          opacity: 1 - m(f, 164, 179, 0, 1),
        }}
      >
        <div style={{ fontSize: 49, letterSpacing: -2 }}>
          {text.slice(0, Math.floor(m(f, 20, 112, 0, text.length)))}
          <span style={{ color: T.accent }}>|</span>
        </div>
        <div style={{ marginTop: 70, color: T.muted, fontSize: 24 }}>
          ✦ Muse <span style={{ float: "right", color: T.accent }}>↑</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          width: 90 + p * 450,
          height: 90 + p * 450,
          borderRadius: "50%",
          border: `2px solid ${T.museGlow}`,
          opacity: Math.sin(p * Math.PI) * 0.5,
        }}
      />
    </AbsoluteFill>
  );
}
export function PhotoFinish() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: T.bg, perspective: 1600 }}>
      <div
        style={{
          position: "absolute",
          top: 65,
          left: 130,
          fontSize: 78,
          fontWeight: 650,
          letterSpacing: -4,
        }}
      >
        A space worth sharing.
      </div>
      <div
        style={{
          position: "absolute",
          left: 220,
          top: 210,
          width: 1480,
          height: 760,
          borderRadius: 35,
          overflow: "hidden",
          background: T.surface,
          boxShadow: `0 35px 90px ${T.shadowColor}`,
          transform: `rotateY(${m(f, 0, 45, -12, 0)}deg) rotateZ(${m(f, 0, 60, -3, 0)}deg) scale(${m(f, 0, 50, 0.84, 1)})`,
        }}
      >
        <Img
          src={staticFile("designer-minute/concept-final.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: "scale(1.45)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 220,
          fontSize: 22,
          color: T.muted,
        }}
      >
        COMMUNITY STUDIO / CAPTURED IN MUVILION
      </div>
      <AbsoluteFill
        style={{ background: T.surface, opacity: m(f, 0, 8, 0.8, 0) }}
      />
    </AbsoluteFill>
  );
}
export function LiquidBridge() {
  const f = useCurrentFrame();
  const at = [450, 600, 750, 900, 1050, 1230, 1470, 1710].find(
    (t) => f >= t - 10 && f < t + 15,
  );
  if (at === undefined) return null;
  const p = (f - at + 10) / 25;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: interpolate(p, [0, 0.4, 1], [1500, 60, 1700], c),
          height: interpolate(p, [0, 0.4, 1], [850, 60, 950], c),
          transform: `translate(-50%,-50%) rotate(${p * 12 - 6}deg)`,
          borderRadius: interpolate(p, [0, 0.4, 1], [45, 100, 45], c),
          border: `3px solid ${T.accentSoft}`,
          boxShadow: `inset 0 2px 4px ${T.surface},0 0 50px ${T.shadowColor}`,
          background: `color-mix(in srgb,${T.surface} 18%,transparent)`,
          backdropFilter: `blur(${Math.sin(p * Math.PI) * 9}px)`,
          opacity: Math.sin(p * Math.PI),
        }}
      />
    </AbsoluteFill>
  );
}
