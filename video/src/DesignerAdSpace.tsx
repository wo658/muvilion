import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
const geometry = {
  widthMeters: 22.83582089552239,
  heightMeters: 15.223880597014926,
  floorBoundary: [
    { x: 0.04, y: 0.06 },
    { x: 0.96, y: 0.06 },
    { x: 0.96, y: 0.94 },
    { x: 0.04, y: 0.94 },
  ],
  objects: [
    {
      modelAssetId: "reception_desk",
      provenance: "ai",
      id: "welcome-desk",
      kind: "furniture",
      label: "Welcome Desk",
      x: 0.22,
      y: 0.82,
      width: 2.5,
      depth: 0.799966,
      height: 1.630022,
      zoneId: "z-studio",
      rotation: 180,
      elevation: 0,
      appearance: "",
    },
    {
      modelAssetId: "gallery_wall",
      provenance: "ai",
      id: "panel-1",
      kind: "partition",
      label: "Story Panel 1",
      x: 0.13,
      y: 0.28,
      width: 1.999866,
      depth: 0.199921,
      height: 3.2,
      zoneId: "z-studio",
      rotation: 90,
      elevation: 0,
      appearance: "",
    },
    {
      modelAssetId: "gallery_wall",
      provenance: "ai",
      id: "panel-2",
      kind: "partition",
      label: "Story Panel 2",
      x: 0.13,
      y: 0.43,
      width: 1.999866,
      depth: 0.199921,
      height: 3.2,
      zoneId: "z-studio",
      rotation: 90,
      elevation: 0,
      appearance: "",
    },
    {
      modelAssetId: "gallery_wall",
      provenance: "ai",
      id: "panel-3",
      kind: "partition",
      label: "Story Panel 3",
      x: 0.13,
      y: 0.58,
      width: 1.999866,
      depth: 0.199921,
      height: 3.2,
      zoneId: "z-studio",
      rotation: 90,
      elevation: 0,
      appearance: "",
    },
    {
      fixtureType: "work-table",
      provenance: "ai",
      id: "demo-1",
      kind: "furniture",
      label: "Demo Counter 1",
      x: 0.35,
      y: 0.35,
      width: 1.2,
      depth: 0.6,
      height: 0.74,
      zoneId: "z-studio",
      rotation: 0,
      elevation: 0,
      appearance: "",
    },
    {
      fixtureType: "work-table",
      provenance: "ai",
      id: "demo-2",
      kind: "furniture",
      label: "Demo Counter 2",
      x: 0.52,
      y: 0.35,
      width: 1.2,
      depth: 0.6,
      height: 0.74,
      zoneId: "z-studio",
      rotation: 0,
      elevation: 0,
      appearance: "",
    },
    {
      modelAssetId: "modern_coffee_table_01",
      provenance: "ai",
      id: "lounge-table",
      kind: "furniture",
      label: "Lounge Coffee Table",
      x: 0.42,
      y: 0.6,
      width: 0.6,
      depth: 1.20183,
      height: 0.39,
      zoneId: "z-lounge",
      rotation: 0,
      elevation: 0,
      appearance: "",
    },
    {
      useTargetId: "lounge-table",
      fixtureType: "lounge-sofa",
      provenance: "ai",
      id: "sofa-north",
      kind: "furniture",
      label: "Lounge Sofa North",
      x: 0.42,
      y: 0.501,
      width: 1.8,
      depth: 0.8,
      height: 0.85,
      zoneId: "z-lounge",
      rotation: 180,
      elevation: 0,
      appearance: "",
    },
    {
      useTargetId: "lounge-table",
      fixtureType: "lounge-sofa",
      provenance: "ai",
      id: "sofa-south",
      kind: "furniture",
      label: "Lounge Sofa South",
      x: 0.42,
      y: 0.699,
      width: 1.8,
      depth: 0.8,
      height: 0.85,
      zoneId: "z-lounge",
      rotation: 0,
      elevation: 0,
      appearance: "",
    },
    {
      provenance: "ai",
      id: "stage",
      kind: "stage",
      label: "Community Stage",
      x: 0.42,
      y: 0.18,
      width: 6,
      depth: 1.8,
      height: 0.4,
      zoneId: "z-stage",
      rotation: 0,
      elevation: 0,
      appearance: "",
    },
    {
      provenance: "ai",
      appearance: "plant",
      id: "plant-1",
      kind: "furniture",
      label: "Plant 1",
      x: 0.12,
      y: 0.82,
      width: 0.5,
      depth: 0.5,
      height: 1.2,
      zoneId: "z-studio",
      rotation: 0,
      elevation: 0,
    },
    {
      provenance: "ai",
      appearance: "plant",
      id: "plant-2",
      kind: "furniture",
      label: "Plant 2",
      x: 0.72,
      y: 0.82,
      width: 0.5,
      depth: 0.5,
      height: 1.2,
      zoneId: "z-studio",
      rotation: 0,
      elevation: 0,
    },
    {
      provenance: "ai",
      id: "brand-sign",
      kind: "hanging-sign",
      label: "Community Brand Sign",
      x: 0.42,
      y: 0.6,
      width: 4,
      depth: 0.15,
      height: 0.8,
      elevation: 2.8,
      zoneId: "z-lounge",
      rotation: 0,
      appearance: "",
    },
    {
      provenance: "ai",
      appearance: "screen",
      id: "stage-screen",
      kind: "furniture",
      label: "Stage Screen",
      x: 0.42,
      y: 0.13,
      width: 4,
      depth: 0.15,
      height: 2.2,
      elevation: 0.4,
      zoneId: "z-stage",
      rotation: 0,
    },
    {
      provenance: "ai",
      appearance: "plant",
      id: "plant-3",
      kind: "furniture",
      label: "Plant 3",
      x: 0.14,
      y: 0.16,
      width: 0.5,
      depth: 0.5,
      height: 1.2,
      zoneId: "z-studio",
      rotation: 0,
      elevation: 0,
    },
    {
      provenance: "ai",
      appearance: "plant",
      id: "plant-4",
      kind: "furniture",
      label: "Plant 4",
      x: 0.7,
      y: 0.16,
      width: 0.5,
      depth: 0.5,
      height: 1.2,
      zoneId: "z-studio",
      rotation: 0,
      elevation: 0,
    },
  ],
  zones: [
    {
      id: "z-studio",
      label: "Community Studio Floor",
      purpose: "exhibition",
      x: 0.45,
      y: 0.5,
      width: 16,
      depth: 12,
      rotation: 0,
      assignable: false,
    },
    {
      id: "z-stage",
      label: "Stage Area",
      purpose: "stage",
      x: 0.42,
      y: 0.2,
      width: 10,
      depth: 3,
      rotation: 0,
      assignable: false,
    },
    {
      id: "z-lounge",
      label: "Four-Seat Lounge",
      purpose: "lounge",
      x: 0.42,
      y: 0.6,
      width: 6,
      depth: 4,
      rotation: 0,
      assignable: false,
    },
    {
      id: "z-circ-right",
      label: "Right Aisle Keep Clear",
      purpose: "circulation",
      x: 0.88,
      y: 0.5,
      width: 2,
      depth: 12,
      rotation: 0,
      assignable: false,
    },
  ],
};

