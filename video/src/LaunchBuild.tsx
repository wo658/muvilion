// 0:27.5–0:42.5 of the launch film: Muvi builds the Seongsu floor.
// The recorded Muse design is replayed in 3D group by group, the way the design
// workflow builds a draft with edit_design calls: partitions first, then each
// area along the visitor route, lighting and signage, then the feature walls.
// Every object and wall graphic is the saved one; the grouping is illustrative.
import { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { TOKENS as T } from "../../web/lib/ui/tokens";
import muviFace from "../../web/public/mascot/muvi-face.svg";
import design from "../public/launch-current/popup-design.json";
import { Ceiling, Floor, Piece, SLAB, Surfaces } from "./LaunchOpening3D";

export const BUILD_FRAMES = 480;
const font = '"SF Pro Display",Arial,sans-serif';
const mono = '"SF Mono",Menlo,monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const back = Easing.bezier(0.34, 1.56, 0.64, 1);
const m = (f: number, a: number, b: number, x: number, y: number, e = out) =>
  interpolate(f, [a, b], [x, y], { ...clamp, easing: e });

type Obj = (typeof design.objects)[number];
const W = design.width;
const D = design.depth;
const wx = (x: number) => (x - 0.5) * W;
const wz = (y: number) => (y - 0.5) * D;

// Areas in visitor-route order; furniture joins the nearest area centre.
const ROUTE = ["Entry and check-in", "Fitting bar zone", "Photo walk", "Listening lounge", "Messenger demo", "Sharing and consultation"];
const SHORT: Record<string, string> = {
  "Entry and check-in": "Entry and check-in",
  "Fitting bar zone": "Fitting bars",
  "Photo walk": "Photo walk",
  "Listening lounge": "Listening lounge",
  "Messenger demo": "Messenger booths",
  "Sharing and consultation": "Photo wall and pickup",
};

type Step = { label: string; at: number; dur: number; objects: Obj[] };
const BRIEF_AT = 20;
const SEARCH_AT = 40;
const REVIEW_AT = 352;
const SUBMIT_AT = 378;
const WALLS_AT = 322;
const WALLS_DUR = 26;

function plan(): Step[] {
  const zones = ROUTE.map((label) => design.zones.find((z) => z.label === label)!);
  const nearest = (o: Obj) => {
    let best = 0;
    let dist = Infinity;
    zones.forEach((z, i) => {
      const d = Math.hypot((o.x - z.x) * W, (o.y - z.y) * D);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  };
  const partitions = design.objects.filter((o) => o.kind === "partition");
  const overhead = design.objects.filter((o) => o.kind === "light" || o.kind === "hanging-sign");
  const rest = design.objects.filter((o) => !partitions.includes(o) && !overhead.includes(o));
  const areas = ROUTE.map((label, i) => ({ label: SHORT[label], objects: rest.filter((o) => nearest(o) === i) }));
  const steps: Step[] = [{ label: "Partitions and backdrops", at: 62, dur: 34, objects: partitions }];
  areas.forEach((a, i) => steps.push({ label: a.label, at: 100 + i * 30, dur: 28, objects: a.objects }));
  steps.push({ label: "Lighting and signage", at: 282, dur: 36, objects: overhead });
  return steps;
}
const STEPS = plan();

// When each object lands (local frame) and where Muvi's spark is meanwhile.
const LAND = new Map<string, number>();
const ORDER: { at: number; o: Obj }[] = [];
for (const s of STEPS) {
  const sorted = [...s.objects].sort((a, b) => a.x + a.y - (b.x + b.y));
  sorted.forEach((o, i) => {
    const at = s.at + (sorted.length > 1 ? (i / (sorted.length - 1)) * s.dur * 0.8 : 0);
    LAND.set(o.id, at);
    ORDER.push({ at, o });
  });
}
const TOTAL = design.objects.length;

// Each piece drops in and scales up about its own footprint centre.
function Grow({ o }: { o: Obj }) {
  const f = useCurrentFrame();
  const at = LAND.get(o.id) ?? 0;
  if (f < at) return null;
  const t = Math.max(0.001, m(f, at, at + 12, 0, 1, back));
  const drop = m(f, at, at + 10, 2.4, 0, out);
  const px = wx(o.x);
  const pz = wz(o.y);
  // Translate to the footprint centre, scale, translate back.
  return (
    <group position={[px, drop, pz]} scale={[t, t, t]}>
      <group position={[-px, 0, -pz]}>
        <Piece o={o} />
      </group>
    </group>
  );
}

function Spark() {
  const f = useCurrentFrame();
  const pos = useMemo(() => new Vector3(), []);
  // Follow the most recent landing, eased toward the next.
  let i = ORDER.findIndex((e) => e.at > f);
  if (i === -1) i = ORDER.length;
  const prev = ORDER[Math.max(0, i - 1)];
  const next = ORDER[Math.min(ORDER.length - 1, i)];
  const span = Math.max(1, next.at - prev.at);
  const k = i === 0 || i === ORDER.length ? 1 : Easing.inOut(Easing.quad)((f - prev.at) / span);
  const a = new Vector3(wx(prev.o.x), SLAB + prev.o.e + prev.o.h + 1.4, wz(prev.o.y));
  const b = new Vector3(wx(next.o.x), SLAB + next.o.e + next.o.h + 1.4, wz(next.o.y));
  pos.copy(a).lerp(b, Math.min(1, Math.max(0, k)));
  pos.y += Math.sin(f / 5) * 0.15;
  const show = m(f, 50, 62, 0, 1) * (1 - m(f, REVIEW_AT, REVIEW_AT + 16, 0, 1));
  if (show <= 0.01) return null;
  return (
    <group position={pos.toArray()} scale={show}>
      <mesh>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshBasicMaterial color={T.muviSparkCore} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.75, 24, 24]} />
        <meshBasicMaterial color={T.muviSparkGlow} transparent opacity={0.28} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight color={T.muviSparkGlow} intensity={18} distance={9} />
    </group>
  );
}

// Camera: a slow, high three-quarter orbit while the floor fills, then a dive
// through the ceiling plane to eye level in the entry.
const EYE = new Vector3(-4.4, 2.05, 1.5);
const EYE_AIM = new Vector3(-5.8, 0.9, -8);
const DIVE = 400;
function orbit(f: number) {
  const az = interpolate(f, [0, DIVE], [-38, 12], { ...clamp, easing: Easing.bezier(0.35, 0, 0.65, 1) });
  const r = interpolate(f, [0, DIVE], [56, 47], clamp);
  const h = interpolate(f, [0, DIVE], [42, 34], clamp);
  const a = (az * Math.PI) / 180;
  return new Vector3(Math.sin(a) * r, h, Math.cos(a) * r);
}
function BuildCamera() {
  const f = useCurrentFrame();
  const { camera } = useThree();
  useLayoutEffect(() => {
    const u = m(f, DIVE, BUILD_FRAMES - 4, 0, 1, inOut);
    const pos = orbit(Math.min(f, DIVE)).lerp(EYE, u);
    // Bow the dive path so it sweeps in rather than sliding straight.
    pos.x += Math.sin(Math.PI * u) * 6;
    const aim = new Vector3(0, 0, 0).lerp(EYE_AIM, m(f, DIVE, BUILD_FRAMES - 4, 0, 1, inOut));
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(aim);
    camera.rotateZ(((-3 * (1 - u) + 1.5 * Math.sin(Math.PI * u)) * Math.PI) / 180);
    (camera as PerspectiveCamera).fov = 30 + 24 * u;
    // Frame the floor in the space right of the log; centre again for the dive.
    (camera as PerspectiveCamera).setViewOffset(1920, 1080, -230 * (1 - u), 30 * (1 - u), 1920, 1080);
    (camera as PerspectiveCamera).updateProjectionMatrix();
  }, [camera, f]);
  return null;
}

function BuildScene() {
  const f = useCurrentFrame();
  const wallGrow = (i: number) => {
    const at = WALLS_AT + (i / Math.max(1, design.wallSurfaces.length - 1)) * WALLS_DUR * 0.7;
    return m(f, at, at + 10, 0, 1, back);
  };
  return (
    <>
      <BuildCamera />
      <color attach="background" args={[T.bg]} />
      <fog attach="fog" args={[T.bg, 70, 150]} />
      <hemisphereLight args={[T.surface, T.floorIndoor, 1.0]} />
      <directionalLight position={[22, 14, -18]} intensity={0.55} />
      <directionalLight
        position={[-20, 30, 15]}
        intensity={3.1}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-27}
        shadow-camera-right={27}
        shadow-camera-top={27}
        shadow-camera-bottom={-27}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
      <Floor />
      <Ceiling />
      <Surfaces grow={wallGrow} />
      {design.objects.map((o) => (
        <Grow key={o.id} o={o} />
      ))}
      <Spark />
    </>
  );
}

