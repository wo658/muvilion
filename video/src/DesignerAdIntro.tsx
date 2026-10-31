import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TOKENS as T } from "../../web/lib/ui/tokens";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) };
const m = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], ease);
const fontFamily = '"SF Pro Display","Arial",sans-serif';
function Plan({ progress = 1 }: { progress?: number }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 360 230" fill="none">
      <path
        d="M30 20H330V210H30V20Z M30 80H140V20 M140 80V155H225V210 M225 155H330 M225 80H330"
        stroke={T.ink}
        strokeWidth="4"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
      />
      <path
        d="M60 110H105V170H60Z M250 105H300V135H250Z M170 40H210V100H170Z"
        stroke={T.accent}
        strokeWidth="3"
        opacity={progress}
      />
      <path
        d="M12 20V210 M4 20H20 M4 210H20 M30 223H330"
        stroke={T.edge}
        strokeWidth="1.5"
      />
    </svg>
  );
}
function Card({ index }: { index: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: f - 67 - index * 10,
    fps,
    config: { damping: 20, stiffness: 130 },
  });
  const c = m(f, 213, 240, 0, 1);
  return (
    <div
      style={{
        position: "absolute",
        left: 312 + index * 442,
        top: 515,
        width: 410,
        height: 365,
        borderRadius: 26,
        background: T.surface,
        border: `1px solid ${T.hairline}`,
        boxShadow: `0 35px 85px ${T.shadowColor}`,
        opacity: p * (1 - c * 0.55),
        transform: `translate(${(1 - index) * 440 * c}px,${(1 - p) * 200 - c * 80}px) rotate(${[-7, 2, 7][index] * (1 - c)}deg) scale(${1 - c * 0.36})`,
        padding: 30,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 20,
          color: T.muted,
          letterSpacing: 1,
        }}
      >
        <span>{["DRAWING", "BRIEF", "BRAND"][index]}</span>
        <span>{["PDF", "DOC", "URL"][index]}</span>
      </div>
      <div style={{ height: 215, marginTop: 18 }}>
        {index === 0 ? (
          <Plan progress={m(f, 83, 138, 0, 1)} />
        ) : index === 1 ? (
          <div style={{ paddingTop: 20 }}>
            <div
              style={{
                fontSize: 35,
                fontWeight: 650,
                letterSpacing: -1,
                lineHeight: 1.08,
              }}
            >
              A place to
              <br />
              come together.
            </div>
            <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
              {[85, 130, 60].map((w, i) => (
                <div
                  key={i}
                  style={{
                    width: w,
                    height: 9,
                    borderRadius: 10,
                    background: i ? T.hairline : T.accent,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                width: 260,
                height: 9,
                marginTop: 12,
                borderRadius: 10,
                background: T.hairline,
              }}
            />
            <div
              style={{
                width: 200,
                height: 9,
                marginTop: 12,
                borderRadius: 10,
                background: T.hairline,
              }}
            />
          </div>
        ) : (
          <div style={{ paddingTop: 20 }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 26,
                background: T.accent,
                color: T.accentInk,
                fontSize: 70,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              f
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {[T.accent, T.accentSoft, T.sunken, T.ink].map((color) => (
                <div
                  key={color}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: color,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 20, fontWeight: 550, marginTop: 12 }}>
        {
          [
            "The real floor plan",
            "The purpose of the space",
            "The feeling of your brand",
          ][index]
        }
      </div>
    </div>
  );
}
export function AdOpening() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{ background: T.bg, color: T.ink, fontFamily, overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 64,
          textAlign: "center",
          fontSize: 21,
          letterSpacing: 5,
          color: T.muted,
          opacity: m(f, 0, 25, 0, 1),
        }}
      >
        MUVILION
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: m(f, 65, 100, 300, 164),
          textAlign: "center",
          fontSize: m(f, 65, 100, 148, 108),
          lineHeight: 1.02,
          letterSpacing: -7,
          fontWeight: 650,
        }}
      >
        {["Every space.", "Starts with an idea."].map((line, i) => {
          const p = spring({
            frame: f - i * 13,
            fps,
            config: { damping: 22, stiffness: 150 },
          });
          return (
            <div
              key={line}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 90}px)`,
                color: i ? T.muted : T.ink,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
      {[0, 1, 2].map((index) => (
        <Card key={index} index={index} />
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 25,
          color: T.muted,
          opacity: m(f, 130, 160, 0, 1) * (1 - m(f, 211, 235, 0, 1)),
        }}
      >
        Your context. One starting point.
      </div>
    </AbsoluteFill>
  );
}
export function AdChat() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words =
    "Create an open, welcoming community space. Blue accents. A four-seat lounge. Keep the right aisle clear.";
  const typed = words.slice(
    0,
    Math.floor(interpolate(f, [28, 164], [0, words.length], clamp)),
  );
  const enter = spring({
    frame: f,
    fps,
    config: { damping: 24, stiffness: 110 },
  });
  const send = m(f, 196, 231, 0, 1);
  const grid = m(f, 207, 266, 0, 1);
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        color: T.ink,
        fontFamily,
        overflow: "hidden",
        perspective: 1800,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 850,
          height: 850,
          left: 535,
          top: 165,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${T.accentSoft} 0%, ${T.bg} 68%)`,
          opacity: 0.7,
          transform: `scale(${1 + Math.sin(f / 70) * 0.08})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 135,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 91,
          fontWeight: 650,
          letterSpacing: -5,
          opacity: (1 - send) * enter,
          transform: `translateY(${(1 - enter) * 35}px)`,
        }}
      >
        Just say what you imagine.
      </div>
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 328,
          width: 1280,
          transformOrigin: "50% 60%",
          transform: `translateY(${(1 - enter) * 80 - send * 80}px) scale(${1 - send * 0.84}) rotateX(${send * 42}deg)`,
          opacity: 1 - send,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {[
            "PDF · Floor plan",
            "Brief · Community Studio",
            "URL · Brand reference",
          ].map((text, i) => (
            <div
              key={text}
              style={{
                background: T.surface,
                border: `1px solid ${T.hairline}`,
                borderRadius: 17,
                padding: "13px 22px",
                fontSize: 21,
                color: T.muted,
                boxShadow: `0 8px 24px ${T.shadowColor}`,
                opacity: m(f, i * 5, 18 + i * 5, 0, 1),
                transform: `translateY(${m(f, i * 5, 18 + i * 5, 20, 0)}px)`,
              }}
            >
              {text}
            </div>
          ))}
        </div>
        <div
          style={{
            background: T.surface,
            border: `2px solid ${f > 180 ? T.museGlow : T.hairline}`,
            borderRadius: 38,
            padding: "46px 50px 32px",
            height: 310,
            boxSizing: "border-box",
            boxShadow: `0 28px 100px ${T.shadowColor}`,
          }}
        >
          <div
            style={{
              fontSize: 42,
              lineHeight: 1.28,
              letterSpacing: -1.1,
              height: 161,
              maxWidth: 1120,
            }}
          >
            {typed}
            <span
              style={{
                display: "inline-block",
                height: 43,
                width: 3,
                background: T.accent,
                verticalAlign: "-6px",
                marginLeft: 3,
                opacity: f < 175 ? (Math.floor(f / 13) % 2 === 0 ? 1 : 0.3) : 0,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: T.muted,
              fontSize: 21,
            }}
          >
            <span>✦ &nbsp; Muse</span>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ opacity: m(f, 166, 179, 0, 1) }}>
                Create space
              </span>
              <div
                style={{
                  height: 58,
                  width: 58,
                  borderRadius: 19,
                  background: T.accent,
                  color: T.accentInk,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: 34,
                  transform: `scale(${1 - m(f, 184, 190, 0, 0.13) + m(f, 190, 196, 0, 0.13)})`,
                }}
              >
                ↑
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 460,
          top: 290,
          width: 1000,
          height: 600,
          opacity: grid,
          transform: `rotateX(${m(f, 215, 269, 0, 52)}deg) rotateZ(-12deg) scale(${m(f, 213, 269, 0.15, 1.1)})`,
          filter: `drop-shadow(0 25px 25px ${T.shadowColor})`,
        }}
      >
        <svg width="1000" height="600" viewBox="0 0 1000 600" fill="none">
          {Array.from({ length: 11 }, (_, i) => (
            <path
              key={`x${i}`}
              d={`M${i * 100} 0V600`}
              stroke={T.hairline}
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <path
              key={`y${i}`}
              d={`M0 ${i * 100}H1000`}
              stroke={T.hairline}
              strokeWidth="1"
            />
          ))}
          <path
            d="M100 100H900V500H100V100Z M100 260H350V100 M350 260V400H650V500 M650 260H900"
            stroke={T.accent}
            strokeWidth="5"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - grid}
          />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 90,
          textAlign: "center",
          fontSize: 24,
          color: T.muted,
          opacity: 1 - send,
        }}
      >
        From a few words to a new perspective.
      </div>
    </AbsoluteFill>
  );
}
