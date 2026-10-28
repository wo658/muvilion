"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PlanDocument } from "@/lib/plans/schema";
import { deriveWalls } from "@/lib/plans/walls";
import { DoubleSide, Shape } from "three";
import { findWalkSpawn, type WalkWorld, type WalkTelemetry } from "@/lib/plans/walk";
import { WalkControls, type WalkAction } from "./walk-controls";
import "./walk.css";
import { TOKENS } from "@/lib/ui/tokens";

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="ps-canvas-message"><h3>3D is unavailable in this browser</h3><p>Your plan is safe. Continue editing in 2D.</p></div> : this.props.children; }
}

function OverviewCamera({ span }: { span: number }) {
  const { camera, invalidate } = useThree();
  useEffect(() => { camera.position.set(span * 0.75, span * 0.8, span * 0.9); camera.lookAt(0, 0, 0); invalidate(); }, [camera, invalidate, span]);
  return null;
}

export default function SceneView({ document, wallHeight, selected, onSelect }: { document: PlanDocument; wallHeight: number; selected: string | null; onSelect: (id: string) => void }) {
  const width = document.widthMeters ?? 10;
  const depth = document.heightMeters ?? width * document.source.height / document.source.width;
  const span = Math.max(width, depth);
  const cameraOptions = useMemo(() => ({ position: [span * 0.75, span * 0.8, span * 0.9] as [number, number, number], fov: 40, near: 0.05, far: span * 20 }), [span]);
  const walls = useMemo(() => deriveWalls(document, { pairParallelEdges: true }), [document]);
  const [walking, setWalking] = useState(false);
  const [ceilingPreference, setCeilingPreference] = useState<boolean | null>(null);
  const [showStructure, setShowStructure] = useState(true);
  const [showOverhead, setShowOverhead] = useState(true);
  const [reset, setReset] = useState(0);
  const [position, setPosition] = useState<WalkTelemetry | null>(null);
  const input = useRef(new Set<WalkAction>());
  const exitWalk = useCallback(() => { input.current.clear(); setWalking(false); }, []);
  const world = useMemo<WalkWorld>(() => ({ width, depth, walls, ceilingHeight: document.ceiling?.height, wallHeight, objects: document.objects ?? [], boundary: document.floorBoundary?.map(p => ({ x: p.x * width, y: p.y * depth })) }), [width, depth, walls, document.objects, document.floorBoundary, document.ceiling?.height, wallHeight]);
  const spawn = useMemo(() => findWalkSpawn(world, document.walkStart ? { x: document.walkStart.x * width, y: document.walkStart.y * depth } : undefined), [world, document.walkStart, width, depth]);
  const activeWalk = walking && document.scaleConfirmed && !!document.floorBoundary?.length && spawn !== null;
  const showCeiling = ceilingPreference ?? activeWalk;
  const floorShape = useMemo(() => {
    if (!document.floorBoundary?.length) return null;
    const shape = new Shape();
    document.floorBoundary.forEach((p, i) => { if (i === 0) shape.moveTo(p.x * width - width / 2, depth / 2 - p.y * depth); else shape.lineTo(p.x * width - width / 2, depth / 2 - p.y * depth); });
    shape.closePath(); return shape;
  }, [document.floorBoundary, width, depth]);
  const walkButton = (action: WalkAction, label: string, glyph: string) => <button key={action} aria-label={label} title={label} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current.add(action); }} onPointerUp={() => input.current.delete(action)} onPointerCancel={() => input.current.delete(action)} onLostPointerCapture={() => input.current.delete(action)} onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); input.current.add(action); } }} onKeyUp={() => input.current.delete(action)} onBlur={() => input.current.delete(action)}>{glyph}</button>;
  return <SceneBoundary><div className="ps-walk-toolbar"><button disabled={!document.scaleConfirmed || !document.floorBoundary?.length || !spawn} onClick={() => { input.current.clear(); setWalking(value => !value); }}>{activeWalk ? "Exit walk / overview" : "Walk inside"}</button>{activeWalk && <button onClick={() => { input.current.clear(); setReset(value => value + 1); }}>Reset position</button>}<span>{!document.scaleConfirmed ? "Confirm scale to walk." : !document.floorBoundary?.length ? "Trace the floor outline in 2D to walk inside." : !spawn ? "No safe starting point found. Review walls, objects and floor boundary." : activeWalk ? "WASD / arrows / drag to look / Esc exits" : "Orbit overview / drag to rotate"}</span></div>{activeWalk && <><div className="ps-walk-caveat">Eye height 1.65 m. Wall height {wallHeight} m provisional. Missing walls remain open. Movement follows the traced floor.<div aria-label="Walking position">Position: {(position ?? spawn)?.x.toFixed(2)} m, {(position ?? spawn)?.y.toFixed(2)} m. {position?.blocked ? "Movement blocked by wall, object or floor edge." : "Path clear."}</div></div><div className="ps-walk-pad" aria-label="Walk movement controls">{walkButton("turnLeft", "Hold to look left", "L")}{walkButton("forward", "Hold to walk forward", "W")}{walkButton("turnRight", "Hold to look right", "R")}{walkButton("left", "Hold to step left", "A")}{walkButton("back", "Hold to walk backward", "S")}{walkButton("right", "Hold to step right", "D")}</div></>}<div className="ps-wall-summary" style={{position:"absolute",top:130,left:18,zIndex:1,background:"#ffffffdf",padding:"8px 10px",borderRadius:5,fontSize:11,pointerEvents:"none"}}>{document.lines.filter(line=>line.kind==="wall").length} wall lines → {walls.length} wall sections · {walls.filter(wall=>wall.thicknessSource==="inferred-parallel-edges").length} paired edges</div><div className="ps-scene-layers" role="group" aria-label="3D display layers"><label><input type="checkbox" checked={showCeiling} disabled={!document.ceiling || !floorShape} onChange={e=>setCeilingPreference(e.target.checked)}/>Ceiling</label><label><input type="checkbox" checked={showStructure} onChange={e=>setShowStructure(e.target.checked)}/>Beams / structure</label><label><input type="checkbox" checked={showOverhead} onChange={e=>setShowOverhead(e.target.checked)}/>Lights / hanging elements</label><span className="ps-layer-note">{document.ceiling ? `Level ceiling ${document.ceiling.height} m · ${document.ceiling.status}` : "Ceiling height not set"} · Visibility only; design checks stay active.</span></div><span className="sr-only">Wall height {wallHeight} m is provisional. Thickness is inferred from paired edges where possible; otherwise 0.16 m is provisional.</span><Canvas key={`${width}-${depth}`} frameloop={activeWalk ? "always" : "demand"} shadows camera={cameraOptions} dpr={[1, 1.5]}>
    <color attach="background" args={[TOKENS.bg]} />
    <ambientLight intensity={1.5} />
    <directionalLight position={[span / 3, span, span / 2]} intensity={2.4} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, 0]}>{floorShape ? <shapeGeometry args={[floorShape]} /> : <planeGeometry args={[width, depth]} />}<meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh>
    {floorShape && document.ceiling && showCeiling && <mesh rotation-x={-Math.PI / 2} position={[0, document.ceiling.height, 0]} receiveShadow><shapeGeometry args={[floorShape]}/><meshStandardMaterial side={DoubleSide} color={document.ceiling.color} roughness={0.85}/></mesh>}
    {document.scaleConfirmed && (document.zones ?? []).map(zone => <mesh key={zone.id} rotation={[-Math.PI/2,0,zone.rotation*Math.PI/180]} position={[(zone.x-0.5)*width,0.015,(zone.y-0.5)*depth]} onClick={e=>{e.stopPropagation();if(!activeWalk)onSelect(zone.id);}}><planeGeometry args={[zone.width,zone.depth]}/><meshBasicMaterial color={selected===zone.id?TOKENS.accent:"#7fb7b2"} transparent opacity={selected===zone.id?0.3:0.13} depthWrite={false} side={DoubleSide}/></mesh>)}
    {!activeWalk && <gridHelper args={[span * 1.5, 24, TOKENS.hairlineStrong, TOKENS.hairline]} position={[0, -0.03, 0]} />}
    {walls.map((line) => {
      const ax = line.a.x - width / 2, az = line.a.y - depth / 2;
      const bx = line.b.x - width / 2, bz = line.b.y - depth / 2;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.001) return null;
      return <mesh key={line.id} position={[(ax + bx) / 2, wallHeight / 2, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); if (!activeWalk) onSelect(line.evidenceIds[0]); }}>
        <boxGeometry args={[length, wallHeight, line.thickness]} /><meshStandardMaterial color={selected !== null && line.evidenceIds.includes(selected) ? TOKENS.accent : TOKENS.modelShade} roughness={0.8} />
      </mesh>;
    })}
    {document.scaleConfirmed && (document.objects ?? []).filter(object => object.kind === "beam" ? showStructure : ["light","hanging-sign","canopy"].includes(object.kind) ? showOverhead : true).map((object) => <group key={object.id} position={[(object.x - 0.5) * width, object.elevation ?? 0, (object.y - 0.5) * depth]} rotation={[0, -object.rotation * Math.PI / 180, 0]}>
      <mesh castShadow receiveShadow position={[0, object.height / 2, 0]} onClick={e=>{e.stopPropagation();if(!activeWalk)onSelect(object.id);}}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={selected===object.id?TOKENS.accent:object.color} emissive={object.kind === "light" ? object.color : "#000000"} emissiveIntensity={object.kind === "light" ? 0.7 : 0} roughness={0.7} transparent={object.kind === "canopy"} opacity={object.kind === "canopy"?0.8:1}/></mesh>
    </group>)}
    {activeWalk && spawn ? <WalkControls world={world} spawn={spawn} input={input} reset={reset} onExit={exitWalk} onPosition={setPosition} /> : <><OverviewCamera span={span} /><OrbitControls makeDefault minDistance={span * 0.1} maxDistance={span * 4} maxPolarAngle={Math.PI / 2.05} target={[0, 0, 0]} /></>}
  </Canvas></SceneBoundary>;
}
