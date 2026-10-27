"use client";

/**
 * Static hall geometry for the 3D view: floor + density texture, low translucent walls with door
 * gaps, extruded obstacles, booths (~2.5 m, shaded by popularity) with labels, hotspot outlines and
 * moved-booth highlights. All coordinates go through toWorld() (lib/trajectory/coords.ts).
 * Geometries/materials/textures are memoized per input and disposed by R3F on unmount (objects
 * created via JSX) or explicitly (the DataTexture and shared geometries created here).
 */
import { Edges, Line } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BoothMove } from "@/lib/agent/events";
import type { BoothSpec, DensityGrid, Door, Hotspot, Layout, Obstacle, Venue } from "@/lib/engine/contract";
import { boothRect, center } from "@/lib/geometry";
import { toWorld } from "@/lib/trajectory/coords";
import { boothHsl, heatHsla, HEAT_MAX, hslToRgb255 } from "@/lib/ui/heat";
import { Label } from "./label";
import type { Palette } from "./palette";

export const BOOTH_HEIGHT = 2.5;
const WALL_HEIGHT = 1.2;
const WALL_T = 0.15;
const OBSTACLE_HEIGHT: Record<Obstacle["kind"], number> = { column: 4, restroom: 2.8, stage: 1, registration: 1.1, tree: 5, fountain: 0.8, structure: 2.6, other: 2 };

export type HallSceneProps = {
  venue: Venue;
  specs: BoothSpec[];
  layout?: Layout;
  grid?: DensityGrid;
  hotspots?: Hotspot[];
  moves?: BoothMove[];
  popularThreshold?: number;
  showHeatmap?: boolean;
  showLabels?: boolean;
};

export function HallScene({
  venue,
  specs,
  layout,
  grid,
  hotspots = [],
  moves = [],
  popularThreshold = 0.8,
  showHeatmap = true,
  showLabels = true,
  palette,
}: HallSceneProps & { palette: Palette }) {
  const W = venue.width;
  const H = venue.height;
  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={toWorld(W / 2, H / 2)} receiveShadow={false}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={palette.floor} roughness={0.95} />
      </mesh>
      <FloorGrid width={W} height={H} color={palette.grid} />
      {showHeatmap && grid && <HeatLayer grid={grid} width={W} height={H} />}
      <Walls venue={venue} color={palette.wall} />
      {venue.doors.map((d) => (
        <DoorMarker key={d.id} door={d} venue={venue} palette={palette} showLabel={showLabels} />
      ))}
      {venue.obstacles.map((o) => (
        <ObstacleMesh key={o.id} obstacle={o} color={palette.obstacle} />
      ))}
      {layout && <Booths layout={layout} specs={specs} moves={moves} popularThreshold={popularThreshold} showLabels={showLabels} palette={palette} />}
      {hotspots.map((h, i) => (
        <HotspotOutline key={i} index={i} hotspot={h} color={palette.hotspot} showLabel={showLabels} />
      ))}
    </group>
  );
}

function FloorGrid({ width, height, color }: { width: number; height: number; color: string }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let x = 0; x <= width + 1e-6; x += 5) pts.push(toWorld(x, 0, 0.004), toWorld(x, height, 0.004));
    for (let y = 0; y <= height + 1e-6; y += 5) pts.push(toWorld(0, y, 0.004), toWorld(width, y, 0.004));
    return pts;
  }, [width, height]);
  return <Line points={points} segments color={color} lineWidth={1} transparent opacity={0.5} />;
}