// ── Overlay: Muvi's tool log and the running count ───────────────────────
type Row = { at: number; tool: string; text: string; count?: number; done: number };
const ROWS: Row[] = [
  { at: BRIEF_AT, tool: "set_design_brief", text: "One-way route, 1.5 m aisle", done: BRIEF_AT + 14 },
  { at: SEARCH_AT, tool: "search_design_assets", text: "stools, mirrors, sofas", done: SEARCH_AT + 16 },
  ...STEPS.map((s) => ({ at: s.at - 6, tool: "edit_design", text: s.label, count: s.objects.length, done: s.at + s.dur })),
  { at: WALLS_AT - 6, tool: "edit_design", text: "Feature walls", count: design.wallSurfaces.length, done: WALLS_AT + WALLS_DUR },
  { at: REVIEW_AT, tool: "review_design", text: "Routes clear · floor covered", done: REVIEW_AT + 18 },
  { at: SUBMIT_AT, tool: "submit_design", text: "Ready for your review", done: SUBMIT_AT + 10 },
];
const ROW_H = 66;
const VISIBLE = 8;

function Spinner({ f }: { f: number }) {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        border: `3px solid ${T.hairlineStrong}`,
        borderTopColor: T.accent,
        rotate: `${f * 18}deg`,
        display: "inline-block",
      }}
    />
  );
}