const ease = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;
const m = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], ease);
type V = [number, number, number];
const font = '"SF Pro Display",Arial,sans-serif';

function SpatialModel({ frame }: { frame: number }) {
  const tilt = m(frame, 15, 105, 0, 1);
  const turn = m(frame, 110, 300, -0.12, 0.13);
  const project = (v: V): string => {
    const x = v[0] - 11.42,
      y = v[1] - 7.61;
    const a = x * Math.cos(turn) - y * Math.sin(turn),
      b = x * Math.sin(turn) + y * Math.cos(turn);
    return `${960 + (a - b * 0.57 * tilt) * 47},${605 + (b * (1 - 0.48 * tilt) + a * 0.22 * tilt) * 47 - v[2] * 47 * tilt}`;
  };
  const polygon = (
    vs: V[],
    fill: string,
    key: string,
    stroke: string = T.hairline,
  ) => (
    <polygon
      key={key}
      points={vs.map(project).join(" ")}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  );
  const box = (
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    z: number,
    color: string,
    key: string,
    rotation = 0,
  ) => {
    const rad = (rotation * Math.PI) / 180;
    const v = (a: number, b: number, c: number): V => [
      x + a * Math.cos(rad) - b * Math.sin(rad),
      y + a * Math.sin(rad) + b * Math.cos(rad),
      c + z,
    ];
    const a = v(-w / 2, -d / 2, 0),
      b = v(w / 2, -d / 2, 0),
      c = v(w / 2, d / 2, 0),
      dd = v(-w / 2, d / 2, 0),
      aa = v(-w / 2, -d / 2, h),
      bb = v(w / 2, -d / 2, h),
      cc = v(w / 2, d / 2, h),
      ddd = v(-w / 2, d / 2, h);
    return (
      <g key={key}>
        {polygon([a, b, bb, aa], T.modelShade, key + "a")}
        {polygon([b, c, cc, bb], color, key + "b")}
        {polygon([c, dd, ddd, cc], color, key + "c")}
        {polygon([dd, a, aa, ddd], T.modelShade, key + "d")}
        {polygon([aa, bb, cc, ddd], color, key + "t")}
      </g>
    );
  };
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <filter
          id="ad-space-shadow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="25" />
        </filter>
      </defs>
      <ellipse
        cx={960}
        cy={800}
        rx={600}
        ry={110}
        fill={T.shadowColor}
        filter="url(#ad-space-shadow)"
        opacity={tilt}
      />
      <g opacity={m(frame, 0, 25, 0, 1)}>
        {polygon(
          geometry.floorBoundary.map(
            (p) =>
              [p.x * geometry.widthMeters, p.y * geometry.heightMeters, 0] as V,
          ),
          T.surface,
          "floor",
          T.edge,
        )}
        {Array.from({ length: 22 }, (_, i) => (
          <line key={"x" + i} x1={0} y1={0} x2={0} y2={0} stroke={T.hairline} />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <polyline
            key={"grid-y" + i}
            points={[
              [1, i + 0.5, 0],
              [21.5, i + 0.5, 0],
            ]
              .map((v) => project(v as V))
              .join(" ")}
            fill="none"
            stroke={T.hairline}
            opacity={0.45}
          />
        ))}
        {Array.from({ length: 21 }, (_, i) => (
          <polyline
            key={"grid-x" + i}
            points={[
              [i + 1, 1, 0],
              [i + 1, 14, 0],
            ]
              .map((v) => project(v as V))
              .join(" ")}
            fill="none"
            stroke={T.hairline}
            opacity={0.45}
          />
        ))}
        {geometry.zones.map((z, i) => {
          const p = m(frame, 55 + i * 7, 95 + i * 7, 0, 1);
          return (
            <g key={z.id} opacity={p * 0.8}>
              {polygon(
                [
                  [
                    z.x * geometry.widthMeters - z.width / 2,
                    z.y * geometry.heightMeters - z.depth / 2,
                    0.01,
                  ],
                  [
                    z.x * geometry.widthMeters + z.width / 2,
                    z.y * geometry.heightMeters - z.depth / 2,
                    0.01,
                  ],
                  [
                    z.x * geometry.widthMeters + z.width / 2,
                    z.y * geometry.heightMeters + z.depth / 2,
                    0.01,
                  ],
                  [
                    z.x * geometry.widthMeters - z.width / 2,
                    z.y * geometry.heightMeters + z.depth / 2,
                    0.01,
                  ],
                ],
                z.purpose === "lounge"
                  ? T.zoneLounge
                  : z.purpose === "stage"
                    ? T.zoneStage
                    : z.purpose === "circulation"
                      ? T.zoneCirculation
                      : T.floorIndoor,
                z.id,
              )}
            </g>
          );
        })}
        {geometry.objects
          .slice()
          .sort((a, b) => a.y - b.y)
          .map((o, i) => {
            const p = m(frame, 75 + i * 5, 112 + i * 5, 0, 1);
            const x = o.x * geometry.widthMeters,
              y = o.y * geometry.heightMeters;
            const h = o.height * p;
            const z = (o.elevation ?? 0) * p;
            const color =
              o.kind === "partition"
                ? T.model
                : o.appearance === "plant"
                  ? T.foliage
                  : o.id.includes("sofa-north") || o.kind === "stage"
                    ? T.objectSofa
                    : T.museGlow;
            return (
              <g key={o.id} opacity={m(frame, 60 + i * 5, 80 + i * 5, 0, 1)}>
                {box(x, y, o.width, o.depth, h, z, color, o.id, o.rotation)}
                {o.id.includes("sofa") &&
                  box(
                    x,
                    y + o.depth * 0.35,
                    o.width,
                    0.18,
                    0.35 * p,
                    z + h,
                    T.accentSoft,
                    o.id + "back",
                    o.rotation,
                  )}
              </g>
            );
          })}
      </g>
    </svg>
  );
}

