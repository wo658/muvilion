import { FILM_GLASS } from "./FilmGlass";
import {
  AbsoluteFill,
  Sequence,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
import { SpatialModel } from "./DesignerAdSpace";
const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const m = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], {
    ...c,
    easing: Easing.bezier(0.65, 0, 0.2, 1),
  });
const k = (f: number, frames: number[], values: number[]) =>
  interpolate(f, frames, values, {
    ...c,
    easing: Easing.bezier(0.65, 0, 0.2, 1),
  });
const prompt =
  "Create an open community space.\nBlue accents. A four-seat lounge.";

/** One continuous world: the same cards attach, the same composer becomes the plan. */
export function ContinuousReveal({ audio = true }: { audio?: boolean }) {
  const f = useCurrentFrame();
  const merge = m(f, 78, 112, 0, 1),
    send = m(f, 225, 270, 0, 1);
  const elastic =
    f < 92 ? 0 : Math.sin((f - 92) * 0.2) * Math.exp(-(f - 92) / 15);
  const glass = FILM_GLASS.background;
  const glassShadow = FILM_GLASS.shadow;
  const camera = k(
    f,
    [0, 30, 65, 112, 190, 225, 246, 275, 340, 449],
    [1.35, 1.05, 1.05, 1, 1.06, 1.08, 1.35, 1.18, 1.08, 1.12],
  );
  const camX = k(
    f,
    [0, 45, 90, 112, 215, 246, 275, 360, 449],
    [180, -80, 40, 0, 0, -380, 0, 35, -35],
  );
  const camY = k(
    f,
    [0, 80, 112, 215, 246, 285, 449],
    [55, 0, 0, 0, -135, 0, -10],
  );
  const roll = k(
    f,
    [0, 50, 112, 215, 246, 285, 365, 449],
    [-6, 3, 0, 0, -3, 2, -2, 0],
  );
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        color: T.ink,
        fontFamily: '"SF Pro Display",Arial,sans-serif',
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 65% 65%,${T.accentSoft},${T.bg} 65%)`,
          opacity: 0.9,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.42,
          filter: "blur(65px)",
          transform: `rotate(${f * 0.05}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 260 + Math.sin(f / 65) * 160,
            top: 270,
            width: 620,
            height: 340,
            borderRadius: "50%",
            background: T.accentSoft,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 180,
            top: 520 + Math.cos(f / 85) * 100,
            width: 430,
            height: 270,
            borderRadius: "50%",
            background: T.museGlow,
            opacity: 0.24,
          }}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "960px 540px",
          transform: `translate(${camX}px,${camY}px) scale(${camera}) rotate(${roll}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 125,
            textAlign: "center",
            fontSize: 100,
            fontWeight: 650,
            letterSpacing: -6,
            opacity: m(f, 0, 12, 0, 1) * (1 - m(f, 72, 105, 0, 1)),
            transform: `translateY(${m(f, 0, 30, 70, 0) - m(f, 75, 110, 0, 100)}px)`,
          }}
        >
          Bring your context.
        </div>
        {/* A single panel grows behind the incoming cards and later flattens into the drawing. */}
        <div
          style={{
            position: "absolute",
            left: 320,
            top: m(f, 243, 275, 395, 280),
            width: 1280,
            height: m(f, 243, 275, 330, 610),
            borderRadius: m(f, 240, 275, 56, 8),
            background: glass,
            backdropFilter: "blur(28px) saturate(150%)",
            border: `1px solid ${T.hairline}`,
            boxShadow: glassShadow,
            opacity: m(f, 85, 108, 0, 1) * (1 - m(f, 275, 300, 0, 1)),
            transform: `perspective(1600px) rotateX(${m(f, 240, 275, 0, 30)}deg) scale(${1 + elastic * 0.018},${1 - elastic * 0.025})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 410,
            width: 160,
            height: 50,
            transform: `translate(-50%,-50%) scale(${m(f, 85, 125, 0.4, 1.5)})`,
            borderRadius: "50%",
            background: `radial-gradient(ellipse,${T.museGlow},transparent 70%)`,
            opacity: m(f, 84, 94, 0, 0.6) * (1 - m(f, 115, 133, 0, 1)),
            filter: "blur(9px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 375,
            top: 405,
            fontSize: 20,
            color: T.muted,
            opacity: m(f, 123, 135, 0, 1) * (1 - m(f, 230, 248, 0, 1)),
          }}
        >
          ✓ 3 sources added
        </div>
        {["Floor plan.pdf", "Project brief", "Brand URL"].map((label, i) => {
          const enter = m(f, i * 12, i * 12 + 28, 0, 1);
          const pull = m(f, 86 + i * 6, 108 + i * 6, 0, 1);
          const x =
            ((390 + i * 570) * (1 - merge) + (610 + i * 350) * merge) *
              (1 - pull) +
            960 * pull;
          const y =
            ((470 + [25, -20, 40][i]) * (1 - merge) + 355 * merge) *
              (1 - pull) +
            410 * pull -
            Math.sin(pull * Math.PI) * 85;
          const size = (1 - merge * 0.65) * (1 - pull * 0.99);
          const stretch = Math.sin(pull * Math.PI) * 0.55;
          return (
            <div
              key={label}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 420,
                height: 310,
                transform: `translate(-50%,-50%) translateY(${(1 - enter) * 500}px) scale(${size * (1 - send * 0.5)}) scale(${1 - stretch},${1 + stretch}) rotate(${[-12, 5, 14][i] * (1 - merge) + m(f, 236, 270, 0, i * 30 - 30)}deg)`,
                opacity: enter * (1 - m(f, 102 + i * 6, 110 + i * 6, 0, 1)),
                borderRadius: 44 + Math.sin(merge * Math.PI) * 42,
                background: glass,
                backdropFilter: "blur(24px) saturate(160%)",
                border: `1px solid ${T.hairline}`,
                boxShadow: glassShadow,
                padding: 32,
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: 26, color: T.muted, letterSpacing: 2 }}>
                {["PDF / DRAWING", "DOC / PURPOSE", "URL / IDENTITY"][i]}
              </div>
              {i === 0 ? (
                <svg
                  width="350"
                  height="160"
                  viewBox="0 0 350 160"
                  style={{ marginTop: 16 }}
                >
                  <path
                    d="M15 10H330V145H15Z M80 10V65H180V145 M180 65H280V10"
                    fill="none"
                    stroke={T.ink}
                    strokeWidth="3"
                  />
                  {[0, 1, 2].map((n) => (
                    <rect
                      key={n}
                      x={35 + n * 95}
                      y={90 - n * 15}
                      width="45"
                      height="25"
                      fill={T.accentSoft}
                      stroke={T.accent}
                    />
                  ))}
                </svg>
              ) : i === 1 ? (
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 650,
                    letterSpacing: -2,
                    marginTop: 25,
                  }}
                >
                  A place to
                  <br />
                  come together.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 18, marginTop: 38 }}>
                  {[T.accent, T.museGlow, T.accentSoft, T.ink].map((color) => (
                    <div
                      key={color}
                      style={{
                        width: 65,
                        height: 65,
                        background: color,
                        borderRadius: 18,
                      }}
                    />
                  ))}
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: 24,
                  fontSize: 25,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 370,
            top: 445,
            width: 1110,
            fontSize: 49,
            lineHeight: 1.3,
            whiteSpace: "pre-line",
            letterSpacing: -1.8,
            opacity: m(f, 109, 123, 0, 1) * (1 - m(f, 234, 254, 0, 1)),
            transform: `translateY(${m(f, 235, 265, 0, -90)}px)`,
          }}
        >
          {prompt.slice(0, Math.floor(m(f, 122, 201, 0, prompt.length)))}
          <span
            style={{
              color: T.accent,
              opacity: f < 210 && Math.floor(f / 8) % 2 === 0 ? 1 : 0,
            }}
          >
            |
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 375,
            top: 651,
            fontSize: 24,
            color: T.muted,
            opacity: m(f, 110, 125, 0, 1) * (1 - send),
          }}
        >
          ✦ Muse
        </div>
        <div
          style={{
            position: "absolute",
            left: m(f, 240, 274, 1495, 960),
            top: m(f, 240, 274, 650, 605),
            width: 78 + send * 380,
            height: 78 + send * 380,
            transform: `translate(-50%,-50%) scale(${k(f, [212, 224, 230, 242, 274], [1, 1, 0.86, 1, 1])})`,
            borderRadius: "50%",
            background: `linear-gradient(140deg,${T.museGlow},${T.accent})`,
            border: `2px solid ${T.accentSoft}`,
            opacity: m(f, 108, 122, 0, 1) * (1 - m(f, 250, 280, 0, 1)),
            boxShadow: `inset 0 3px 8px ${T.accentSoft}, 0 0 ${send * 110}px ${T.museGlow}`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: T.accentInk,
            fontSize: 54,
          }}
        >
          <span style={{ opacity: 1 - send }}>↑</span>
        </div>
        <svg
          width="1920"
          height="1080"
          style={{
            position: "absolute",
            inset: 0,
            opacity: m(f, 247, 270, 0, 1) * (1 - m(f, 282, 320, 0, 1)),
          }}
        >
          {Array.from({ length: 19 }, (_, i) => (
            <g key={i} stroke={T.hairline}>
              <path d={`M${200 + i * 85} 180V1000 M160 ${180 + i * 45}H1760`} />
            </g>
          ))}
          <rect
            x={430}
            y={280}
            width={1060}
            height={610}
            rx={5}
            fill="none"
            stroke={T.accent}
            strokeWidth={3}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: m(f, 270, 295, 0, 1),
            transform: `scale(${m(f, 270, 340, 0.94, 1.08)})`,
          }}
        >
          <SpatialModel frame={Math.max(0, (f - 270) * 1.65)} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 100,
          fontSize: 84,
          fontWeight: 650,
          letterSpacing: -4,
          opacity: m(f, 330, 352, 0, 1),
          transform: `translateY(${m(f, 330, 360, 45, 0)}px)`,
        }}
      >
        Your idea. <span style={{ color: T.accent }}>In space.</span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 65,
          left: 140,
          fontSize: 25,
          color: T.muted,
          opacity: m(f, 365, 389, 0, 1),
        }}
      >
        muvilion
      </div>
      <div
        style={{
          position: "absolute",
          right: 130,
          bottom: 72,
          display: "flex",
          gap: 14,
          opacity: m(f, 315, 345, 0, 1),
          transform: `translateY(${m(f, 315, 350, 75, 0)}px)`,
        }}
      >
        {[
          ["Blue accent", T.accent],
          ["Warm oak", T.objectSofa],
          ["Soft stone", T.floorIndoor],
        ].map(([label, color], i) => (
          <div
            key={label}
            style={{
              width: 150,
              padding: 12,
              borderRadius: 18,
              background: T.surface,
              boxShadow: `0 16px 45px ${T.shadowColor}`,
              transform: `translateY(${m(f, 320 + i * 7, 355 + i * 7, 40, 0)}px)`,
            }}
          >
            <div style={{ height: 50, borderRadius: 10, background: color }} />
            <div style={{ fontSize: 18, marginTop: 10, color: T.muted }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      {audio && (
        <Audio
          src={staticFile("designer-film/music.m4a")}
          volume={(f) =>
            interpolate(f, [0, 15, 420, 450], [0.6, 0.6, 0.6, 0], c)
          }
        />
      )}
      <Audio src={staticFile("designer-ad/continuous-sfx.wav")} volume={0.7} />
      <Sequence from={102} durationInFrames={110}>
        <Audio src={staticFile("designer-ad/photo-typing.wav")} volume={0.75} />
      </Sequence>
    </AbsoluteFill>
  );
}
