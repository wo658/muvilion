"use client";

import { Component, useMemo, useRef, useState, type ReactNode } from "react";
import { SceneLabel } from "./scene-label";
import { displayWallHeight, VENUE_COLORS, partitionLabel } from "@/lib/plans/overview";
import { Canvas } from "@react-three/fiber";
import { ExhibitionObject } from "./exhibition-object";
import { SceneCamera } from "./scene-camera";
import { RoadView, EXPLORE_HINT } from "./road-view";
import { interiorPose, navigationWorld, type CameraView } from "@/lib/plans/camera";
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
  const exhibition = document.visualStyle === "exhibition";
  const width = document.widthMeters ?? 10;
  const depth = document.heightMeters ?? width * document.source.height / document.source.width;
  const span = Math.max(width, depth);
  const cameraOptions = useMemo(() => ({ position: [span * 0.75, span * 0.8, span * 0.9] as [number, number, number], fov: 40, near: 0.2, far: Math.max(100, span * 8) }), [span]);
  const walls = useMemo(() => deriveWalls(document, { pairParallelEdges: true }), [document]);
  const [cutaway, setCutaway] = useState(true);
  const [ceilingMode, setCeilingMode] = useState("hidden");
  const [view,setView]=useState<CameraView>("overview");
  const [cameraRevision,setCameraRevision]=useState(0);
  const inside=useMemo(()=>interiorPose(document),[document]);
  const world=useMemo(()=>navigationWorld({...document,wallHeight}),[document,wallHeight]);
  const [exploreStatus,setExploreStatus]=useState(EXPLORE_HINT);
  const overviewCeiling=useRef("hidden");
  const selectedItem=document.objects?.some(o=>o.id===selected)||document.zones?.some(z=>z.id===selected);
  const changeView=(next:CameraView)=>{
    if(next==="interior" && view!=="interior") {overviewCeiling.current=ceilingMode;if(document.ceiling)setCeilingMode("solid");}
    if(next!=="interior" && view==="interior") setCeilingMode(overviewCeiling.current);
    setExploreStatus(EXPLORE_HINT);setView(next);setCameraRevision(n=>n+1);
  };
  const [showStructure, setShowStructure] = useState(true);
  const [showOverhead, setShowOverhead] = useState(true);
  const renderedWallHeight = displayWallHeight(wallHeight, cutaway, view === "interior");
  const showCeiling = ceilingMode !== "hidden";
  const floorShape = useMemo(() => {
    if (!document.floorBoundary?.length) return null;
    const shape = new Shape();
    document.floorBoundary.forEach((p, i) => { if (i === 0) shape.moveTo(p.x * width - width / 2, depth / 2 - p.y * depth); else shape.lineTo(p.x * width - width / 2, depth / 2 - p.y * depth); });
    shape.closePath(); return shape;
  }, [document.floorBoundary, width, depth]);
  return <SceneBoundary><div className="ps-scene-tools">
    <ToggleGroup aria-label="Camera view" value={[view]} onValueChange={values=>{if(values[0])changeView(values[0] as CameraView);}} variant="outline" size="sm" spacing={0}>
      <ToggleGroupItem value="overview">Overview</ToggleGroupItem><ToggleGroupItem value="top">Top</ToggleGroupItem><ToggleGroupItem value="interior" disabled={!inside} title={!inside?"Review scale and floor boundary; a clear interior viewpoint is required.":"Click the floor to move; drag to look around"}>Explore</ToggleGroupItem>
    </ToggleGroup>
    <Button variant="outline" size="icon-sm" aria-label="Focus selected area or element" title="Focus selection" disabled={!selectedItem} onClick={()=>changeView("selection")}><FocusIcon/></Button>
    <Button variant="outline" size="icon-sm" aria-label="Reset camera" title="Reset camera" onClick={()=>changeView(view)}><RotateCcwIcon/></Button>
    <Button variant={cutaway ? "secondary" : "outline"} size="sm" aria-pressed={cutaway} disabled={view === "interior"} onClick={() => setCutaway(value => !value)}>단면 보기</Button>
    <Popover><PopoverTrigger render={<Button variant="outline" size="icon-sm" aria-label="Display layers" title="Display layers"/>}><LayersIcon/></PopoverTrigger><PopoverContent align="start"><PopoverTitle>Display layers</PopoverTitle><FieldGroup>
      <Field><FieldLabel htmlFor="ceiling-display">Ceiling</FieldLabel><NativeSelect id="ceiling-display" value={ceilingMode} disabled={!document.ceiling||!floorShape} onChange={e=>setCeilingMode(e.target.value)}><option value="hidden">Hidden</option><option value="solid">Solid</option><option value="transparent">Transparent</option></NativeSelect></Field>
      <Field orientation="horizontal"><FieldLabel htmlFor="structure-display">Beams / structure</FieldLabel><Switch id="structure-display" checked={showStructure} onCheckedChange={setShowStructure}/></Field>
      <Field orientation="horizontal"><FieldLabel htmlFor="overhead-display">Lights / hanging elements</FieldLabel><Switch id="overhead-display" checked={showOverhead} onCheckedChange={setShowOverhead}/></Field>
    </FieldGroup></PopoverContent></Popover>
    <Popover><PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="View help and model information"/>}><InfoIcon/></PopoverTrigger><PopoverContent align="start"><PopoverTitle>Viewing the space</PopoverTitle><p>{view==="interior"?"Click a clear floor point to move. Drag to look around; scroll to zoom. Walls, installations and low overhead elements block travel. Choose nearby points to go around obstacles.":"Drag to orbit. Right-drag to pan. Scroll to zoom. Select an area or element, then Focus."}</p><p>{document.ceiling?`Ceiling ${document.ceiling.height} m · ${document.ceiling.status}`:"Ceiling height not set"}. Wall height {wallHeight} m is provisional.</p><p>{walls.length} wall sections from {document.lines.filter(l=>l.kind==="wall").length} source lines. Display settings never change the design or checks.</p></PopoverContent></Popover>
  </div><div className="ps-venue-legend" aria-label="Space legend"><span><i style={{background:VENUE_COLORS.existing}}/>기존 벽 · 도면 기반</span><span><i style={{background:VENUE_COLORS.partition}}/>계획 / AI 가벽</span><span><i style={{background:VENUE_COLORS.entrance}}/>입구 표시</span>{cutaway && view !== "interior" && <span>단면 조감도</span>}</div>{view==="interior" && <div className="ps-explore-hint" role="status">{exploreStatus}</div>}<Canvas key={`${width}-${depth}`} frameloop="demand" shadows camera={cameraOptions} dpr={[1, 1.5]}>
    <color attach="background" args={[TOKENS.bg]} />
    <ambientLight intensity={exhibition?0.9:1.5} />
    {exhibition && <hemisphereLight args={["#e6f1ff","#c6b69b",1.4]}/>}
    <directionalLight position={[span / 3, span, span / 2]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.04} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, 0]}>{floorShape ? <shapeGeometry args={[floorShape]} /> : <planeGeometry args={[width, depth]} />}<meshStandardMaterial color={exhibition?"#b9b5af":"#ffffff"} roughness={0.9} /></mesh>
    {floorShape && document.ceiling && showCeiling && <mesh rotation-x={-Math.PI / 2} position={[0, document.ceiling.height, 0]} receiveShadow><shapeGeometry args={[floorShape]}/><meshStandardMaterial side={DoubleSide} color={document.ceiling.color} roughness={0.85} transparent={ceilingMode==="transparent"} opacity={ceilingMode==="transparent"?0.18:1} depthWrite={ceilingMode!=="transparent"}/></mesh>}
    {document.scaleConfirmed && (document.zones ?? []).map(zone => <mesh key={zone.id} rotation={[-Math.PI/2,0,zone.rotation*Math.PI/180]} position={[(zone.x-0.5)*width,0.015,(zone.y-0.5)*depth]} onClick={view==="interior"?undefined:e=>{e.stopPropagation();onSelect(zone.id);}}><planeGeometry args={[zone.width,zone.depth]}/><meshBasicMaterial color={selected===zone.id?TOKENS.accent:exhibition?(zone.purpose==="lounge"?"#d2bfa7":"#263b58"):"#7fb7b2"} transparent opacity={selected===zone.id?0.3:exhibition?.65:.13} depthWrite={false} side={DoubleSide}/></mesh>)}
    {!exhibition && <gridHelper args={[span * 1.5, 24, TOKENS.hairlineStrong, TOKENS.hairline]} position={[0, -0.03, 0]} />}
    {walls.map((line) => {
      const ax = line.a.x - width / 2, az = line.a.y - depth / 2;
      const bx = line.b.x - width / 2, bz = line.b.y - depth / 2;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.001) return null;
      return <mesh userData={{navigationObstacle:true}} key={line.id} position={[(ax + bx) / 2, renderedWallHeight / 2, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]} castShadow={view === "interior"} onClick={(e) => { if(view==="interior" && e.delta>5)return; e.stopPropagation(); if(view!=="interior")onSelect(line.evidenceIds[0]);else setExploreStatus("Path blocked. Choose a clear floor point."); }}>
        <boxGeometry args={[length, renderedWallHeight, line.thickness]} /><meshStandardMaterial color={selected !== null && line.evidenceIds.includes(selected) ? TOKENS.accent : VENUE_COLORS.existing} roughness={0.8} />
      </mesh>;
    })}
    {document.scaleConfirmed && (document.objects ?? []).filter(object => object.kind === "beam" ? showStructure : ["light","hanging-sign","canopy"].includes(object.kind) ? showOverhead : true).map((object) => <group key={object.id} position={[(object.x - 0.5) * width, object.elevation ?? 0, (object.y - 0.5) * depth]} rotation={[0, -object.rotation * Math.PI / 180, 0]}>
      {object.kind === "partition" ? <group onClick={e => { if (view === "interior") return; e.stopPropagation(); onSelect(object.id); }}>
        <mesh userData={{navigationObstacle:true}} position={[0,object.height/2,0]} castShadow><boxGeometry args={[object.width,object.height,object.depth]}/><meshStandardMaterial color={selected === object.id ? TOKENS.accent : VENUE_COLORS.partition} roughness={0.85}/></mesh>
        <mesh position={[0,object.height+0.012,0]}><boxGeometry args={[object.width,0.025,object.depth+0.02]}/><meshBasicMaterial color="#256897"/></mesh>
        {selected === object.id && <SceneLabel position={[0,object.height+0.5,0]} text={partitionLabel(object)} color="#256897"/>}
      </group> : exhibition ? <group onClick={e=>{if(view==="interior"&&e.delta>5)return;e.stopPropagation();if(view!=="interior")onSelect(object.id);else setExploreStatus("Path blocked. Choose a clear floor point.");}}><ExhibitionObject object={object}/></group> : (<mesh userData={{navigationObstacle:true}} castShadow receiveShadow position={[0, object.height / 2, 0]} onClick={e=>{if(view==="interior" && e.delta>5)return;e.stopPropagation();if(view!=="interior")onSelect(object.id);else setExploreStatus("Path blocked. Choose a clear floor point.");}}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={selected===object.id?TOKENS.accent:object.color} emissive={object.kind === "light" ? object.color : "#000000"} emissiveIntensity={object.kind === "light" ? 0.7 : 0} roughness={0.7} transparent={object.kind === "canopy"} opacity={object.kind === "canopy"?0.8:1}/></mesh>)}

    </group>)}
    {(document.entrances ?? []).map(entrance => <group key={entrance.id} position={[(entrance.x-.5)*width,0.08,(entrance.y-.5)*depth]} rotation-y={entrance.rotation*Math.PI/180}>
      <mesh rotation-x={-Math.PI/2}><ringGeometry args={[0.55,0.85,32]}/><meshBasicMaterial color={VENUE_COLORS.entrance} side={DoubleSide} depthWrite={false}/></mesh>
      <mesh rotation-x={-Math.PI/2} position={[0,0.02,-0.25]}><circleGeometry args={[0.45,3]}/><meshBasicMaterial color={VENUE_COLORS.entrance} side={DoubleSide}/></mesh>
      <SceneLabel position={[0,Math.max(renderedWallHeight,1.2)+0.6,0]} text={`↳ ${entrance.label}`} color={VENUE_COLORS.entrance} onSelect={() => onSelect(entrance.id)}/>
    </group>)}
    {view==="interior" && world && floorShape && <RoadView key={cameraRevision} world={world} shape={floorShape} onStatus={setExploreStatus}/>}
    <SceneCamera document={document} view={view} revision={cameraRevision} selected={selected}/>
  </Canvas></SceneBoundary>;
}
