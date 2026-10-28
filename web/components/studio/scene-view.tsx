"use client";

import { Component, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneCamera } from "./scene-camera";
import { interiorPose, type CameraView } from "@/lib/plans/camera";
import { Button } from "../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "../ui/popover";
import { NativeSelect } from "../ui/native-select";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Switch } from "../ui/switch";
import { LayersIcon, InfoIcon, FocusIcon, RotateCcwIcon } from "lucide-react";
import type { PlanDocument } from "@/lib/plans/schema";
import { deriveWalls } from "@/lib/plans/walls";
import { DoubleSide, Shape } from "three";
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
  const cameraOptions = useMemo(() => ({ position: [span * 0.75, span * 0.8, span * 0.9] as [number, number, number], fov: 40, near: 0.05, far: span * 20 }), [span]);
  const walls = useMemo(() => deriveWalls(document, { pairParallelEdges: true }), [document]);
  const [ceilingMode, setCeilingMode] = useState("hidden");
  const [view,setView]=useState<CameraView>("overview");
  const [cameraRevision,setCameraRevision]=useState(0);
  const inside=useMemo(()=>interiorPose(document),[document]);
  const selectedItem=document.objects?.some(o=>o.id===selected)||document.zones?.some(z=>z.id===selected);
  const changeView=(next:CameraView)=>{setView(next);setCameraRevision(n=>n+1);if(next==="interior"&&document.ceiling)setCeilingMode("solid");};
  const [showStructure, setShowStructure] = useState(true);
  const [showOverhead, setShowOverhead] = useState(true);
  const showCeiling = ceilingMode !== "hidden";
  const floorShape = useMemo(() => {
    if (!document.floorBoundary?.length) return null;
    const shape = new Shape();
    document.floorBoundary.forEach((p, i) => { if (i === 0) shape.moveTo(p.x * width - width / 2, depth / 2 - p.y * depth); else shape.lineTo(p.x * width - width / 2, depth / 2 - p.y * depth); });
    shape.closePath(); return shape;
  }, [document.floorBoundary, width, depth]);
  return <SceneBoundary><div className="ps-scene-tools">
    <ToggleGroup aria-label="Camera view" value={[view]} onValueChange={values=>{if(values[0])changeView(values[0] as CameraView);}} variant="outline" size="sm" spacing={0}>
      <ToggleGroupItem value="overview">Overview</ToggleGroupItem><ToggleGroupItem value="top">Top</ToggleGroupItem><ToggleGroupItem value="interior" disabled={!inside} title={!inside?"Review scale and floor boundary; a clear interior viewpoint is required.":"Look around from a fixed point under the ceiling"}>Inside</ToggleGroupItem>
    </ToggleGroup>
    <Button variant="outline" size="icon-sm" aria-label="Focus selected area or element" title="Focus selection" disabled={!selectedItem} onClick={()=>changeView("selection")}><FocusIcon/></Button>
    <Button variant="outline" size="icon-sm" aria-label="Reset camera" title="Reset camera" onClick={()=>changeView(view)}><RotateCcwIcon/></Button>
    <Popover><PopoverTrigger render={<Button variant="outline" size="icon-sm" aria-label="Display layers" title="Display layers"/>}><LayersIcon/></PopoverTrigger><PopoverContent align="start"><PopoverTitle>Display layers</PopoverTitle><FieldGroup>
      <Field><FieldLabel htmlFor="ceiling-display">Ceiling</FieldLabel><NativeSelect id="ceiling-display" value={ceilingMode} disabled={!document.ceiling||!floorShape} onChange={e=>setCeilingMode(e.target.value)}><option value="hidden">Hidden</option><option value="solid">Solid</option><option value="transparent">Transparent</option></NativeSelect></Field>
      <Field orientation="horizontal"><FieldLabel htmlFor="structure-display">Beams / structure</FieldLabel><Switch id="structure-display" checked={showStructure} onCheckedChange={setShowStructure}/></Field>
      <Field orientation="horizontal"><FieldLabel htmlFor="overhead-display">Lights / hanging elements</FieldLabel><Switch id="overhead-display" checked={showOverhead} onCheckedChange={setShowOverhead}/></Field>
    </FieldGroup></PopoverContent></Popover>
    <Popover><PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="View help and model information"/>}><InfoIcon/></PopoverTrigger><PopoverContent align="start"><PopoverTitle>Viewing the space</PopoverTitle><p>{view==="interior"?"Drag to look around. Scroll to adjust zoom. This is a fixed viewpoint, not walking.":"Drag to orbit. Right-drag to pan. Scroll to zoom. Select an area or element, then Focus."}</p><p>{document.ceiling?`Ceiling ${document.ceiling.height} m · ${document.ceiling.status}`:"Ceiling height not set"}. Wall height {wallHeight} m is provisional.</p><p>{walls.length} wall sections from {document.lines.filter(l=>l.kind==="wall").length} source lines. Display settings never change the design or checks.</p></PopoverContent></Popover>
  </div><Canvas key={`${width}-${depth}`} frameloop="demand" shadows camera={cameraOptions} dpr={[1, 1.5]}>
    <color attach="background" args={[TOKENS.bg]} />
    <ambientLight intensity={1.5} />
    <directionalLight position={[span / 3, span, span / 2]} intensity={2.4} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, 0]}>{floorShape ? <shapeGeometry args={[floorShape]} /> : <planeGeometry args={[width, depth]} />}<meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh>
    {floorShape && document.ceiling && showCeiling && <mesh rotation-x={-Math.PI / 2} position={[0, document.ceiling.height, 0]} receiveShadow><shapeGeometry args={[floorShape]}/><meshStandardMaterial side={DoubleSide} color={document.ceiling.color} roughness={0.85} transparent={ceilingMode==="transparent"} opacity={ceilingMode==="transparent"?0.18:1} depthWrite={ceilingMode!=="transparent"}/></mesh>}
    {document.scaleConfirmed && (document.zones ?? []).map(zone => <mesh key={zone.id} rotation={[-Math.PI/2,0,zone.rotation*Math.PI/180]} position={[(zone.x-0.5)*width,0.015,(zone.y-0.5)*depth]} onClick={e=>{e.stopPropagation();onSelect(zone.id);}}><planeGeometry args={[zone.width,zone.depth]}/><meshBasicMaterial color={selected===zone.id?TOKENS.accent:"#7fb7b2"} transparent opacity={selected===zone.id?0.3:0.13} depthWrite={false} side={DoubleSide}/></mesh>)}
    {<gridHelper args={[span * 1.5, 24, TOKENS.hairlineStrong, TOKENS.hairline]} position={[0, -0.03, 0]} />}
    {walls.map((line) => {
      const ax = line.a.x - width / 2, az = line.a.y - depth / 2;
      const bx = line.b.x - width / 2, bz = line.b.y - depth / 2;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.001) return null;
      return <mesh key={line.id} position={[(ax + bx) / 2, wallHeight / 2, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(line.evidenceIds[0]); }}>
        <boxGeometry args={[length, wallHeight, line.thickness]} /><meshStandardMaterial color={selected !== null && line.evidenceIds.includes(selected) ? TOKENS.accent : TOKENS.modelShade} roughness={0.8} />
      </mesh>;
    })}
    {document.scaleConfirmed && (document.objects ?? []).filter(object => object.kind === "beam" ? showStructure : ["light","hanging-sign","canopy"].includes(object.kind) ? showOverhead : true).map((object) => <group key={object.id} position={[(object.x - 0.5) * width, object.elevation ?? 0, (object.y - 0.5) * depth]} rotation={[0, -object.rotation * Math.PI / 180, 0]}>
      <mesh castShadow receiveShadow position={[0, object.height / 2, 0]} onClick={e=>{e.stopPropagation();onSelect(object.id);}}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={selected===object.id?TOKENS.accent:object.color} emissive={object.kind === "light" ? object.color : "#000000"} emissiveIntensity={object.kind === "light" ? 0.7 : 0} roughness={0.7} transparent={object.kind === "canopy"} opacity={object.kind === "canopy"?0.8:1}/></mesh>
    </group>)}
    <SceneCamera document={document} view={view} revision={cameraRevision} selected={selected}/>
  </Canvas></SceneBoundary>;
}
