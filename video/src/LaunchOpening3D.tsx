// 0:00–0:20 of the launch film: the saved Seongsu design rendered in 3D, the
// sources floating in perspective and settling into the composer, then the
// chapter pill that grows into the first screen-recording card.
import React, { useLayoutEffect, useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  PerspectiveCamera,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from "three";
import { TOKENS as T } from "../../web/lib/ui/tokens";
import muviFace from "../../web/public/mascot/muvi-face.svg";
import design from "../public/launch-current/popup-design.json";
import { CARD, COMPOSER, Panel, Status } from "./LaunchPrimitives";

const font = '"SF Pro Display",Arial,sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const m = (f: number, a: number, b: number, x: number, y: number, e = out) =>
  interpolate(f, [a, b], [x, y], { ...clamp, easing: e });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (d: number) => (d * Math.PI) / 180;

// Bars (2.5 s = 75 frames).
const MODEL_END = 225; // 0–7.5 s: saved design in 3D
const SOURCES_END = 525; // 7.5–17.5 s: sources → composer → pill
export const OPENING_FRAMES = 600;

type Obj = (typeof design.objects)[number];
const W = design.width;
const D = design.depth;
const wx = (x: number) => (x - 0.5) * W;
const wz = (y: number) => (y - 0.5) * D;
const SLAB = 0.22;
const WALL_H = 2.6;

// Saved object colors are mapped onto film tokens (a white study model).
function tone(o: Obj): string {
  const c = o.color.toUpperCase();
  if (c === "#4A7C59") return T.foliage;
  if (c === "#111111" || c === "#2A2A2E")
    return o.kind === "partition" ? T.objectStage : T.modelEdge;
  if (c === "#8A5A3B") return T.objectSofa;
  if (c === "#F5F0E8" || c === "#E8DCC8") return T.objectOther;
  return T.model;
}

function Solid({
  geometry,
  color,
  position,
  edges = true,
}: {
  geometry: BoxGeometry | CylinderGeometry | SphereGeometry | ExtrudeGeometry;
  color: string;
  position?: [number, number, number];
  edges?: boolean;
}) {
  const e = useMemo(
    () => (edges ? new EdgesGeometry(geometry, 30) : null),
    [geometry, edges],
  );
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      e?.dispose();
    },
    [geometry, e],
  );
  return (
    <group position={position}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      {e && (
        <lineSegments geometry={e}>
          <lineBasicMaterial
            color={color === T.modelEdge ? T.ink : T.edge}
            transparent
            opacity={0.7}
          />
        </lineSegments>
      )}
    </group>
  );
}

function Box({
  w,
  h,
  d,
  at,
  color,
  edges,
}: {
  w: number;
  h: number;
  d: number;
  at: [number, number, number];
  color: string;
  edges?: boolean;
}) {
  const g = useMemo(() => new BoxGeometry(w, h, d), [w, h, d]);
  return <Solid geometry={g} color={color} position={at} edges={edges} />;
}

function Cyl({
  r,
  h,
  at,
  color,
  r2,
}: {
  r: number;
  h: number;
  at: [number, number, number];
  color: string;
  r2?: number;
}) {
  const g = useMemo(() => new CylinderGeometry(r, r2 ?? r, h, 28), [r, r2, h]);
  return <Solid geometry={g} color={color} position={at} edges={false} />;
}

function Ball({
  r,
  at,
  color,
}: {
  r: number;
  at: [number, number, number];
  color: string;
}) {
  const g = useMemo(() => new SphereGeometry(r, 28, 18), [r]);
  return <Solid geometry={g} color={color} position={at} edges={false} />;
}