function ToolRow({ r, f }: { r: Row; f: number }) {
  const a = m(f, r.at, r.at + 10, 0, 1);
  const done = f >= r.done;
  return (
    <div
      style={{
        height: ROW_H - 10,
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 18px",
        borderRadius: 14,
        background: done ? T.surface : T.accentSoft,
        border: `1px solid ${done ? T.hairline : T.accentSoft}`,
        opacity: a,
        translate: `${(1 - a) * -30}px 0`,
      }}
    >
      {done ? (
        <span style={{ width: 20, height: 20, borderRadius: 10, background: T.ok, color: T.accentInk, fontSize: 13, display: "grid", placeItems: "center", fontWeight: 700 }}>✓</span>
      ) : (
        <Spinner f={f} />
      )}
      <span style={{ fontFamily: mono, fontSize: 17, color: T.accent, whiteSpace: "nowrap" }}>{r.tool}</span>
      <span style={{ fontFamily: font, fontSize: 21, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{r.text}</span>
      {r.count !== undefined && (
        <span style={{ fontFamily: font, fontSize: 20, fontWeight: 600, color: done ? T.ok : T.accent }}>+{r.count}</span>
      )}
    </div>
  );
}

function Log() {
  const f = useCurrentFrame();
  const shown = ROWS.filter((r) => f >= r.at).length;
  // Scroll smoothly once more rows arrive than fit.
  const scroll = ROWS.reduce((acc, r, i) => acc + (i >= VISIBLE ? m(f, r.at, r.at + 10, 0, ROW_H, inOut) : 0), 0);
  const enter = m(f, 0, 22, 0, 1);
  const leave = m(f, DIVE - 6, DIVE + 24, 0, 1, inOut);
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        top: 150,
        width: 600,
        padding: 22,
        borderRadius: 28,
        background: T.surface,
        border: `1px solid ${T.hairline}`,
        boxShadow: `0 30px 90px ${T.shadowColor}`,
        opacity: enter * (1 - leave),
        transform: `perspective(1600px) translateX(${(1 - enter) * -80 - leave * 140}px) rotateY(${8 - leave * 20}deg)`,
        transformOrigin: "left center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Img src={muviFace} style={{ width: 40, height: 40 }} />
        <span style={{ fontFamily: font, fontSize: 24, fontWeight: 600, color: T.ink }}>Muvi</span>
        <span style={{ fontFamily: font, fontSize: 18, color: T.muted }}>{f < SUBMIT_AT + 10 ? "designing…" : "done"}</span>
      </div>
      <div style={{ padding: "14px 18px", borderRadius: 16, background: T.sunken, fontFamily: font, fontSize: 19, lineHeight: 1.4, color: T.inkSoft, marginBottom: 14, opacity: m(f, 4, 16, 0, 1) }}>
        Design the entire floor with actual furniture and partitions, connecting the experiences with a one-way visitor journey.
      </div>
      <div style={{ height: VISIBLE * ROW_H, overflow: "hidden" }}>
        <div style={{ translate: `0 ${-scroll}px` }}>
          {ROWS.slice(0, Math.max(shown, 0)).map((r, i) => (
            <ToolRow key={i} r={r} f={f} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Counter() {
  const f = useCurrentFrame();
  const placed = ORDER.filter((e) => e.at <= f).length;
  const a = m(f, 54, 70, 0, 1) * (1 - m(f, DIVE - 6, DIVE + 20, 0, 1, inOut));
  const bump = ORDER.some((e) => f - e.at >= 0 && f - e.at < 3) ? 1.04 : 1;
  return (
    <div style={{ position: "absolute", right: 90, bottom: 84, textAlign: "right", fontFamily: font, opacity: a }}>
      <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -5, color: T.ink, lineHeight: 1, scale: bump, fontVariantNumeric: "tabular-nums" }}>{placed}</div>
      <div style={{ fontSize: 26, color: T.inkSoft, marginTop: 6 }}>of {TOTAL} installations placed</div>
      <div style={{ fontSize: 22, color: T.muted, marginTop: 4, opacity: m(f, WALLS_AT, WALLS_AT + 10, 0, 1) }}>
        + {design.wallSurfaces.length} wall graphics
      </div>
    </div>
  );
}

function Headline() {
  const f = useCurrentFrame();
  const a = m(f, 6, 24, 0, 1) * (1 - m(f, DIVE - 10, DIVE + 10, 0, 1));
  const b = m(f, DIVE + 18, DIVE + 36, 0, 1);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 48, textAlign: "center", fontFamily: font, opacity: a, translate: `0 ${(1 - a) * 24}px` }}>
        <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: T.accent, fontWeight: 600 }}>02 / Muvi designs</div>
        <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -2, color: T.ink, marginTop: 8 }}>From an empty floor, piece by piece.</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 64, display: "flex", justifyContent: "center", opacity: b, translate: `0 ${(1 - b) * 24}px`, filter: `blur(${(1 - b) * 8}px)` }}>
        <div style={{ padding: "18px 44px", borderRadius: 60, background: T.surface, boxShadow: `0 20px 60px ${T.shadowColor}`, fontFamily: font, fontSize: 56, fontWeight: 700, letterSpacing: -2, color: T.ink }}>
          Then you step inside.
        </div>
      </div>
    </>
  );
}

export function LaunchBuild() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <AbsoluteFill style={{ opacity: m(f, 0, 12, 0, 1) }}>
        <ThreeCanvas width={1920} height={1080} shadows camera={{ fov: 30, near: 0.1, far: 400, position: [0, 60, 30] }} gl={{ antialias: true }}>
          <BuildScene />
        </ThreeCanvas>
      </AbsoluteFill>
      <Headline />
      <Log />
      <Counter />
      <div style={{ position: "absolute", left: 72, bottom: 32, fontSize: 20, color: T.muted, fontFamily: font }}>
        Recorded Muse design of the Seongsu sample, replayed step by step · tool grouping illustrative
      </div>
    </AbsoluteFill>
  );
}
