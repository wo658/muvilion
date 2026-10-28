"use client";
import type { MessageKey } from "@/lib/i18n/messages";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import type { CameraControlsImpl } from "@react-three/drei";
import { DoubleSide, Vector3, type Shape } from "three";
import { canTravel, EYE_HEIGHT, type WalkPoint, type WalkWorld } from "@/lib/plans/walk";
import { TOKENS } from "@/lib/ui/tokens";
const TRAVEL_SPEED_METERS_PER_SECOND = 9;
export const EXPLORE_HINT = "Click the floor to move · Drag to look around";
export function RoadView({ world, shape, onStatus }: {
  world: WalkWorld; shape: Shape; onStatus: (message: MessageKey) => void;
}) {
  const controls = useThree(state => state.controls) as unknown as CameraControlsImpl | null;
  const invalidate = useThree(state => state.invalidate);
  const moving = useRef<WalkPoint | null>(null);
  const hoverTime = useRef(0);
  const [marker, setMarker] = useState<{ point: WalkPoint; allowed: boolean } | null>(null);
  const vectors = useMemo(() => ({ eye: new Vector3(), target: new Vector3() }), []);
  const currentPoint = () => {
    controls!.getPosition(vectors.eye, false);
    return { x: vectors.eye.x + world.width / 2, y: vectors.eye.z + world.depth / 2 };
  };
  // Edits invalidate the previously checked route.
  useEffect(() => {
    moving.current = null;
    onStatus(EXPLORE_HINT);
    return () => { moving.current = null; };
  }, [world, onStatus]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => { moving.current = null; onStatus(EXPLORE_HINT); };
    controls.addEventListener("controlstart", stop);
    return () => controls.removeEventListener("controlstart", stop);
  }, [controls, onStatus]);
  useFrame((_, delta) => {
    if (!moving.current || !controls) return;
    const start = currentPoint(), end = moving.current;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const fraction = distance < 0.001 ? 1 : Math.min(1, TRAVEL_SPEED_METERS_PER_SECOND * Math.min(delta, 0.05) / distance);
    const next = { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
    if (!canTravel(start, next, world)) {
      moving.current = null;
      onStatus("Path blocked. Choose a clear floor point.");
      return;
    }
    controls.getTarget(vectors.target, false);
    vectors.target.sub(vectors.eye);
    const x = next.x - world.width / 2, z = next.y - world.depth / 2;
    // Translate both eye and target, retaining the viewing direction.
    void controls.setLookAt(x, EYE_HEIGHT, z, x + vectors.target.x, EYE_HEIGHT + vectors.target.y, z + vectors.target.z, false);
    if (fraction === 1) { moving.current = null; onStatus(EXPLORE_HINT); }
    invalidate();
  });
  const candidate = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    const point = { x: event.point.x + world.width / 2, y: event.point.z + world.depth / 2 };
    const obscured = event.intersections.some(hit => hit.distance < event.distance - 0.001 && hit.object.userData.navigationObstacle);
    return { point, allowed: !!controls && !obscured && canTravel(currentPoint(), point, world) };
  };
  return <>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]}
      onPointerMove={event => {
        if (performance.now() - hoverTime.current < 70) return;
        hoverTime.current = performance.now();
        setMarker(candidate(event));
      }}
      onPointerOut={() => setMarker(null)}
      onClick={event => {
        if (event.delta > 5 || !controls) return;
        event.stopPropagation();
        const next = candidate(event);
        setMarker(next);
        moving.current = null;
        if (!next.allowed) { onStatus("Path blocked. Choose a clear floor point."); return; }
        controls.stop();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          currentPoint(); controls.getTarget(vectors.target, false).sub(vectors.eye);
          const x = next.point.x - world.width / 2, z = next.point.y - world.depth / 2;
          void controls.setLookAt(x, EYE_HEIGHT, z, x + vectors.target.x, EYE_HEIGHT + vectors.target.y, z + vectors.target.z, false);
          onStatus(EXPLORE_HINT);
        } else { moving.current = next.point; onStatus("Moving · Drag to look around"); }
        invalidate();
      }}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
    </mesh>
    {marker && <mesh position={[marker.point.x - world.width / 2, 0.04, marker.point.y - world.depth / 2]} rotation-x={-Math.PI / 2} raycast={() => {}}>
      <ringGeometry args={[0.18, 0.25, 32]} />
      <meshBasicMaterial color={marker.allowed ? TOKENS.accent : TOKENS.bad} side={DoubleSide} depthWrite={false} />
    </mesh>}
  </>;
}