// Simple, recognizable stand-ins for the saved fixtures (catalog dimensions).
function Piece({ o }: { o: Obj }) {
  const c = tone(o);
  const { w, d, h } = o;
  let body: React.ReactNode;
  if (o.color.toUpperCase() === "#4A7C59") {
    body = (
      <>
        <Cyl r={w * 0.28} r2={w * 0.22} h={h * 0.36} at={[0, h * 0.18, 0]} color={T.modelShade} />
        <Ball r={w * 0.46} at={[0, h * 0.36 + w * 0.42, 0]} color={T.objectPlant} />
      </>
    );
  } else if (o.fixture === "work-table") {
    body = (
      <>
        <Box w={w} h={0.05} d={d} at={[0, h - 0.025, 0]} color={c} />
        <Box w={w * 0.9} h={h - 0.05} d={0.06} at={[0, (h - 0.05) / 2, 0]} color={T.modelEdge} edges={false} />
      </>
    );
  } else if (o.fixture === "event-chair") {
    body = (
      <>
        <Box w={w * 0.86} h={0.07} d={d * 0.8} at={[0, 0.46, -d * 0.05]} color={T.objectSofa} />
        <Box w={w * 0.86} h={0.38} d={0.05} at={[0, 0.66, d * 0.38]} color={T.modelEdge} edges={false} />
        <Cyl r={0.025} h={0.43} at={[0, 0.215, 0]} color={T.modelEdge} />
      </>
    );
  } else if (o.fixture === "lounge-sofa") {
    body = (
      <>
        <Box w={w} h={0.42} d={d} at={[0, 0.21, 0]} color={c} />
        <Box w={w} h={0.44} d={0.18} at={[0, 0.63, d / 2 - 0.09]} color={c} />
        <Box w={0.16} h={0.24} d={d} at={[-w / 2 + 0.08, 0.54, 0]} color={c} />
        <Box w={0.16} h={0.24} d={d} at={[w / 2 - 0.08, 0.54, 0]} color={c} />
      </>
    );
  } else if (o.fixture === "studio-light") {
    body = (
      <>
        <Cyl r={0.02} h={h} at={[0, h / 2, 0]} color={T.modelEdge} />
        <Box w={0.42} h={0.42} d={0.12} at={[0, h - 0.2, 0]} color={T.surface} />
      </>
    );
  } else if (o.fixture === "phone-stand") {
    body = (
      <>
        <Cyl r={0.018} h={h} at={[0, h / 2, 0]} color={T.modelEdge} />
        <Box w={0.09} h={0.17} d={0.02} at={[0, h, 0]} color={T.modelEdge} edges={false} />
      </>
    );
  } else if (o.asset === "display_plinth" || /plinth/.test(o.id)) {
    body = <Cyl r={w * 0.42} h={h} at={[0, h / 2, 0]} color={T.objectOther} />;
  } else {
    body = <Box w={w} h={h} d={d} at={[0, h / 2, 0]} color={c} edges={c !== T.modelEdge} />;
  }
  return (
    <group position={[wx(o.x), SLAB, wz(o.y)]} rotation={[0, rad(-o.rot), 0]}>
      {body}
    </group>
  );
}

