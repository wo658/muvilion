"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Group, Mesh, Vector3 } from "three";
import { MUVI_MODEL, type MuviMotion } from "@/lib/muvi/motions";

export type MuviModelProps = {
  motion: MuviMotion;
  paused: boolean;
  compact?: boolean;
  target?: [number, number, number] | null;
  onTarget?: (target: [number, number, number]) => void;
  onArrive?: () => void;
};

export function MuviModel({ motion, paused, compact, target, onArrive }: MuviModelProps) {
  const { scene, animations } = useGLTF(MUVI_MODEL);
  const copy = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(node => { if (node instanceof Mesh) { node.castShadow = true; node.raycast = () => {}; } });
    return clone;
  }, [scene]);
  const { actions } = useAnimations(animations, copy);
  const root = useRef<Group>(null);
  const destination = useMemo(() => target ? new Vector3(...target) : null, [target]);
  useEffect(() => {
    const action = actions[motion];
    action?.reset().fadeIn(0.2).play();
    return () => { action?.fadeOut(0.2); };
  }, [actions, motion]);
  useEffect(() => { actions[motion]?.setEffectiveTimeScale(paused ? 0 : 1); }, [actions, motion, paused]);
  useFrame((_, delta) => {
    if (!root.current || !destination || paused) return;
    const current = root.current.position;
    const distance = current.distanceTo(destination);
    const step = Math.min(delta, 0.05) * (motion === "run" ? 2.3 : 1.15);
    if (distance <= step) { current.copy(destination); onArrive?.(); return; }
    root.current.rotation.y = Math.atan2(destination.x - current.x, destination.z - current.z);
    current.lerp(destination, step / distance);
  });
  return <group ref={root} rotation-y={compact ? 0.15 : 0.25}><primitive object={copy} dispose={null}/></group>;
}

