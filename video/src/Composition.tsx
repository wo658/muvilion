import { useLayoutEffect, useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { BoxGeometry, EdgesGeometry, OrthographicCamera } from "three";
import { TOKENS as T } from "../../web/lib/ui/tokens";
import hall from "../../fixtures/sample_hall.json";

const ease = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.65, 0, 0.25, 1),
} as const;
const tween = (t: number, start: number, end: number) =>
  interpolate(t, [start, end], [0, 1], ease);

function Block({
  x,
  z,
  w,
  d,
  h,
  color = T.model,
  edge = T.edge,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color?: string;
  edge?: string;
}) {
  const geometry = useMemo(() => new BoxGeometry(w, h, d), [w, h, d]);
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry]);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      edges.dispose();
    },
    [geometry, edges],
  );
  return (
    <group position={[x, h / 2, z]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={edge} />
      </lineSegments>
    </group>
  );
}

function Camera() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const { camera } = useThree();
  useLayoutEffect(() => {
    const p = tween(t, 6, 8.3);
    const drift = tween(t, 8.3, 10);
    camera.position.set(
      29 * p + 3 * drift,
      60 - 20 * p,
      0.01 + 35 * p - 2 * drift,
    );
    camera.lookAt(0, 0, 0);
    (camera as OrthographicCamera).zoom = 22 - 2 * p;
    camera.updateProjectionMatrix();
  }, [camera, t]);
  return null;
}

function Hall() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const lift = tween(t, 6.1, 7.8);
  const { width, height } = hall.venue;
  return (
    <>
      <Camera />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[-18, 35, 20]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-bias={-0.001}
      />
      <group position={[0, -0.25, 0]}>
        <Block x={0} z={0} w={width} d={height} h={0.25} color={T.surface} />
      </group>
      {Array.from({ length: 9 }, (_, i) => (
        <Block
          key={`gx${i}`}
          x={-20 + i * 5}
          z={0}
          w={0.018}
          d={30}
          h={0.008}
          color={T.hairline}
          edge={T.hairline}
        />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <Block
          key={`gz${i}`}
          x={0}
          z={-15 + i * 5}
          w={40}
          d={0.018}
          h={0.008}
          color={T.hairline}
          edge={T.hairline}
        />
      ))}
      <Block
        x={0}
        z={14.85}
        w={40}
        d={0.3}
        h={0.08 + 2.3 * lift}
        color={T.modelShade}
      />
      <Block
        x={-19.85}
        z={0}
        w={0.3}
        d={30}
        h={0.08 + 2.3 * lift}
        color={T.modelShade}
      />
      <Block
        x={19.85}
        z={0}
        w={0.3}
        d={30}
        h={0.08 + 0.3 * lift}
        color={T.modelShade}
      />
      <Block x={-11} z={-14.85} w={18} d={0.3} h={0.08 + 0.3 * lift} />
      <Block x={11} z={-14.85} w={18} d={0.3} h={0.08 + 0.3 * lift} />
      {hall.venue.obstacles.map((o) => {
        const xs = o.polygon.map((p) => p.x),
          zs = o.polygon.map((p) => p.y);
        const minX = Math.min(...xs),
          maxX = Math.max(...xs),
          minZ = Math.min(...zs),
          maxZ = Math.max(...zs);
        return (
          <Block
            key={o.id}
            x={(minX + maxX) / 2 - 20}
            z={(minZ + maxZ) / 2 - 15}
            w={maxX - minX}
            d={maxZ - minZ}
            h={0.1 + lift * (o.kind === "column" ? 3.6 : 1.2)}
            color={T.venueExisting}
          />
        );
      })}
      {hall.booths.map((b, i) => {
        const col = i % 6,
          row = Math.floor(i / 6);
        const p = tween(t, 3.05 + row * 0.12, 4.9 + row * 0.12);
        const x0 = -12.5 + col * 5,
          x1 = [-14.5, -10.5, -6.5, 6.5, 10.5, 14.5][col];
        const z0 = -8 + row * 5,
          z1 = -8 + row * 5.1;
        const x = x0 + (x1 - x0) * p,
          z = z0 + (z1 - z0) * p;
        const appear = tween(t, 0.6 + i * 0.025, 1.4 + i * 0.025);
        const accent = p > 0 && p < 1;
        return (
          <group key={b.id} position={[x, 0, z]} scale={[appear, 1, appear]}>
            <Block
              x={0}
              z={0}
              w={b.w}
              d={b.h}
              h={0.035}
              color={accent ? T.accentSoft : T.objectBooth}
              edge={accent ? T.accent : T.venuePartitionEdge}
            />
            <Block
              x={0}
              z={1.42}
              w={3}
              d={0.16}
              h={0.04 + 2.3 * lift}
              color={i % 3 === 0 ? T.accent : T.model}
              edge={T.venuePartitionEdge}
            />
            <Block x={-1.42} z={0} w={0.16} d={3} h={0.04 + 2.3 * lift} />
            {lift > 0.001 ? (
              <group scale={[1, lift, 1]}>
                <Block
                  x={0.35}
                  z={0.25}
                  w={1.3}
                  d={0.65}
                  h={0.9}
                  color={T.modelShade}
                />
                <Block
                  x={0.4}
                  z={-0.9}
                  w={0.65}
                  d={0.65}
                  h={0.45}
                  color={T.objectSofa}
                />
              </group>
            ) : null}
          </group>
        );
      })}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 26]} />
        <meshBasicMaterial
          color={T.accentSoft}
          transparent
          opacity={tween(t, 4.3, 5.2) * 0.75}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh
          key={i}
          position={[0, 0.025, -11 + i * 2.6]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.065, 1.1]} />
          <meshBasicMaterial
            color={T.accent}
            transparent
            opacity={tween(t, 4.8, 5.5)}
          />
        </mesh>
      ))}
    </>
  );
}

