"use client";

/**
 * All agents as ONE InstancedMesh (small capsule, ~1.5 m tall). Each frame reads the shared clock,
 * interpolates every track (lib/trajectory/playback.ts), packs the agents present into the first
 * `count` instances (translation-only matrices written straight into instanceMatrix) and colors
 * them by *local density* at that moment: agents are binned into CROWD_CELL cells and each takes
 * the color of its cell's p/m² (neutral grey → amber → red, lib/ui/heat.ts). No per-frame
 * allocation; geometry/material/bins are created once and disposed on unmount.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { Trajectories } from "@/lib/engine/contract";
import { sampleTrack, type Sample } from "@/lib/trajectory/playback";
import { crowdColor } from "@/lib/ui/heat";
import type { Clock } from "./clock";

const RADIUS = 0.2;
/** Cell size (m) for the instantaneous local-density estimate that colors agents. */
export const CROWD_CELL = 1.5;
const srgbToLinear = (c: number) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
const BODY = 1.05; // capsule straight section; total height = BODY + 2 * RADIUS

export function Agents({
  traj,
  clock,
  counterRef,
  width,
  height,
}: {
  traj: Trajectories;
  clock: Clock;
  counterRef?: RefObject<HTMLSpanElement | null>;
  width: number;
  height: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CapsuleGeometry(RADIUS, BODY, 4, 10), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const capacity = Math.max(1, traj.agents.length);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const id = new THREE.Matrix4();
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < capacity; i++) {
      m.setMatrixAt(i, id);
      m.setColorAt(i, white); // allocates instanceColor
    }
    m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor?.setUsage(THREE.DynamicDrawUsage);
  }, [capacity]);

  const cols = Math.max(1, Math.ceil(width / CROWD_CELL));
  const rows = Math.max(1, Math.ceil(height / CROWD_CELL));
  const scratchRef = useRef({
    s: { x: 0, y: 0, speed: 0 } as Sample,
    rgb: [0, 0, 0] as [number, number, number],
    lastCount: -1,
    bins: new Uint16Array(0),
    cellOf: new Int32Array(0),
  });

  useFrame(() => {
    const m = mesh.current;
    if (!m || !m.instanceColor) return;
    const scratch = scratchRef.current;
    const mat = m.instanceMatrix.array as Float32Array;
    const col = m.instanceColor.array as Float32Array;
    const t = clock.t;
    if (scratch.bins.length !== cols * rows) scratch.bins = new Uint16Array(cols * rows);
    if (scratch.cellOf.length !== capacity) scratch.cellOf = new Int32Array(capacity);
    const { bins, cellOf } = scratch;
    bins.fill(0);
    let k = 0;
    for (const a of traj.agents) {
      const s = sampleTrack(a, t, traj.dt, scratch.s);
      if (!s) continue;
      // toWorld(x, y) = (x, h, -y), inlined to avoid a per-agent allocation
      const o = k * 16;
      mat[o + 12] = s.x;
      mat[o + 13] = RADIUS + BODY / 2;
      mat[o + 14] = -s.y;
      const ci = Math.min(cols - 1, Math.max(0, Math.floor(s.x / CROWD_CELL)));
      const cj = Math.min(rows - 1, Math.max(0, Math.floor(s.y / CROWD_CELL)));
      const cell = cj * cols + ci;
      cellOf[k] = cell;
      bins[cell]++;
      k++;
    }
    const area = CROWD_CELL * CROWD_CELL;
    for (let i = 0; i < k; i++) {
      const c = crowdColor(bins[cellOf[i]] / area, scratch.rgb);
      // instanceColor is in linear space; convert from sRGB for faithful legend colors
      col[3 * i] = srgbToLinear(c[0]);
      col[3 * i + 1] = srgbToLinear(c[1]);
      col[3 * i + 2] = srgbToLinear(c[2]);
    }
    m.count = k;
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
    if (counterRef?.current && k !== scratch.lastCount) {
      counterRef.current.textContent = String(k);
      scratch.lastCount = k;
    }
  });

  return <instancedMesh ref={mesh} args={[geometry, material, capacity]} frustumCulled={false} castShadow />;
}
