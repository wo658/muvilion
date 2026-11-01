"use client";
import { dimensionsMatch } from "@/lib/assets/dimensions";
import { FixtureObject } from "./fixture-object";
import { ScenePhotography, type PhotoRenderer } from "./scene-photography";
import { PhotographyPanel } from "./photography-panel";
import dynamic from "next/dynamic";
import type { SourceLibrary } from "@/lib/sources/schema";
import type { PhotoRequest } from "@/lib/plans/photography-client";
import type { PhotoShot } from "@/lib/plans/photography";
import type { MuviOperation } from "@/lib/muvi/operations";
import type { MessageKey } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";

import { createPortal } from "react-dom";
import { Component, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { MuviRoaming } from "@/components/muvi/muvi-roaming";
import { useMotionPaused } from "@/components/muvi/use-motion-paused";
import { SceneLabel } from "./scene-label";
import { displayWallHeight, VENUE_COLORS } from "@/lib/plans/overview";
import { Canvas } from "@react-three/fiber";
import { Mask, useMask } from "@react-three/drei/core/Mask";
import { ExhibitionObject } from "./exhibition-object";
import { AssetObject } from "./asset-object";
import { SceneCamera } from "./scene-camera";
import { RoadView, EXPLORE_HINT } from "./road-view";
import { interiorPose, navigationWorld, type CameraView } from "@/lib/plans/camera";
import { Button } from "../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "../ui/popover";
import { NativeSelect } from "../ui/native-select";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Switch } from "../ui/switch";
import { SettingsIcon } from "lucide-react";
import type { PlanDocument } from "@/lib/plans/schema";
import { deriveWalls } from "@/lib/plans/walls";
import { pointInFloor } from "@/lib/plans/footprint";
import { DoubleSide, Shape } from "three";
import { TOKENS } from "@/lib/ui/tokens";

const DeliverablesPanel = dynamic(() => import("./deliverables-panel").then(module => module.DeliverablesPanel), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <SceneUnavailable/> : this.props.children; }
}

