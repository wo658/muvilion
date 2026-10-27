"use client";

/**
 * Static site geometry for the 3D view, styled as a white study model: a light floor slab (or
 * sage lawn / stone paving outdoors), white matte booths with kind-specific forms, simple tree
 * and fountain forms, low translucent walls indoors or a thin post fence outdoors, a soft
 * blurred crowding decal on the floor, and accent-colored highlights for what the agent changed.
 * All coordinates go through toWorld() (lib/trajectory/coords.ts).
 */
import { Edges, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { BoothMove } from "@/lib/agent/events";
import type { BoothSpec, DensityGrid, Door, Hotspot, Obstacle, Point, Venue, Zone } from "@/lib/engine/contract";
import { boothRect, center, doorMid, polygonBBox } from "@/lib/geometry";
import { toWorld } from "@/lib/trajectory/coords";
import { heatRgba, HEAT_MAX } from "@/lib/ui/heat";
import type { AnimatedBooth } from "@/lib/ui/placement";
import { shortLabel } from "@/lib/ui/plain";
import { inwardNormal, wallSegments } from "@/lib/ui/site";
import { Label } from "./label";
import { PALETTE as P } from "./palette";

export const BOOTH_HEIGHT = 2.4;
const WALL_HEIGHT = 1.1;
const WALL_T = 0.16;
const OBSTACLE_HEIGHT: Record<Obstacle["kind"], number> = { column: 4.2, restroom: 2.8, stage: 0.8, registration: 1.1, tree: 5, fountain: 0.5, structure: 2.6, other: 2 };

export type HallSceneProps = {
  venue: Venue;
  specs: BoothSpec[];
  booths?: AnimatedBooth[];
  grid?: DensityGrid;
  hotspots?: Hotspot[];
  moves?: BoothMove[];
  fixed?: Record<string, Point>;
  showHeatmap?: boolean;
  showLabels?: boolean;
  /** Booths to call out (outline + label), e.g. the ones a Muse message is about. */
  highlight?: string[];
  /** Door name tags (ids like "D-main"); off in the simple view. */
  showDoorLabels?: boolean;
  /** Short booth names without "· moved" / "· pinned" (simple view). */
  plainLabels?: boolean;
};

export function HallScene({ venue, specs, booths, grid, hotspots = [], moves = [], fixed = {}, showHeatmap = true, showLabels = true, highlight, showDoorLabels = true, plainLabels = false }: HallSceneProps) {
  const W = venue.width;
  const H = venue.height;
  const S = Math.max(W, H);
  const outdoor = venue.setting === "outdoor";
  return (
    <group>
      {/* surrounding ground and the site slab */}
      <mesh rotation-x={-Math.PI / 2} position={toWorld(W / 2, H / 2, -0.14)} receiveShadow>
        <planeGeometry args={[S * 8, S * 8]} />
        <meshStandardMaterial color={P.ground} roughness={1} />
      </mesh>
      <mesh position={toWorld(W / 2, H / 2, -0.07)} receiveShadow>
        <boxGeometry args={[W, 0.14, H]} />
        <meshStandardMaterial color={outdoor ? P.floorOutdoor : P.floorIndoor} roughness={0.95} />
      </mesh>
      {venue.zones.map((z) => (
        <ZonePlane key={z.id} zone={z} />
      ))}
      {!outdoor && <FloorGrid width={W} height={H} />}
      {showHeatmap && grid && <HeatDecal grid={grid} width={W} height={H} />}
      {outdoor ? <Fence venue={venue} /> : <Walls venue={venue} />}
      {venue.doors.map((d) => (
        <DoorMarker key={d.id} door={d} venue={venue} showLabel={showLabels && showDoorLabels} />
      ))}
      {venue.obstacles.map((o) => (
        <ObstacleModel key={o.id} obstacle={o} />
      ))}
      {booths && <Booths booths={booths} specs={specs} moves={moves} fixed={fixed} showLabels={showLabels} highlight={highlight} plain={plainLabels} />}
      {hotspots.map((h, i) => (
        <HotspotRing key={i} index={i} hotspot={h} showLabel={showLabels} />
      ))}
    </group>
  );
}

// ---------- ground ----------

function hatchTexture(bg: string, line: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = line;
  g.lineWidth = 7;
  for (let k = -64; k <= 128; k += 32) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k + 64, 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function ZonePlane({ zone }: { zone: Zone }) {
  const b = polygonBBox(zone.polygon);
  const hatch = zone.kind === "fire_lane";
  const texture = useMemo(() => {
    if (!hatch) return null;
    const t = hatchTexture(P.zone.fire_lane, P.fireHatch);
    t.repeat.set(b.w / 1.6, b.h / 1.6);
    return t;
  }, [hatch, b.w, b.h]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const geometry = useMemo(() => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(zone.polygon.map((p) => new THREE.Vector2(p.x, p.y))));
    g.rotateX(-Math.PI / 2);
    // ShapeGeometry UVs are in shape units; normalize to the bbox so the hatch repeat is in meters
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - b.x) / b.w, (uv.getY(i) - b.y) / b.h);
    return g;
  }, [zone, b.x, b.y, b.w, b.h]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const lift = zone.kind === "fire_lane" ? 0.006 : zone.kind === "lawn" ? 0.004 : 0.002;
  return (
    <mesh geometry={geometry} position={[0, lift, 0]} receiveShadow>
      <meshStandardMaterial color={hatch ? "#ffffff" : P.zone[zone.kind]} map={texture} roughness={1} />
    </mesh>
  );
}

