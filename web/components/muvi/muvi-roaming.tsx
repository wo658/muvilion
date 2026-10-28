"use client";

import { Component, Suspense, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MuviModel } from "./muvi-model";

// Optional decoration must never take down the drawing if the mascot fails to load.
class MascotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Patrol({ width, depth, paused }: { width: number; depth: number; paused: boolean }) {
  const root = useRef<Group>(null);
  const elapsed = useRef(0);
  const radiusX = width * 0.2, radiusZ = depth * 0.2;
  // Display scale only: this mascot is not a measured person or a design object.
  const scale = Math.min(Math.min(width, depth) * 0.12, Math.max(0.6, Math.max(width, depth) * 0.018));
  useFrame(({ invalidate }, delta) => {
    if (paused || !root.current) return;
    elapsed.current += Math.min(delta, 0.05);
    const angle = elapsed.current * 0.24;
    root.current.position.set(radiusX * Math.cos(angle), 0.03, radiusZ * Math.sin(angle));
    root.current.rotation.y = Math.atan2(-radiusX * Math.sin(angle), radiusZ * Math.cos(angle)) - 0.25;
    invalidate();
  });
  return <group ref={root} name="MuviDecoration" position={[radiusX, 0.03, 0]} scale={scale}>
    <MuviModel motion="walk" paused={paused}/>
  </group>;
}

/** Dimensions frame an illustrative loop only. No document, engine or navigation inputs. */
export function MuviRoaming(props: { width: number; depth: number; paused: boolean }) {
  return <MascotBoundary><Suspense fallback={null}><Patrol {...props}/></Suspense></MascotBoundary>;
}
