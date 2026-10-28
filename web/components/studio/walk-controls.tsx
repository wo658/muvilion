"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { EYE_HEIGHT, moveWalker, type WalkPoint, type WalkWorld, type WalkTelemetry } from "@/lib/plans/walk";

export type WalkAction = "forward" | "back" | "left" | "right" | "turnLeft" | "turnRight";
export type WalkInput = MutableRefObject<Set<WalkAction>>;
const KEYS: Record<string, WalkAction> = { KeyW: "forward", ArrowUp: "forward", KeyS: "back", ArrowDown: "back", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };
export function WalkControls({ world, spawn, input, reset, onExit, onPosition }: { world: WalkWorld; spawn: WalkPoint; input: WalkInput; reset: number; onExit: () => void; onPosition: (point: WalkTelemetry) => void }) {
  const { camera, gl } = useThree();
  const position = useRef(spawn);
  const lastReport = useRef(0);
  const lastReportedPosition = useRef<WalkTelemetry | null>(null);
  const angles = useRef({ yaw: 0, pitch: 0 });
  useEffect(() => {
    const canvas = gl.domElement;
    const savedPosition = camera.position.clone(), savedQuaternion = camera.quaternion.clone();
    const oldTabIndex = canvas.tabIndex;
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("aria-label", "Walk viewport. WASD or arrow keys move. Drag to look. Escape exits.");
    canvas.focus({ preventScroll: true });
    lastReportedPosition.current = null;
    position.current = { ...spawn }; angles.current = { yaw: 0, pitch: 0 };
    camera.position.set(spawn.x - world.width / 2, EYE_HEIGHT, spawn.y - world.depth / 2);
    camera.rotation.set(0, 0, 0, "YXZ");
    let pointer: { id: number; x: number; y: number } | null = null;
    const keyboard = new Set<string>();
    const clear = () => { keyboard.clear(); input.current.clear(); if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id); pointer = null; };
    const down = (event: KeyboardEvent) => {
      if (event.code === "Escape") { clear(); onExit(); return; }
      const action = KEYS[event.code]; if (!action) return;
      event.preventDefault(); keyboard.add(event.code); input.current.add(action);
    };
    const up = (event: KeyboardEvent) => {
      const action = KEYS[event.code]; if (!action) return;
      keyboard.delete(event.code);
      if (![...keyboard].some(key => KEYS[key] === action)) input.current.delete(action);
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const pointerMove = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      angles.current.yaw -= (event.clientX - pointer.x) * 0.004;
      angles.current.pitch = Math.max(-1.25, Math.min(1.25, angles.current.pitch - (event.clientY - pointer.y) * 0.004));
      pointer.x = event.clientX; pointer.y = event.clientY;
    };
    const pointerUp = () => { if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id); pointer = null; };
    canvas.addEventListener("keydown", down); window.addEventListener("keyup", up);
    canvas.addEventListener("blur", clear); window.addEventListener("blur", clear);
    canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp); canvas.addEventListener("pointercancel", pointerUp);
    return () => {
      clear(); canvas.setAttribute("tabindex", String(oldTabIndex)); canvas.removeAttribute("aria-label");
      canvas.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      canvas.removeEventListener("blur", clear); window.removeEventListener("blur", clear);
      canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointercancel", pointerUp);
      camera.position.copy(savedPosition); camera.quaternion.copy(savedQuaternion);
    };
  }, [camera, gl, input, onExit, reset, spawn, world]);
  useFrame((state, delta) => {
    const active = input.current;
    const forward = Number(active.has("forward")) - Number(active.has("back"));
    const sideways = Number(active.has("right")) - Number(active.has("left"));
    angles.current.yaw += (Number(active.has("turnLeft")) - Number(active.has("turnRight"))) * Math.min(delta, 0.05) * 1.4;
    const yaw = angles.current.yaw;
    const magnitude = Math.hypot(forward, sideways) || 1;
    const before = position.current;
    position.current = moveWalker(position.current, {
      x: (sideways * Math.cos(yaw) - forward * Math.sin(yaw)) * 2.5 / magnitude,
      y: (-forward * Math.cos(yaw) - sideways * Math.sin(yaw)) * 2.5 / magnitude,
    }, delta, world);
    const intendedDistance = Math.min(delta, 0.05) * (forward || sideways ? 2.5 : 0);
    const blocked = intendedDistance > 0 && Math.hypot(position.current.x - before.x, position.current.y - before.y) < intendedDistance * 0.85;
    camera.position.set(position.current.x - world.width / 2, EYE_HEIGHT, position.current.y - world.depth / 2);
    camera.rotation.set(angles.current.pitch, yaw, 0, "YXZ");
    if (state.clock.elapsedTime - lastReport.current > 0.15) {
      lastReport.current = state.clock.elapsedTime;
      const previous = lastReportedPosition.current;
      if (!previous || previous.blocked !== blocked || Math.hypot(position.current.x - previous.x, position.current.y - previous.y) > 0.005) {
        lastReportedPosition.current = { ...position.current, blocked }; onPosition({ ...position.current, blocked });
      }
    }
  });
  return null;
}