/** DensityGrid.peak (row-major, row 0 at y = 0) → RGBA DataTexture on a plane just above the floor. */
function HeatLayer({ grid, width, height }: { grid: DensityGrid; width: number; height: number }) {
  const texture = useMemo(() => {
    const data = new Uint8Array(grid.cols * grid.rows * 4);
    grid.peak.forEach((v, k) => {
      const h = heatHsla(v, HEAT_MAX);
      if (!h) return;
      const [r, g, b] = hslToRgb255(h.h, h.s, h.l);
      data[4 * k] = r;
      data[4 * k + 1] = g;
      data[4 * k + 2] = b;
      data[4 * k + 3] = Math.round(h.a * 255);
    });
    const t = new THREE.DataTexture(data, grid.cols, grid.rows, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    // the grid may extend past the hall (ceil); show only the part over the floor
    t.repeat.set(width / (grid.cols * grid.cell), height / (grid.rows * grid.cell));
    t.needsUpdate = true;
    return t;
  }, [grid, width, height]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={toWorld(width / 2, height / 2, 0.01)} renderOrder={1}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Boundary wall pieces with gaps where doors are. */
function wallSegments(venue: Venue): { a: [number, number]; b: [number, number] }[] {
  const W = venue.width;
  const H = venue.height;
  const eps = 1e-6;
  const edges: { fixed: "x" | "y"; at: number; len: number }[] = [
    { fixed: "y", at: 0, len: W },
    { fixed: "y", at: H, len: W },
    { fixed: "x", at: 0, len: H },
    { fixed: "x", at: W, len: H },
  ];
  const out: { a: [number, number]; b: [number, number] }[] = [];
  for (const e of edges) {
    const gaps = venue.doors
      .filter((d) => (e.fixed === "y" ? Math.abs(d.a.y - e.at) < eps && Math.abs(d.b.y - e.at) < eps : Math.abs(d.a.x - e.at) < eps && Math.abs(d.b.x - e.at) < eps))
      .map((d) => (e.fixed === "y" ? [Math.min(d.a.x, d.b.x), Math.max(d.a.x, d.b.x)] : [Math.min(d.a.y, d.b.y), Math.max(d.a.y, d.b.y)]))
      .sort((p, q) => p[0] - q[0]);
    let s = 0;
    for (const [g0, g1] of [...gaps, [e.len, e.len]]) {
      if (g0 - s > eps) {
        out.push(e.fixed === "y" ? { a: [s, e.at], b: [g0, e.at] } : { a: [e.at, s], b: [e.at, g0] });
      }
      s = Math.max(s, g1);
    }
  }
  return out;
}

function Walls({ venue, color }: { venue: Venue; color: string }) {
  const segs = useMemo(() => wallSegments(venue), [venue]);
  return (
    <group>
      {segs.map((s, i) => {
        const horizontal = s.a[1] === s.b[1];
        const len = horizontal ? s.b[0] - s.a[0] : s.b[1] - s.a[1];
        const cx = (s.a[0] + s.b[0]) / 2;
        const cy = (s.a[1] + s.b[1]) / 2;
        return (
          <mesh key={i} position={toWorld(cx, cy, WALL_HEIGHT / 2)}>
            <boxGeometry args={horizontal ? [len, WALL_HEIGHT, WALL_T] : [WALL_T, WALL_HEIGHT, len]} />
            <meshStandardMaterial color={color} transparent opacity={0.28} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function DoorMarker({ door, venue, palette, showLabel }: { door: Door; venue: Venue; palette: Palette; showLabel: boolean }) {
  const color = palette.door[door.kind];
  const horizontal = Math.abs(door.a.y - door.b.y) < 1e-6;
  const len = Math.max(0.3, Math.hypot(door.b.x - door.a.x, door.b.y - door.a.y));
  const m = { x: (door.a.x + door.b.x) / 2, y: (door.a.y + door.b.y) / 2 };
  // label sits just inside the hall
  const inward = horizontal ? { x: 0, y: m.y < venue.height / 2 ? 1.2 : -1.2 } : { x: m.x < venue.width / 2 ? 1.2 : -1.2, y: 0 };
  return (
    <group>
      <mesh position={toWorld(m.x, m.y, 0.03)}>
        <boxGeometry args={horizontal ? [len, 0.06, 0.8] : [0.8, 0.06, len]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {[door.a, door.b].map((p, i) => (
        <mesh key={i} position={toWorld(p.x, p.y, 1.2)}>
          <boxGeometry args={[0.2, 2.4, 0.2]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={toWorld(m.x, m.y, 2.45)}>
        <boxGeometry args={horizontal ? [len + 0.2, 0.15, 0.2] : [0.2, 0.15, len + 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {showLabel && (
        <Label text={door.id} position={toWorld(m.x + inward.x, m.y + inward.y, 0.4)} color="#ffffff" background={color} bold />
      )}
    </group>
  );
}

function ObstacleMesh({ obstacle, color }: { obstacle: Obstacle; color: string }) {
  const height = OBSTACLE_HEIGHT[obstacle.kind];
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(obstacle.polygon.map((p) => new THREE.Vector2(p.x, p.y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    // shape is in hall (x, y); extrusion is +z. Rotate so hall y → world -z and extrusion → world +y.
    g.rotateX(-Math.PI / 2);
    return g;
  }, [obstacle, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Booths({
  layout,
  specs,
  moves,
  popularThreshold,
  showLabels,
  palette,
}: {
  layout: Layout;
  specs: BoothSpec[];
  moves: BoothMove[];
  popularThreshold: number;
  showLabels: boolean;
  palette: Palette;
}) {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => box.dispose(), [box]);
  const spec = new Map(specs.map((s) => [s.id, s]));
  const moved = new Map(moves.map((m) => [m.booth_id, m]));
  return (
    <group>
      {layout.booths.map((b) => {
        const r = boothRect(b);
        const c = center(r);
        const p = spec.get(b.id)?.popularity ?? 0.5;
        const hsl = boothHsl(p);
        const isMoved = moved.has(b.id);
        const popular = p >= popularThreshold;
        const mv = moved.get(b.id);
        const from = mv ? center(boothRect({ ...b, x: mv.from.x, y: mv.from.y })) : null;
        return (
          <group key={b.id}>
            <mesh geometry={box} position={toWorld(c.x, c.y, BOOTH_HEIGHT / 2)} scale={[r.w - 0.06, BOOTH_HEIGHT, r.h - 0.06]}>
              <meshStandardMaterial color={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} roughness={0.7} />
              {(isMoved || popular) && <Edges color={isMoved ? palette.move : palette.popular} lineWidth={isMoved ? 3 : 2} />}
            </mesh>
            {from && (
              <>
                {/* ghost of the previous position + arrow */}
                <mesh geometry={box} position={toWorld(from.x, from.y, BOOTH_HEIGHT / 2)} scale={[r.w - 0.06, BOOTH_HEIGHT, r.h - 0.06]}>
                  <meshBasicMaterial color={palette.move} transparent opacity={0.08} depthWrite={false} />
                  <Edges color={palette.move} lineWidth={1.5} />
                </mesh>
                <Line points={[toWorld(from.x, from.y, BOOTH_HEIGHT + 0.4), toWorld(c.x, c.y, BOOTH_HEIGHT + 0.4)]} color={palette.move} lineWidth={3} dashed dashSize={0.6} gapSize={0.3} />
              </>
            )}
            {showLabels && (
              <Label
                text={isMoved ? `${b.id} moved` : b.id}
                position={toWorld(c.x, c.y, BOOTH_HEIGHT + 0.45)}
                color={isMoved ? palette.move : palette.labelFg}
                background={palette.labelBg}
                bold={popular || isMoved}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function HotspotOutline({ hotspot, index, color, showLabel }: { hotspot: Hotspot; index: number; color: string; showLabel: boolean }) {
  const z = hotspot.zone;
  const ring = (h: number) => [
    toWorld(z.x, z.y, h),
    toWorld(z.x + z.w, z.y, h),
    toWorld(z.x + z.w, z.y + z.h, h),
    toWorld(z.x, z.y + z.h, h),
    toWorld(z.x, z.y, h),
  ];
  return (
    <group>
      <Line points={ring(0.05)} color={color} lineWidth={3} />
      <Line points={ring(0.9)} color={color} lineWidth={1.5} dashed dashSize={0.5} gapSize={0.3} transparent opacity={0.8} />
      {showLabel && (
        <Label
          text={`#${index} ${hotspot.peak_density.toFixed(2)} p/m²`}
          position={toWorld(z.x + z.w / 2, z.y + z.h / 2, 1.4)}
          color="#ffffff"
          background={color}
          bold
          height={1.1}
        />
      )}
    </group>
  );
}