export function AdBuild() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        color: T.ink,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 80,
          fontSize: 92,
          fontWeight: 650,
          letterSpacing: -5,
          opacity: m(f, 8, 32, 0, 1),
          translate: `0 ${m(f, 8, 40, 28, 0)}px`,
        }}
      >
        {f < 110
          ? "From lines."
          : f < 210
            ? "To possibilities."
            : "To your space."}
      </div>
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 110,
          fontSize: 20,
          color: T.muted,
          letterSpacing: 3,
        }}
      >
        DESIGNED IN CONTEXT
      </div>
      <SpatialModel frame={f} />
      <div
        style={{
          position: "absolute",
          bottom: 65,
          left: 120,
          right: 120,
          display: "flex",
          justifyContent: "space-between",
          opacity: m(f, 165, 205, 0, 1),
        }}
      >
        {[
          "A place to connect.",
          "A place to discover.",
          "A place to belong.",
        ].map((s, i) => (
          <span
            key={s}
            style={{
              fontSize: 24,
              color: i === 1 ? T.accent : T.muted,
              translate: `0 ${m(f, 165 + i * 10, 200 + i * 10, 20, 0)}px`,
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

export function AdHero() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const freeze = f >= 5.7 * fps;
  const card = m(f, 5.7 * fps, 7.5 * fps, 0, 1);
  return (
    <AbsoluteFill
      style={{
        background: T.bg,
        color: T.ink,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 1 - card }}>
        <Video
          src={staticFile("designer-ad/space-orbit.mp4")}
          muted
          objectFit="cover"
          style={{ width: 1920, height: 1080 }}
        />
      </div>
      {freeze && (
        <div
          style={{
            position: "absolute",
            left: 160,
            top: 140,
            width: 1600,
            height: 888,
            overflow: "hidden",
            borderRadius: 28,
            boxShadow: `0 30px 100px ${T.overlay}`,
            scale: m(f, 5.7 * fps, 7.5 * fps, 1.2, 0.86),
            rotate: `${m(f, 5.7 * fps, 7.5 * fps, 0, -3)}deg`,
          }}
        >
          <Img
            src={staticFile("designer-ad/space-frame.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 55,
          left: 120,
          fontSize: 88,
          fontWeight: 650,
          letterSpacing: -5,
          opacity: m(f, 0, 20, 0, 1),
        }}
      >
        {f < 5.7 * fps ? "Find your perspective." : "Make it worth sharing."}
      </div>
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 55,
          fontSize: 22,
          letterSpacing: 2,
          color: T.muted,
          opacity: m(f, 205, 230, 0, 1),
        }}
      >
        COMMUNITY STUDIO / CONCEPT VIEW
      </div>
      {f > 90 && f < 175 && (
        <div
          style={{
            position: "absolute",
            inset: "180px 300px",
            border: `2px solid ${T.accentInk}`,
            borderRadius: 24,
            opacity: interpolate(f, [90, 110, 165, 175], [0, 0.85, 0.85, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background: T.surface,
          opacity: interpolate(f, [170, 172, 176, 184], [0, 0.95, 0.8, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}

export function AdEnd() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: T.ink,
        color: T.accentInk,
        fontFamily: font,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 128,
          fontWeight: 650,
          letterSpacing: -7,
          opacity: m(f, 0, 24, 0, 1),
          scale: m(f, 0, 40, 0.94, 1),
        }}
      >
        Ideas become spaces<span style={{ color: T.museGlow }}>.</span>
      </div>
      <div
        style={{
          fontSize: 38,
          letterSpacing: 1,
          marginTop: 45,
          opacity: m(f, 18, 38, 0, 1),
          color: T.hairline,
        }}
      >
        muvilion
      </div>
    </AbsoluteFill>
  );
}