function FloorGrid({ width, height }: { width: number; height: number }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let x = 5; x < width - 1e-6; x += 5) pts.push(toWorld(x, 0, 0.004), toWorld(x, height, 0.004));
    for (let y = 5; y < height - 1e-6; y += 5) pts.push(toWorld(0, y, 0.004), toWorld(width, y, 0.004));
    return pts;
  }, [width, height]);
  return <Line points={points} segments color={P.grid} lineWidth={1} transparent opacity={0.45} />;
}

/** DensityGrid.peak (row-major, row 0 at y = 0) → soft blurred decal just above the floor. */
function HeatDecal({ grid, width, height }: { grid: DensityGrid; width: number; height: number }) {
  const texture = useMemo(() => {
    const small = document.createElement("canvas");
    small.width = grid.cols;
    small.height = grid.rows;
    const sg = small.getContext("2d")!;
    const img = sg.createImageData(grid.cols, grid.rows);
    grid.peak.forEach((v, k) => {
      const c = heatRgba(v, HEAT_MAX);
      if (!c) return;
      // canvas rows go top-down; grid row 0 is y = 0 (bottom)
      const i = k % grid.cols;
      const j = grid.rows - 1 - Math.floor(k / grid.cols);
      const o = 4 * (j * grid.cols + i);
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = Math.round(c[3] * 255);
    });
    sg.putImageData(img, 0, 0);
    const scale = 24;
    const big = document.createElement("canvas");
    big.width = grid.cols * scale;
    big.height = grid.rows * scale;
    const bg = big.getContext("2d")!;
    bg.imageSmoothingEnabled = true;
    bg.filter = `blur(${scale * 0.55}px)`;
    bg.drawImage(small, 0, 0, big.width, big.height);
    const t = new THREE.CanvasTexture(big);
    t.colorSpace = THREE.SRGBColorSpace;
    // the grid may extend past the site (ceil); show only the part over the floor
    t.repeat.set(width / (grid.cols * grid.cell), height / (grid.rows * grid.cell));
    return t;
  }, [grid, width, height]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={toWorld(width / 2, height / 2, 0.02)} renderOrder={1}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---------- boundary ----------

function Walls({ venue }: { venue: Venue }) {
  const segs = useMemo(() => wallSegments(venue), [venue]);
  return (
    <group>
      {segs.map((s, i) => {
        const horizontal = s.a[1] === s.b[1];
        const len = horizontal ? s.b[0] - s.a[0] : s.b[1] - s.a[1];
        return (
          <mesh key={i} position={toWorld((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, WALL_HEIGHT / 2)}>
            <boxGeometry args={horizontal ? [len + WALL_T, WALL_HEIGHT, WALL_T] : [WALL_T, WALL_HEIGHT, len + WALL_T]} />
            <meshStandardMaterial color={P.model} transparent opacity={0.55} depthWrite={false} roughness={0.9} />
            <Edges color={P.wall} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Thin posts every ~2.5 m plus a top rail. */
function Fence({ venue }: { venue: Venue }) {
  const segs = useMemo(() => wallSegments(venue), [venue]);
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    for (const s of segs) {
      const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      const n = Math.max(1, Math.round(len / 2.5));
      for (let k = 0; k <= n; k++) out.push([s.a[0] + ((s.b[0] - s.a[0]) * k) / n, s.a[1] + ((s.b[1] - s.a[1]) * k) / n]);
    }
    return out;
  }, [segs]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    posts.forEach(([x, y], i) => m.setMatrixAt(i, mat.makeTranslation(...toWorld(x, y, 0.55))));
    m.instanceMatrix.needsUpdate = true;
  }, [posts]);
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, posts.length]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 1.1, 6]} />
        <meshStandardMaterial color={P.modelShade} roughness={0.8} />
      </instancedMesh>
      {segs.map((s, i) => (
        <Line key={i} points={[toWorld(s.a[0], s.a[1], 1.08), toWorld(s.b[0], s.b[1], 1.08)]} color={P.wall} lineWidth={1.2} />
      ))}
    </group>
  );
}

function DoorMarker({ door, venue, showLabel }: { door: Door; venue: Venue; showLabel: boolean }) {
  const horizontal = Math.abs(door.a.y - door.b.y) < 1e-6;
  const len = Math.max(0.3, Math.hypot(door.b.x - door.a.x, door.b.y - door.a.y));
  const m = doorMid(door);
  const n = inwardNormal(door, venue);
  const strong = door.kind === "entrance";
  const color = door.kind === "emergency" ? P.muted : P.ink;
  return (
    <group>
      <mesh position={toWorld(m.x + n.x * 0.35, m.y + n.y * 0.35, 0.012)}>
        <boxGeometry args={horizontal ? [len, 0.01, 0.7] : [0.7, 0.01, len]} />
        <meshBasicMaterial color={color} transparent opacity={strong ? 0.85 : 0.45} />
      </mesh>
      {[door.a, door.b].map((p, i) => (
        <mesh key={i} position={toWorld(p.x, p.y, 1.2)} castShadow>
          <boxGeometry args={[0.16, 2.4, 0.16]} />
          <meshStandardMaterial color={P.model} />
        </mesh>
      ))}
      {showLabel && (
        <Label
          text={door.id}
          position={toWorld(m.x + n.x * 2, m.y + n.y * 2, 0.5)}
          color={door.kind === "emergency" ? P.muted : P.ink}
          background={P.labelBg}
          border={P.grid}
          height={0.85}
          bold={strong}
        />
      )}
    </group>
  );
}

// ---------- obstacles ----------

function ObstacleModel({ obstacle }: { obstacle: Obstacle }) {
  const b = polygonBBox(obstacle.polygon);
  const c = center(b);
  const height = OBSTACLE_HEIGHT[obstacle.kind];
  const geometry = useMemo(() => {
    if (obstacle.kind === "tree" || obstacle.kind === "fountain") return null;
    const shape = new THREE.Shape(obstacle.polygon.map((p) => new THREE.Vector2(p.x, p.y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [obstacle, height]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (obstacle.kind === "tree") {
    const r = Math.max(b.w, b.h) / 2;
    return (
      <group position={toWorld(c.x, c.y)}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.13, 2.2, 8]} />
          <meshStandardMaterial color={P.modelShade} roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.9, 0]} castShadow>
          <sphereGeometry args={[r * 1.8, 20, 14]} />
          <meshStandardMaterial color={P.foliage} roughness={0.95} />
        </mesh>
      </group>
    );
  }
  if (obstacle.kind === "fountain") {
    const r = Math.max(b.w, b.h) / 2;
    return (
      <group position={toWorld(c.x, c.y)}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, 0.5, 48]} />
          <meshStandardMaterial color={P.model} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.505, 0]}>
          <cylinderGeometry args={[r * 0.82, r * 0.82, 0.01, 48]} />
          <meshStandardMaterial color={P.water} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.28, 0.8, 16]} />
          <meshStandardMaterial color={P.model} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh geometry={geometry!} castShadow receiveShadow>
      <meshStandardMaterial color={obstacle.kind === "stage" ? P.modelShade : P.model} roughness={0.9} />
      <Edges color={P.grid} threshold={20} />
    </mesh>
  );
}

