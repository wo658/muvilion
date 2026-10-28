"use client";

import { Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PlanDocument } from "@/lib/plans/schema";
import { TOKENS } from "@/lib/ui/tokens";

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="ps-canvas-message"><h3>3D is unavailable in this browser</h3><p>Your plan is safe. Continue editing in 2D.</p></div> : this.props.children; }
}

export default function SceneView({ document, wallHeight, selected, onSelect }: { document: PlanDocument; wallHeight: number; selected: string | null; onSelect: (id: string) => void }) {
  const width = document.widthMeters ?? 10;
  const depth = document.heightMeters ?? width * document.source.height / document.source.width;
  const span = Math.max(width, depth);
  const walls = document.lines.filter((line) => line.kind === "wall");
  return <SceneBoundary><Canvas key={`${width}-${depth}`} frameloop="demand" shadows camera={{ position: [span * 0.75, span * 0.8, span * 0.9], fov: 40, near: 0.1, far: span * 20 }} dpr={[1, 1.5]}>
    <color attach="background" args={[TOKENS.bg]} />
    <ambientLight intensity={1.5} />
    <directionalLight position={[span / 3, span, span / 2]} intensity={2.4} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, 0]}><planeGeometry args={[width, depth]} /><meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh>
    <gridHelper args={[span * 1.5, 24, TOKENS.hairlineStrong, TOKENS.hairline]} position={[0, -0.03, 0]} />
    {walls.map((line) => {
      const ax = (line.a.x - 0.5) * width, az = (line.a.y - 0.5) * depth;
      const bx = (line.b.x - 0.5) * width, bz = (line.b.y - 0.5) * depth;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.001) return null;
      return <mesh key={line.id} position={[(ax + bx) / 2, wallHeight / 2, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(line.id); }}>
        <boxGeometry args={[length, wallHeight, 0.16]} /><meshStandardMaterial color={selected === line.id ? TOKENS.accent : TOKENS.modelShade} roughness={0.8} />
      </mesh>;
    })}
    {document.scaleConfirmed && (document.objects ?? []).map((object) => <group key={object.id} position={[(object.x - 0.5) * width, 0, (object.y - 0.5) * depth]} rotation={[0, -object.rotation * Math.PI / 180, 0]}>
      <mesh castShadow receiveShadow position={[0, object.height / 2, 0]}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={object.color} roughness={0.7} /></mesh>
      {object.kind === "booth" && <mesh position={[0, object.height + 0.06, 0]} castShadow><boxGeometry args={[object.width + 0.12, 0.12, object.depth + 0.12]} /><meshStandardMaterial color="#ffffff" /></mesh>}
    </group>)}
    <OrbitControls makeDefault minDistance={span * 0.1} maxDistance={span * 4} maxPolarAngle={Math.PI / 2.05} target={[0, 0, 0]} />
  </Canvas></SceneBoundary>;
}
