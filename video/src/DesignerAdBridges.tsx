import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TOKENS as T } from "../../web/lib/ui/tokens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const move = (v: number, a: number, b: number, x: number, y: number) =>
  interpolate(v, [a, b], [x, y], ease);

/** Global-time editorial bridges. Mount outside the scene Sequences. */
export function BridgeOverlay() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const cut = [8, 18, 27, 37, 48, 57].find(
    (at) => seconds >= at - 0.3 && seconds < at + 0.6,
  );
  if (cut === undefined) return null;
  const p = (seconds - cut + 0.3) / 0.9;
  const opacity = interpolate(p, [0, 0.18, 0.65, 1], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 20 }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ overflow: "visible" }}
      >
        {cut === 8 && (
          <g opacity={opacity * 0.75}>
            <rect
              x={move(p, 0, 0.72, 745, 100)}
              y={move(p, 0, 0.72, 340, 100)}
              width={move(p, 0, 0.72, 430, 1720)}
              height={move(p, 0, 0.72, 320, 880)}
              rx={move(p, 0, 0.72, 38, 24)}
              fill="none"
              stroke={T.hairlineStrong}
              strokeWidth={2}
            />
            <path
              d={`M ${move(p, 0, 0.8, 790, 140)} ${move(p, 0, 0.8, 370, 138)} h 48`}
              stroke={T.accent}
              strokeWidth={5}
              strokeLinecap="round"
            />
          </g>
        )}
        {cut === 18 && (
          <g opacity={opacity}>
            {["PDF", "Brief", "Brand"].map((label, i) => (
              <g
                key={label}
                transform={`translate(${move(p, 0, 0.65, 540 + i * 420, 790 + i * 170)},${move(p, 0, 0.65, 780 - i * 65, 356)}) scale(${move(p, 0, 0.8, 1.2, 0.8)})`}
              >
                <rect
                  x={-78}
                  y={-28}
                  width={156}
                  height={56}
                  rx={19}
                  fill={T.surface}
                  stroke={T.hairline}
                />
                <circle cx={-47} cy={0} r={5} fill={T.accent} />
                <text
                  x={12}
                  y={8}
                  textAnchor="middle"
                  fill={T.ink}
                  fontFamily="Arial,sans-serif"
                  fontSize={24}
                >
                  {label}
                </text>
              </g>
            ))}
          </g>
        )}
        {cut === 27 && (
          <g opacity={opacity * 0.5}>
            <rect
              x={move(p, 0, 0.75, 410, 340)}
              y={move(p, 0, 0.75, 380, 330)}
              width={move(p, 0, 0.75, 1100, 1240)}
              height={move(p, 0, 0.75, 420, 500)}
              rx={move(p, 0, 0.75, 4, 4)}
              fill="none"
              stroke={T.accent}
              strokeWidth={move(p, 0, 0.8, 2, 1)}
            />
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1={340 + i * 310}
                y1={move(p, 0.1, 0.8, 580, 330)}
                x2={340 + i * 310}
                y2={move(p, 0.1, 0.8, 580, 830)}
                stroke={T.hairlineStrong}
                opacity={move(p, 0.1, 0.6, 0, 0.7)}
              />
            ))}
          </g>
        )}
        {cut === 37 && (
          <g
            opacity={opacity * 0.65}
            stroke={T.accent}
            strokeWidth={2}
            fill="none"
          >
            {[0, 1, 2, 3].map((i) => {
              const left = i % 2 === 0;
              const top = i < 2;
              const x = move(p, 0, 0.7, left ? 400 : 1520, left ? 100 : 1820);
              const y = move(p, 0, 0.7, top ? 350 : 850, top ? 100 : 980);
              return (
                <path
                  key={i}
                  d={`M ${x} ${y + (top ? 46 : -46)} V ${y} H ${x + (left ? 46 : -46)}`}
                />
              );
            })}
          </g>
        )}
        {cut === 48 &&
          (() => {
            const close = interpolate(
              p,
              [0, 0.28, 0.36, 0.68, 1],
              [0, 0.03, 1, 0, 0],
              clamp,
            );
            return (
              <g>
                <rect width={1920} height={540 * close} fill={T.ink} />
                <rect
                  y={1080 - 540 * close}
                  width={1920}
                  height={540 * close}
                  fill={T.ink}
                />
                <rect
                  width={1920}
                  height={1080}
                  fill={T.surface}
                  opacity={interpolate(
                    p,
                    [0.36, 0.4, 0.56],
                    [0, 0.38, 0],
                    clamp,
                  )}
                />
              </g>
            );
          })()}
        {cut === 57 && (
          <g opacity={opacity * 0.8}>
            <rect
              x={move(p, 0, 0.8, 160, 700)}
              y={move(p, 0, 0.8, 130, 445)}
              width={move(p, 0, 0.8, 1600, 520)}
              height={move(p, 0, 0.8, 820, 190)}
              rx={move(p, 0, 0.8, 22, 45)}
              fill="none"
              stroke={T.museGlow}
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
}