// ---------- booths ----------

type BoothKind = BoothSpec["kind"];

function useBoothGeometries() {
  const g = useMemo(() => {
    const rounded = new RoundedBoxGeometry(1, 1, 1, 2, 0.035);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    roof.rotateY(Math.PI / 4);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
    return { rounded, box, roof, cyl };
  }, []);
  useEffect(
    () => () => {
      for (const x of Object.values(g)) x.dispose();
    },
    [g],
  );
  return g;
}

function Booths({
  booths,
  specs,
  moves,
  fixed,
  showLabels,
  highlight,
  plain = false,
}: {
  booths: AnimatedBooth[];
  specs: BoothSpec[];
  moves: BoothMove[];
  fixed: Record<string, Point>;
  showLabels: boolean;
  highlight?: string[];
  plain?: boolean;
}) {
  const geo = useBoothGeometries();
  const [hover, setHover] = useState<string | null>(null);
  const spec = new Map(specs.map((s) => [s.id, s]));
  const moved = new Map(moves.map((m) => [m.booth_id, m]));
  const hi = new Set(highlight ?? []);
  return (
    <group>
      {booths.map((b) => {
        const r = boothRect(b);
        const c = center(r);
        const s = spec.get(b.id);
        const mv = moved.get(b.id);
        const lit = hi.has(b.id);
        const from = mv ? center(boothRect({ ...b, ...mv.from })) : null;
        const kind: BoothKind = s?.kind ?? "booth";
        const lift = (1 - b.alpha) * 3.5;
        const over = (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), setHover(b.id));
        return (
          <group key={b.id}>
            <group position={toWorld(c.x, c.y, lift)} onPointerOver={over} onPointerOut={() => setHover((h) => (h === b.id ? null : h))}>
              <BoothModel kind={kind} w={r.w} d={r.h} alpha={b.alpha} geo={geo} />
              {(mv || lit) && b.alpha >= 1 && <BoxOutline w={r.w - 0.1} d={r.h - 0.1} h={kind === "tent" ? 2.35 : kind === "food_truck" ? 2.45 : BOOTH_HEIGHT} />}
            </group>
            {from && b.alpha >= 1 && (
              <>
                <mesh geometry={geo.box} position={toWorld(from.x, from.y, 0.03)} scale={[r.w, 0.04, r.h]}>
                  <meshBasicMaterial color={P.accent} transparent opacity={0.16} depthWrite={false} />
                  <Edges color={P.accent} />
                </mesh>
                <Line points={[toWorld(from.x, from.y, 0.08), toWorld(c.x, c.y, 0.08)]} color={P.accent} lineWidth={2} dashed dashSize={0.5} gapSize={0.3} />
              </>
            )}
            {showLabels && b.alpha >= 1 && (hover === b.id || (mv && !plain) || lit) && (
              <Label
                text={plain ? shortLabel(s?.label ?? b.id) : `${s?.label ?? b.id}${mv ? " · moved" : ""}${fixed[b.id] ? " · pinned" : ""}`}
                position={toWorld(c.x, c.y, BOOTH_HEIGHT + 1.3)}
                color={mv || lit ? P.accent : P.labelFg}
                background={P.labelBg}
                border={mv || lit ? P.accent : P.grid}
                height={lit ? 1 : 0.8}
                bold={Boolean(mv || lit)}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function BoothModel({
  kind,
  w,
  d,
  alpha,
  geo,
}: {
  kind: BoothKind;
  w: number;
  d: number;
  alpha: number;
  geo: ReturnType<typeof useBoothGeometries>;
}) {
  const fading = alpha < 1;
  const mat = (color: string = P.model) => <meshStandardMaterial color={color} roughness={0.82} transparent={fading} opacity={alpha} />;
  const inset = 0.08;
  if (kind === "tent") {
    const wallH = 1.9;
    return (
      <group>
        <mesh geometry={geo.box} position={[0, wallH / 2, 0]} scale={[w - inset * 3, wallH, d - inset * 3]} castShadow receiveShadow>
          {mat(P.modelShade)}
        </mesh>
        <mesh geometry={geo.roof} position={[0, wallH + 0.45, 0]} scale={[w - inset, 0.9, d - inset]} castShadow>
          {mat()}
        </mesh>
      </group>
    );
  }
  if (kind === "food_truck") {
    const alongX = w >= d;
    const L = alongX ? w : d;
    const D = alongX ? d : w;
    const cab = Math.min(1.5, L * 0.25);
    const body = L - cab - inset;
    const place = (offset: number): [number, number, number] => (alongX ? [offset, 0, 0] : [0, 0, -offset]);
    const scale = (len: number, h: number, dep: number): [number, number, number] => (alongX ? [len, h, dep] : [dep, h, len]);
    return (
      <group>
        <mesh geometry={geo.rounded} position={[place(-L / 2 + body / 2 + inset / 2)[0], 1.3, place(-L / 2 + body / 2 + inset / 2)[2]]} scale={scale(body, 2.3, D - inset * 2)} castShadow receiveShadow>
          {mat()}
        </mesh>
        <mesh geometry={geo.rounded} position={[place(L / 2 - cab / 2 - inset / 2)[0], 1.0, place(L / 2 - cab / 2 - inset / 2)[2]]} scale={scale(cab, 1.7, D - inset * 2.6)} castShadow>
          {mat(P.modelShade)}
        </mesh>
      </group>
    );
  }
  if (kind === "kiosk") {
    const r = Math.min(w, d) * 0.42;
    return (
      <group>
        <mesh geometry={geo.cyl} position={[0, 1.1, 0]} scale={[r * 2, 2.2, r * 2]} castShadow receiveShadow>
          {mat()}
        </mesh>
        <mesh geometry={geo.cyl} position={[0, 2.25, 0]} scale={[r * 2.5, 0.08, r * 2.5]} castShadow>
          {mat()}
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh geometry={geo.rounded} position={[0, (BOOTH_HEIGHT - 0.1) / 2, 0]} scale={[w - inset * 2, BOOTH_HEIGHT - 0.1, d - inset * 2]} castShadow receiveShadow>
        {mat()}
      </mesh>
      <mesh geometry={geo.box} position={[0, BOOTH_HEIGHT - 0.04, 0]} scale={[w - inset, 0.08, d - inset]} castShadow>
        {mat(P.modelShade)}
      </mesh>
    </group>
  );
}

/** Accent outline of a booth's bounding box ("the agent moved this"), centered on the floor. */
function BoxOutline({ w, d, h }: { w: number; d: number; h: number }) {
  const pts = useMemo(() => {
    const x = w / 2;
    const z = d / 2;
    const c = [
      [-x, -z],
      [x, -z],
      [x, z],
      [-x, z],
    ] as const;
    const out: [number, number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = c[i];
      const [bx, bz] = c[(i + 1) % 4];
      out.push([ax, 0.02, az], [bx, 0.02, bz], [ax, h, az], [bx, h, bz], [ax, 0.02, az], [ax, h, az]);
    }
    return out;
  }, [w, d, h]);
  return <Line points={pts} segments color={P.accent} lineWidth={2} />;
}

// ---------- hotspots ----------

function HotspotRing({ hotspot, index, showLabel }: { hotspot: Hotspot; index: number; showLabel: boolean }) {
  const z = hotspot.zone;
  const ring = [toWorld(z.x, z.y, 0.06), toWorld(z.x + z.w, z.y, 0.06), toWorld(z.x + z.w, z.y + z.h, 0.06), toWorld(z.x, z.y + z.h, 0.06), toWorld(z.x, z.y, 0.06)];
  return (
    <group>
      <Line points={ring} color={P.hotspot} lineWidth={1.5} dashed dashSize={0.5} gapSize={0.3} />
      {showLabel && (
        <Label
          text={`#${index} · ${hotspot.peak_density.toFixed(2)} p/m²`}
          position={toWorld(z.x + z.w / 2, z.y + z.h + 0.6, 0.6)}
          color={P.hotspot}
          background={P.labelBg}
          border={P.hotspot}
          height={0.8}
          bold
        />
      )}
    </group>
  );
}
