"use client";
import { fixtureParts, type FixtureType } from "@/lib/assets/fixtures";

/** Metre geometry; no model fitting, inferred scaling or decorative protrusions. */
export function FixtureObject({ type, color }: { type: FixtureType; color: string }) {
  return <group>{fixtureParts(type).map((part, index) => <mesh key={index} position={part.position} castShadow receiveShadow userData={{ navigationObstacle: true }}>
    <boxGeometry args={part.size}/><meshStandardMaterial color={color} roughness={0.75}/>
  </mesh>)}</group>;
}