/** `toolbar` hosts the camera controls in the shared canvas header; without it they float over the scene. */
export default function SceneView({ document, wallHeight, selected, onSelect, toolbar, muviOperation, photoRequest, onPhotoClose, sources, exportDisabled = false }: { sources?: SourceLibrary; exportDisabled?: boolean; document: PlanDocument; wallHeight: number; selected: string | null; onSelect: (id: string) => void; toolbar?: HTMLElement | null; muviOperation?: MuviOperation | null; photoRequest?: PhotoRequest | null; onPhotoClose?: () => void }) {
  const { t } = useI18n();
  const [photoRenderer, setPhotoRenderer] = useState<PhotoRenderer | null>(null);
  const [deliverablesOpen, setDeliverablesOpen] = useState(false);
  if (deliverablesOpen && photoRequest) setDeliverablesOpen(false);
  const exportTrigger = useRef<HTMLButtonElement>(null);
  const exporting = deliverablesOpen && !exportDisabled && !photoRequest;
  const photographing = Boolean(photoRequest) || exporting;
  const closeDeliverables = () => {
    setDeliverablesOpen(false);
    requestAnimationFrame(() => exportTrigger.current?.focus());
  };
  const systemPaused = useMotionPaused();
  const [showMuvi, setShowMuvi] = useState(true);
  const [muviPaused, setMuviPaused] = useState(false);

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
  const [exploreStatus,setExploreStatus]=useState<MessageKey>(EXPLORE_HINT);
  const overviewCeiling=useRef("hidden");
  const changeView=(next:CameraView)=>{
    onPhotoClose?.();
    setDeliverablesOpen(false);
    if(next==="interior" && view!=="interior") {overviewCeiling.current=ceilingMode;if(document.ceiling)setCeilingMode("solid");}
    if(next!=="interior" && view==="interior") setCeilingMode(overviewCeiling.current);
    setExploreStatus(EXPLORE_HINT);setView(next);setCameraRevision(n=>n+1);
  };
  const [showStructure, setShowStructure] = useState(true);
  const [showOverhead, setShowOverhead] = useState(true);
  const applyPhotoSettings = useCallback((shot: PhotoShot) => {
    setCutaway(shot.cutaway); setCeilingMode(shot.ceilingMode); setShowStructure(shot.showStructure); setShowOverhead(shot.showOverhead);
  }, []);
  // Direct capture preserves Explore's full-height walls; AI shots own their settings.
  const effectiveCutaway = exporting && view === "interior" ? false : cutaway;
  const renderedWallHeight = displayWallHeight(wallHeight, effectiveCutaway, !photographing && view === "interior");
  const showCeiling = ceilingMode !== "hidden";
  const floorShape = useMemo(() => {
    if (!document.floorBoundary?.length) return null;
    const shape = new Shape();
    document.floorBoundary.forEach((p, i) => { if (i === 0) shape.moveTo(p.x * width - width / 2, depth / 2 - p.y * depth); else shape.lineTo(p.x * width - width / 2, depth / 2 - p.y * depth); });
    shape.closePath(); return shape;
  }, [document.floorBoundary, width, depth]);
  const floorOutline = useMemo(() => new Float32Array((document.floorBoundary ?? [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ]).flatMap(p => [(p.x - 0.5) * width, -0.015, (p.y - 0.5) * depth])), [document.floorBoundary, width, depth]);
  const floorMask = useMask(1);
  const tools = <div className="ps-scene-tools">
    <ToggleGroup aria-label={t("Camera view")} value={[view]} onValueChange={values=>{if(values[0])changeView(values[0] as CameraView);}} variant="outline" size="sm" spacing={0}>
      <ToggleGroupItem value="overview">{t("Overview")}</ToggleGroupItem><ToggleGroupItem value="top">{t("Top")}</ToggleGroupItem><ToggleGroupItem value="interior" disabled={!inside} title={!inside?t("Review scale and floor boundary; a clear interior viewpoint is required."):t("Click the floor to move; drag to look around")}>{t("Explore")}</ToggleGroupItem>
    </ToggleGroup>
    <Popover><PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("View settings")} title={t("View settings")}/>}><SettingsIcon/></PopoverTrigger>
      <PopoverContent align="end"><PopoverTitle>{t("View settings")}</PopoverTitle><FieldGroup>
        <Field orientation="horizontal"><FieldLabel htmlFor="cutaway-display">{t("Cutaway")}</FieldLabel><Switch id="cutaway-display" checked={cutaway} disabled={view === "interior"} onCheckedChange={setCutaway}/></Field>
        <Field><FieldLabel htmlFor="ceiling-display">{t("Ceiling")}</FieldLabel><NativeSelect id="ceiling-display" value={ceilingMode} disabled={!document.ceiling||!floorShape} onChange={e=>setCeilingMode(e.target.value)}><option value="hidden">{t("Hidden")}</option><option value="solid">{t("Solid")}</option><option value="transparent">{t("Transparent")}</option></NativeSelect></Field>
        <Field orientation="horizontal"><FieldLabel htmlFor="structure-display">{t("Beams / structure")}</FieldLabel><Switch id="structure-display" checked={showStructure} onCheckedChange={setShowStructure}/></Field>
        <Field orientation="horizontal"><FieldLabel htmlFor="overhead-display">{t("Lights / hanging elements")}</FieldLabel><Switch id="overhead-display" checked={showOverhead} onCheckedChange={setShowOverhead}/></Field>
        <Field orientation="horizontal"><FieldLabel htmlFor="muvi-display">{t("Show Muvi")}</FieldLabel><Switch id="muvi-display" checked={showMuvi} onCheckedChange={setShowMuvi}/></Field>
        <Button variant="outline" size="sm" disabled={!showMuvi || systemPaused} onClick={() => setMuviPaused(value => !value)}>{(muviPaused || systemPaused ? t("Resume Muvi") : t("Pause Muvi"))}</Button>
        <Button variant="outline" size="sm" onClick={()=>changeView(view)}>{t("Reset camera")}</Button>
      </FieldGroup>
      <details className="mt-4 text-xs text-muted"><summary className="cursor-pointer">{t("View help and model information")}</summary>
        <p className="mt-2">{view==="interior"?t("Click a clear floor point to move. Drag to look around; scroll to zoom. Walls, installations and low overhead elements block travel. Choose nearby points to go around obstacles."):t("Drag to orbit. Right-drag to pan. Scroll to zoom.")}</p>
        <p className="mt-2">{document.ceiling?`${t("Ceiling")} ${document.ceiling.height} m · ${t(document.ceiling.status)}`:t("Ceiling height not set")}{t(". Wall height")}{wallHeight} {t("m is provisional.")}</p>
        <p className="mt-2">{walls.length} {t("wall sections from")}{document.lines.filter(l=>l.kind==="wall").length} {t("source lines. Display settings never change the design or checks.")}</p>
      </details></PopoverContent>
    </Popover>
    {sources && <Button ref={exportTrigger} variant="outline" size="sm" disabled={exportDisabled || !photoRenderer} aria-expanded={exporting} onClick={() => { onPhotoClose?.(); setDeliverablesOpen(value => !value); }}>{t("Capture · PDF")}</Button>}
  </div>;
  return <SceneBoundary>{toolbar ? createPortal(tools, toolbar) : tools}{!photographing && view==="interior" && <div className="ps-explore-hint" role="status">{t(exploreStatus)}</div>}<div className={photographing ? "ps-photo-workspace" : "contents"}><div className={photographing ? "ps-photo-stage" : "contents"}><div className={photographing ? "ps-photo-frame" : "contents"}><Canvas key={`${width}-${depth}`} frameloop="demand" gl={{ stencil: true }} shadows camera={cameraOptions} dpr={[1, 1.5]}>

    <color attach="background" args={[TOKENS.sunken]} />
    <ambientLight intensity={exhibition?0.9:1.5} />
    {exhibition && <hemisphereLight args={["#e6f1ff","#c6b69b",1.4]}/>}
    <directionalLight position={[span / 3, span, span / 2]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.04} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, 0]}>{floorShape ? <shapeGeometry args={[floorShape]} /> : <planeGeometry args={[width, depth]} />}<meshStandardMaterial color={exhibition?"#b9b5af":TOKENS.floorIndoor} roughness={0.9} /></mesh>
    <lineLoop><bufferGeometry><bufferAttribute attach="attributes-position" args={[floorOutline, 3]}/></bufferGeometry><lineBasicMaterial color={TOKENS.edge}/></lineLoop>
    {floorShape && <Mask id={1} rotation-x={-Math.PI / 2} position={[0, 0.015, 0]}><shapeGeometry args={[floorShape]}/><meshBasicMaterial side={DoubleSide}/></Mask>}
    {floorShape && document.ceiling && showCeiling && <mesh rotation-x={-Math.PI / 2} position={[0, document.ceiling.height, 0]} receiveShadow><shapeGeometry args={[floorShape]}/><meshStandardMaterial side={DoubleSide} color={document.ceiling.color} roughness={0.85} transparent={ceilingMode==="transparent"} opacity={ceilingMode==="transparent"?0.18:1} depthWrite={ceilingMode!=="transparent"}/></mesh>}
    {document.scaleConfirmed && (document.zones ?? []).map(zone => <mesh key={zone.id} rotation={[-Math.PI/2,0,zone.rotation*Math.PI/180]} position={[(zone.x-0.5)*width,0.015,(zone.y-0.5)*depth]} onClick={view==="interior"?undefined:e=>{if(document.floorBoundary && !pointInFloor({x:e.point.x/width+.5,y:e.point.z/depth+.5},document.floorBoundary))return;e.stopPropagation();onSelect(zone.id);}}><planeGeometry args={[zone.width,zone.depth]}/><meshBasicMaterial {...(floorShape ? floorMask : {})} color={!photographing && selected===zone.id?TOKENS.accent:exhibition?(zone.purpose==="lounge"?"#d2bfa7":"#263b58"):TOKENS.zoneOverlay} transparent opacity={!photographing && selected===zone.id?0.3:exhibition?.65:.13} depthWrite={false} side={DoubleSide}/></mesh>)}
    <gridHelper args={[span * 1.5, 24, TOKENS.hairline, TOKENS.hairline]} position={[0, -0.03, 0]} />
    {walls.map((line) => {
      const ax = line.a.x - width / 2, az = line.a.y - depth / 2;
      const bx = line.b.x - width / 2, bz = line.b.y - depth / 2;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.001) return null;
      return <mesh userData={{navigationObstacle:true}} key={line.id} position={[(ax + bx) / 2, renderedWallHeight / 2, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]} castShadow={photographing ? !cutaway : view === "interior"} onClick={(e) => { if(view==="interior" && e.delta>5)return; e.stopPropagation(); if(view!=="interior")onSelect(line.evidenceIds[0]);else setExploreStatus("Path blocked. Choose a clear floor point."); }}>
        <boxGeometry args={[length, renderedWallHeight, line.thickness]} /><meshStandardMaterial color={!photographing && selected !== null && line.evidenceIds.includes(selected) ? TOKENS.accent : VENUE_COLORS.existing} roughness={0.8} />
      </mesh>;
    })}
    {document.scaleConfirmed && (document.objects ?? []).filter(object => object.kind === "beam" ? showStructure : ["light","hanging-sign","canopy"].includes(object.kind) ? showOverhead : true).map((object) => <group key={object.id} position={[(object.x - 0.5) * width, object.elevation ?? 0, (object.y - 0.5) * depth]} rotation={[0, -object.rotation * Math.PI / 180, 0]}>
      {object.fixtureType && dimensionsMatch(object) ? <group onClick={e => { e.stopPropagation(); if (view !== "interior") onSelect(object.id); }}><FixtureObject type={object.fixtureType} color={object.color}/></group> : object.modelAssetId || object.materialAssetId ? <group onClick={e => { if (view === "interior" && e.delta > 5) return; e.stopPropagation(); if (view !== "interior") onSelect(object.id); else setExploreStatus("Path blocked. Choose a clear floor point."); }}>
        <AssetObject object={object} selected={!photographing && selected === object.id} />
        {object.kind === "partition" && <>
          <mesh position={[0,object.height-0.0125,0]}><boxGeometry args={[object.width,0.025,object.depth]}/><meshBasicMaterial color={TOKENS.venuePartitionEdge}/></mesh>
          {!photographing && selected === object.id && <SceneLabel position={[0,object.height+0.5,0]} text={t(object.provenance === "ai" ? "AI-proposed partition" : "Planned partition")} color={TOKENS.venuePartitionEdge}/>}
        </>}
      </group> : object.kind === "partition" ? <group onClick={e => { if (view === "interior") return; e.stopPropagation(); onSelect(object.id); }}>
        <mesh userData={{navigationObstacle:true}} position={[0,object.height/2,0]} castShadow><boxGeometry args={[object.width,object.height,object.depth]}/><meshStandardMaterial color={!photographing && selected === object.id ? TOKENS.accent : object.color} roughness={0.85}/></mesh>
        <mesh position={[0,object.height-0.0125,0]}><boxGeometry args={[object.width,0.025,object.depth]}/><meshBasicMaterial color={TOKENS.venuePartitionEdge}/></mesh>
        {!photographing && selected === object.id && <SceneLabel position={[0,object.height+0.5,0]} text={t(object.provenance === "ai" ? "AI-proposed partition" : "Planned partition")} color={TOKENS.venuePartitionEdge}/>}
      </group> : exhibition ? <group onClick={e=>{if(view==="interior"&&e.delta>5)return;e.stopPropagation();if(view!=="interior")onSelect(object.id);else setExploreStatus("Path blocked. Choose a clear floor point.");}}><ExhibitionObject object={object}/></group> : (<mesh userData={{navigationObstacle:true}} castShadow receiveShadow position={[0, object.height / 2, 0]} onClick={e=>{if(view==="interior" && e.delta>5)return;e.stopPropagation();if(view!=="interior")onSelect(object.id);else setExploreStatus("Path blocked. Choose a clear floor point.");}}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={!photographing && selected===object.id?TOKENS.accent:object.color} emissive={object.kind === "light" ? object.color : "#000000"} emissiveIntensity={object.kind === "light" ? 0.7 : 0} roughness={0.7} transparent={object.kind === "canopy"} opacity={object.kind === "canopy"?0.8:1}/></mesh>)}

    </group>)}
    {(document.entrances ?? []).map(entrance => <group key={entrance.id} position={[(entrance.x-.5)*width,0.08,(entrance.y-.5)*depth]} rotation-y={entrance.rotation*Math.PI/180}>
      <mesh rotation-x={-Math.PI/2}><ringGeometry args={[0.55,0.85,32]}/><meshBasicMaterial color={VENUE_COLORS.entrance} side={DoubleSide} depthWrite={false}/></mesh>
      <mesh rotation-x={-Math.PI/2} position={[0,0.02,-0.25]}><circleGeometry args={[0.45,3]}/><meshBasicMaterial color={VENUE_COLORS.entrance} side={DoubleSide}/></mesh>
      <SceneLabel position={[0,Math.max(renderedWallHeight,1.2)+0.6,0]} text={`↳ ${entrance.label}`} color={VENUE_COLORS.entrance} onSelect={() => onSelect(entrance.id)}/>
    </group>)}
    {!photographing && view==="interior" && world && floorShape && <RoadView key={cameraRevision} world={world} shape={floorShape} onStatus={setExploreStatus}/>}
    {showMuvi && !photographing && <MuviRoaming key={`${width}-${depth}`} width={width} depth={depth} operation={muviOperation} paused={muviPaused || systemPaused}/>}
    <ScenePhotography onReady={setPhotoRenderer} settings={{cutaway: effectiveCutaway, ceilingMode: ceilingMode as PhotoShot["ceilingMode"], showStructure, showOverhead}}/>
    <SceneCamera photography={photographing} document={document} view={view} revision={cameraRevision} selected={selected}/>
  </Canvas></div></div>{!exporting && photoRequest && <PhotographyPanel key={photoRequest.id} request={photoRequest} document={document} renderer={photoRenderer} applySettings={applyPhotoSettings} onClose={() => { onPhotoClose?.(); setCameraRevision(n => n + 1); }}/>}{exporting && sources && <DeliverablesPanel document={document} sources={sources} renderer={photoRenderer} onClose={closeDeliverables}/>}</div></SceneBoundary>;
}

function SceneUnavailable() {
  const { t } = useI18n(); return <div className="ps-canvas-message"><h3>{t("3D is unavailable in this browser")}</h3><p>{t("Your plan is safe. Continue editing in 2D.")}</p></div>; }