function Floor() {
  const slab = useMemo(() => {
    const s = new Shape();
    design.floorBoundary.forEach(([x, y], i) =>
      i === 0 ? s.moveTo(wx(x), -wz(y)) : s.lineTo(wx(x), -wz(y)),
    );
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: SLAB - 0.003, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const top = new ShapeGeometry(s);
    top.rotateX(-Math.PI / 2);
    return { g, top };
  }, []);
  const zoneColor: Record<string, string> = {
    experience: T.zoneStage,
    lounge: T.zoneLounge,
    operations: T.selected,
    exhibition: T.zoneOther,
  };
  return (
    <>
      <Solid geometry={slab.g} color={T.wall} />
      <mesh geometry={slab.top} position={[0, SLAB, 0]} receiveShadow>
        <meshStandardMaterial color={T.floorIndoor} roughness={0.9} />
      </mesh>
      {design.zones
        .filter((z) => zoneColor[z.purpose])
        .map((z, i) => (
          <mesh
            key={`${z.label}-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[wx(z.x), SLAB + 0.004 + i * 0.0006, wz(z.y)]}
            receiveShadow
          >
            <planeGeometry args={[z.w, z.d]} />
            <meshStandardMaterial
              color={zoneColor[z.purpose]}
              roughness={0.9}
              polygonOffset
              polygonOffsetFactor={-1 - i}
            />
          </mesh>
        ))}
      {design.walls.map(([ax, ay, bx, by], i) => {
        const x1 = wx(ax),
          z1 = wz(ay),
          x2 = wx(bx),
          z2 = wz(by);
        const len = Math.hypot(x2 - x1, z2 - z1);
        return (
          <group
            key={i}
            position={[(x1 + x2) / 2, SLAB, (z1 + z2) / 2]}
            rotation={[0, -Math.atan2(z2 - z1, x2 - x1), 0]}
          >
            <Box w={len + 0.2} h={WALL_H} d={0.2} at={[0, WALL_H / 2, 0]} color={T.model} />
          </group>
        );
      })}
    </>
  );
}

// One continuous arc: high and twisted → down and around → close on the
// fitting bars. A single eased progress drives every parameter, so the move
// never stops mid-shot.
function ModelCamera() {
  const f = useCurrentFrame();
  const { camera } = useThree();
  useLayoutEffect(() => {
    const p = interpolate(f, [0, MODEL_END], [0, 1], {
      ...clamp,
      easing: Easing.bezier(0.35, 0, 0.6, 0.9),
    });
    const s = inOut(p);
    // A gentle push into the cut so the move never dies before 7.5 s.
    const k = interpolate(f, [170, MODEL_END], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
    const yaw = rad(lerp(-64, 14, p) + 8 * k);
    const pitch = rad(lerp(70, 28, p) - 3 * k);
    const dist = Math.exp(lerp(Math.log(66), Math.log(24), p)) * (1 - 0.2 * k);
    const roll = rad(lerp(-7, 0.6, s));
    const tx = lerp(1.5, wx(0.34), s);
    const tz = lerp(1.5, wz(0.36), s);
    const ty = lerp(0, 0.9, s);
    camera.position.set(
      tx + dist * Math.cos(pitch) * Math.sin(yaw),
      ty + dist * Math.sin(pitch),
      tz + dist * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    camera.rotateZ(roll);
    (camera as PerspectiveCamera).updateProjectionMatrix();
  }, [camera, f]);
  return null;
}

function ModelScene() {
  const pieces = design.objects.filter(
    (o) => !o.e && o.kind !== "hanging-sign",
  );
  return (
    <>
      <ModelCamera />
      <color attach="background" args={[T.bg]} />
      <fog attach="fog" args={[T.bg, 70, 150]} />
      <hemisphereLight args={[T.surface, T.floorIndoor, 0.85]} />
      <directionalLight position={[22, 14, -18]} intensity={0.55} />
      <directionalLight
        position={[-20, 30, 15]}
        intensity={3.3}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-27}
        shadow-camera-right={27}
        shadow-camera-top={27}
        shadow-camera-bottom={-27}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-radius={2}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
      <Floor />
      {pieces.map((o) => (
        <Piece key={o.id} o={o} />
      ))}
    </>
  );
}

function Footnote({ children }: { children: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        bottom: 32,
        fontSize: 20,
        color: T.muted,
        fontFamily: font,
      }}
    >
      {children}
    </div>
  );
}

function Line({
  f,
  from,
  to,
  children,
  size = 92,
  top = 116,
}: {
  f: number;
  from: number;
  to: number;
  children: React.ReactNode;
  size?: number;
  top?: number;
}) {
  const a = m(f, from, from + 14, 0, 1);
  const z = m(f, to - 10, to, 0, 1, inOut);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        textAlign: "center",
        fontFamily: font,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: -size * 0.035,
        lineHeight: 1.05,
        color: T.ink,
        opacity: a * (1 - z),
        translate: `0 ${(1 - a) * 36 - z * 24}px`,
        filter: `blur(${(1 - a) * 10 + z * 8}px)`,
      }}
    >
      {children}
    </div>
  );
}

function ModelBeat() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <ThreeCanvas
        width={1920}
        height={1080}
        shadows
        camera={{ fov: 30, near: 0.5, far: 400, position: [0, 60, 30] }}
        gl={{ antialias: true }}
      >
        <ModelScene />
      </ThreeCanvas>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 360,
          background: `linear-gradient(${T.bg} 0%, ${T.bg} 34%, transparent 100%)`,
          opacity: 0.92,
        }}
      />
      <Line f={f} from={12} to={132}>
        Make room for an idea.
      </Line>
      <Line f={f} from={140} to={MODEL_END + 20} size={64} top={110}>
        From fitting bars to a photo walk.
      </Line>
      <Footnote>
        Rendered from the saved Muse demo · Seongsu pop-up · simplified model
      </Footnote>
    </AbsoluteFill>
  );
}

// ——— Sources in perspective → composer ———

const PROMPT =
  "Turn this floor plan into a pop-up experience. Bring the brief, the brand and the visitor journey together.";
const brief = design.sources.find((s) => s.kind === "brief")!;
const objective = brief.text
  .split("\n")
  .find((l) => l.startsWith("Objective:"))!
  .replace("Objective: ", "")
  .split(". ")[0];
const briefTitle = brief.name.split(" · ")[0];

const CHIP = { w: 236, h: 74, gap: 18, y: COMPOSER.cy - COMPOSER.h / 2 + 44 + 37 };
const chipX = (i: number) =>
  960 - COMPOSER.w / 2 + 52 + CHIP.w / 2 + i * (CHIP.w + CHIP.gap);

const SETTLE = 150; // local frame the cards start flying into the composer
const LAND = 192;
const TYPE_FROM = 182;
const TYPE_TO = 262;
const SEND = 268;

type Pose = { x: number; y: number; z: number; ry: number; rx: number; rz: number; w: number; h: number };
const CARDS: { label: string; pose: Pose; thumb: string }[] = [
  {
    label: "Floor plan",
    thumb: staticFile("launch-current/floor-plan.png"),
    pose: { x: -620, y: -10, z: -260, ry: 24, rx: 6, rz: -2, w: 640, h: 540 },
  },
  {
    label: "Brief",
    thumb: "",
    pose: { x: 30, y: 40, z: 60, ry: -4, rx: -5, rz: 1.5, w: 520, h: 470 },
  },
  {
    label: "Brand",
    thumb: staticFile("launch-current/fitting-bar.webp"),
    pose: { x: 640, y: -30, z: -180, ry: -22, rx: 4, rz: 2, w: 500, h: 470 },
  },
];

function BriefThumb() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: T.surface,
        padding: "8px 9px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div style={{ height: 6, width: "70%", borderRadius: 3, background: T.ink }} />
      {[100, 92, 96, 60].map((w, i) => (
        <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 2, background: T.hairline }} />
      ))}
    </div>
  );
}

function Chip({ i }: { i: number }) {
  const c = CARDS[i];
  return (
    <div
      style={{
        width: CHIP.w,
        height: CHIP.h,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 18px 10px 10px",
        borderRadius: 18,
        background: T.sunken,
        fontFamily: font,
      }}
    >
      <div
        style={{
          width: 76,
          height: 54,
          flex: "none",
          borderRadius: 10,
          overflow: "hidden",
          border: `1px solid ${T.hairline}`,
        }}
      >
        {c.thumb ? (
          <Img src={c.thumb} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <BriefThumb />
        )}
      </div>
      <span style={{ fontSize: 24, color: T.inkSoft, whiteSpace: "nowrap" }}>{c.label}</span>
    </div>
  );
}

function Kicker({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 17,
        letterSpacing: 3,
        textTransform: "uppercase",
        color: T.muted,
      }}
    >
      {children}
    </div>
  );
}

function CardFace({ i, pose }: { i: number; pose: Pose }) {
  const c = CARDS[i];
  const box: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: pose.w,
    height: pose.h,
    boxSizing: "border-box",
    fontFamily: font,
    color: T.ink,
  };
  if (i === 0)
    return (
      <div style={{ ...box, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <Kicker>Floor plan · 39 × 33 m</Kicker>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", borderRadius: 12, background: T.surface }}>
          <Img
            src={c.thumb}
            style={{ width: "100%", height: "100%", objectFit: "contain", scale: 1.16, transformOrigin: "50% 58%" }}
          />
        </div>
      </div>
    );
  if (i === 1)
    return (
      <div style={{ ...box, padding: "34px 38px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Kicker>Brief</Kicker>
        <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1.6, lineHeight: 1.05 }}>
          {briefTitle}
        </div>
        <div style={{ fontSize: 23, lineHeight: 1.38, color: T.inkSoft }}>{objective}.</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 17, color: T.muted, lineHeight: 1.35 }}>
          Check-in · fitting bars · photo walk · listening lounge · Messenger booths
        </div>
      </div>
    );
  return (
    <div style={{ ...box, display: "flex", flexDirection: "column" }}>
      <Img src={c.thumb} style={{ width: "100%", height: 300, objectFit: "cover" }} />
      <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
        <Kicker>Brand · concept</Kicker>
        <div style={{ fontSize: 26, lineHeight: 1.3, color: T.inkSoft }}>
          Warm off-white surfaces, black acetate lines, bright street light.
        </div>
      </div>
    </div>
  );
}

function FlyingCard({ i, g }: { i: number; g: number }) {
  const p = CARDS[i].pose;
  const t = m(g, SETTLE + i * 6, LAND - 12 + i * 6, 0, 1, inOut);
  const enter = m(g, -14 + i * 6, 22 + i * 6, 0, 1);
  // Gentle float while the camera passes.
  const bob = Math.sin((g + i * 40) / 38) * 8 * (1 - t);
  const x = lerp(p.x, chipX(i) - 960, t);
  const y = lerp(p.y + bob + (1 - enter) * 160, CHIP.y - 540, t);
  const z = lerp(p.z, 0, t);
  const w = lerp(p.w, CHIP.w, t);
  const h = lerp(p.h, CHIP.h, t);
  const face = 1 - m(t, 0.1, 0.55, 0, 1, inOut);
  const chip = m(t, 0.3, 0.7, 0, 1, inOut);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w,
        height: h,
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${lerp(p.ry, 0, t)}deg) rotateX(${lerp(p.rx, 0, t)}deg) rotateZ(${lerp(p.rz, 0, t)}deg) translate(-50%, -50%)`,
        borderRadius: lerp(26, 18, t),
        overflow: "hidden",
        background: face > 0.02 ? T.surface : T.sunken,
        border: `1px solid ${T.hairline}`,
        boxShadow: `0 ${lerp(40, 0, t)}px ${lerp(90, 0, t)}px ${T.shadowColor}`,
        opacity: enter * (g > LAND + 12 ? 0 : 1),
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: chip, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Chip i={i} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: face }}>
        <CardFace i={i} pose={p} />
      </div>
    </div>
  );
}

// A soft contact shadow on an invisible ground below each card.
function Ground({ g }: { g: number }) {
  const fade = 1 - m(g, SETTLE, SETTLE + 30, 0, 1);
  return (
    <div
      style={{
        position: "absolute",
        left: -1400,
        top: 330,
        width: 2800,
        height: 1400,
        transformOrigin: "50% 0",
        transform: "translateZ(-700px) rotateX(90deg)",
        opacity: fade,
      }}
    >
      {CARDS.map((c, i) => (
        <div
          key={c.label}
          style={{
            position: "absolute",
            left: 1400 + c.pose.x - c.pose.w * 0.45,
            top: 700 + c.pose.z - 120,
            width: c.pose.w * 0.9,
            height: 240,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${T.shadowColor}, transparent)`,
            opacity: m(g, -14 + i * 6, 22 + i * 6, 0, 1),
            scale: `${1 + Math.sin((g + i * 40) / 38) * 0.03} 1`,
          }}
        />
      ))}
    </div>
  );
}

function Composer({ g }: { g: number }) {
  const typed = Math.round(interpolate(g, [TYPE_FROM, TYPE_TO], [0, PROMPT.length], clamp));
  const sent = m(g, SEND, SEND + 14, 0, 1);
  const chips = g > LAND + 6;
  return (
    <div
      style={{
        width: COMPOSER.w,
        height: COMPOSER.h,
        padding: "44px 52px 36px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: font,
        color: T.ink,
      }}
    >
      <div style={{ display: "flex", gap: CHIP.gap, marginBottom: 26, height: CHIP.h, opacity: chips ? 1 : 0 }}>
        {CARDS.map((c, i) => (
          <Chip key={c.label} i={i} />
        ))}
      </div>
      <div style={{ fontSize: 46, lineHeight: 1.3, letterSpacing: -0.8, flex: 1 }}>
        {typed === 0 ? <span style={{ color: T.muted }}>Describe the space…</span> : PROMPT.slice(0, typed)}
        {g >= TYPE_FROM - 10 && g < SEND && Math.floor(g / 15) % 2 === 0 && (
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
          <Img src={muviFace} style={{ width: 34, height: 34 }} /> Muse · Design
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
  );
}

function SourcesBeat() {
  const g = useCurrentFrame();
  // Camera: a lateral arc past the three cards, then it squares up to the
  // composer. Inverse transforms are applied to the world.
  const pass = interpolate(g, [0, LAND + 8], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.3, 0.15, 0.45, 1),
  });
  // Three camera beats, one per headline word, over a continuous drift.
  const beats =
    [0, 48, 96].reduce((acc, b) => acc + m(g, b, b + 40, 0, 1, Easing.bezier(0.5, 0, 0.2, 1)), 0) / 3;
  const drive = 0.5 * pass + 0.5 * beats;
  const square = m(g, SETTLE - 36, LAND + 8, 0, 1, inOut);
  const S = lerp(1.22, 1, square);
  const lift = lerp(46, 0, square);
  const yaw = lerp(lerp(30, -12, drive), 0, square);
  const pitch = lerp(lerp(-16, -7, drive), 0, square);
  const roll = lerp(lerp(-3.5, 1.5, drive), 0, square);
  const camX = lerp(lerp(-440, 220, drive), 0, square);
  const dolly = lerp(lerp(-520, -260, drive), 0, square);
  const composerIn = m(g, SETTLE + 14, LAND, 0, 1);
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: "hidden" }}>
      <Sequence from={SETTLE} durationInFrames={SOURCES_END - MODEL_END - SETTLE} layout="none">
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: composerIn,
            scale: lerp(0.94, 1, composerIn),
          }}
        >
          <Panel frames={SOURCES_END - MODEL_END - SETTLE} from={COMPOSER} rest={COMPOSER} to={{ w: 780, h: 120, cy: 540, r: 60 }}>
            <Composer g={g} />
          </Panel>
        </div>
      </Sequence>
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1700,
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 540,
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
            transform: `translateY(${lift}px) translateZ(${dolly}px) rotateZ(${roll}deg) rotateX(${pitch}deg) rotateY(${yaw}deg) translateX(${-camX * (1 - square)}px) scale3d(${S}, ${S}, ${S})`,
          }}
        >
          <Ground g={g} />
          {CARDS.map((c, i) => (
            <FlyingCard key={c.label} i={i} g={g} />
          ))}
        </div>
      </div>
      <Line f={g} from={-4} to={48} size={84}>
        A floor plan.
      </Line>
      <Line f={g} from={48} to={96} size={84}>
        A brief.
      </Line>
      <Line f={g} from={96} to={SETTLE + 4} size={84}>
        A brand.
      </Line>
      <Footnote>Seongsu sample sources · independently authored fictional demo · editorial composer</Footnote>
      <Sequence from={TYPE_FROM - 4} durationInFrames={TYPE_TO - TYPE_FROM + 8}>
        <Audio src={staticFile("designer-ad/photo-typing.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={SEND}>
        <Audio src={staticFile("launch/pop.wav")} volume={0.7} />
      </Sequence>
    </AbsoluteFill>
  );
}

export function LaunchOpening3D() {
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <Sequence durationInFrames={MODEL_END} name="Opening · saved design in 3D">
        <ModelBeat />
      </Sequence>
      <Sequence from={MODEL_END} durationInFrames={SOURCES_END - MODEL_END} name="Opening · sources to composer">
        <SourcesBeat />
      </Sequence>
      <Sequence from={SOURCES_END} durationInFrames={OPENING_FRAMES - SOURCES_END} name="Opening · context pill">
        <Status frames={OPENING_FRAMES - SOURCES_END} text="Start with your context." to={CARD} />
      </Sequence>
    </AbsoluteFill>
  );
}