function Headline({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 112,
        top: 310,
        width: 470,
        opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], ease),
        translate: `0 ${interpolate(frame, [0, 0.5 * fps], [24, 0], ease)}px`,
      }}
    >
      <div
        style={{
          color: T.accent,
          fontSize: 23,
          fontWeight: 600,
          letterSpacing: 4,
          marginBottom: 30,
        }}
      >
        {step}
      </div>
      <div
        style={{
          fontSize: 92,
          lineHeight: 1.17,
          fontWeight: 750,
          letterSpacing: -5,
          whiteSpace: "pre-line",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          lineHeight: 1.6,
          color: T.muted,
          marginTop: 32,
          whiteSpace: "pre-line",
        }}
      >
        {detail}
      </div>
    </div>
  );
}

function Progress() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 96,
        left: 112,
        display: "flex",
        gap: 12,
      }}
    >
      {[0, 3, 6].map((start, i) => (
        <div
          key={start}
          style={{ height: 3, width: 85, background: T.hairline }}
        >
          <div
            style={{
              height: 3,
              width: `${interpolate(f / fps, [start, [3, 6, 10][i]], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
              background: T.accent,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export const MyComposition = () => (
  <AbsoluteFill
    style={{
      backgroundColor: T.bg,
      color: T.ink,
      fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 112,
        fontSize: 35,
        fontWeight: 750,
        letterSpacing: -1.5,
      }}
    >
      muvilion<span style={{ color: T.accent }}>.</span>
    </div>
    <div
      style={{
        position: "absolute",
        top: 88,
        right: 112,
        fontSize: 18,
        letterSpacing: 3,
        color: T.muted,
      }}
    >
      SPACE, IN MOTION
    </div>
    <div
      style={{
        position: "absolute",
        left: 560,
        top: 140,
        width: 1290,
        height: 800,
      }}
    >
      <ThreeCanvas
        width={1290}
        height={800}
        orthographic
        camera={{ position: [0, 60, 0.01], zoom: 22, near: 0.1, far: 200 }}
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <Hall />
      </ThreeCanvas>
    </div>
    <Sequence durationInFrames={90} name="01 · 도면">
      <Headline
        step="01 / PLAN"
        title={"도면에서\n시작해요."}
        detail={"공간의 구조를\n한눈에 파악하고."}
      />
    </Sequence>
    <Sequence from={90} durationInFrames={90} name="02 · 배치 변화">
      <Headline
        step="02 / ARRANGE"
        title={"배치를 바꿔,\n흐름을 열고."}
        detail={"같은 공간, 다른 가능성.\n배치의 변화를 살펴보세요."}
      />
    </Sequence>
    <Sequence from={180} durationInFrames={120} name="03 · 3D 전환">
      <Headline
        step="03 / EXPLORE"
        title={"이제,\n공간으로."}
        detail={"평면의 아이디어를\n입체적으로 확인하세요."}
      />
    </Sequence>
    <Progress />
    <div
      style={{
        position: "absolute",
        right: 112,
        bottom: 80,
        fontSize: 20,
        color: T.muted,
      }}
    >
      SAMPLE HALL A · 40 × 30 m{" "}
      <span style={{ paddingLeft: 26 }}>연출 샘플 · 실제 계산 결과 아님</span>
    </div>
  </AbsoluteFill>
);
