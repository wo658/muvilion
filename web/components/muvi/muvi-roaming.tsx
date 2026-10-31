"use client";

import { Component, Suspense, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { operationMotion, type MuviOperation } from "@/lib/muvi/operations";
import { MuviModel } from "./muvi-model";

// Optional decoration must never take down the drawing if the mascot fails to load.
class MascotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Patrol({ width, depth, paused, operation }: { width: number; depth: number; paused: boolean; operation?: MuviOperation | null }) {
  const root = useRef<Group>(null);
  const elapsed = useRef(0);
  const radiusX = width * 0.2, radiusZ = depth * 0.2;
  // About 0.85 scene units tall: a small companion, regardless of venue size.
  // Tiny spaces may shrink it further. This is decorative display scale only.
  const scale = Math.min(0.4, Math.min(width, depth) * 0.12);
  useFrame(({ invalidate }, delta) => {
    if (paused || !root.current) return;
    if (operation) { invalidate(); return; }
    elapsed.current += Math.min(delta, 0.05);
    const angle = elapsed.current * 0.24;
    root.current.position.set(radiusX * Math.cos(angle), 0.03, radiusZ * Math.sin(angle));
    root.current.rotation.y = Math.atan2(-radiusX * Math.sin(angle), radiusZ * Math.cos(angle)) - 0.25;
    invalidate();
  });
  return <group ref={root} name="MuviDecoration" position={[radiusX, 0.03, 0]} scale={scale}>
    <MuviModel motion={operationMotion(operation ?? null)} paused={paused}/>
  </group>;
}

/** Dimensions frame an illustrative loop only. No document, engine or navigation inputs. */
export function MuviRoaming(props: { width: number; depth: number; paused: boolean; operation?: MuviOperation | null }) {
  return <MascotBoundary><Suspense fallback={null}><Patrol {...props}/></Suspense></MascotBoundary>;
}
