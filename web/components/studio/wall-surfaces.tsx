"use client";

import { Component, Suspense, useLayoutEffect, useMemo, type ReactNode } from "react";
import { useTexture } from "@react-three/drei";
import { CanvasTexture, NoColorSpace, SRGBColorSpace } from "three";
import { getMaterialAsset } from "@/lib/assets/catalog";
import type { PlanDocument, WallSurface } from "@/lib/plans/schema";
import { wallSurfaceFrame } from "@/lib/plans/wall-surfaces";
import type { DerivedWall } from "@/lib/plans/walls";
import { TOKENS } from "@/lib/ui/tokens";

class SurfaceBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function SurfaceMaterial({ id, color }: { id: string; color: string }) {
  const asset = getMaterialAsset(id);
  if (!asset) throw new Error("Unknown wall material");
  return <LoadedMaterial maps={asset.maps} color={color}/>;
}
function LoadedMaterial({ maps, color }: { maps: { color: string; normal: string; roughness: string; metalness?: string }; color: string }) {
  const urls = useMemo(() => ({ map: maps.color, normalMap: maps.normal, roughnessMap: maps.roughness, ...(maps.metalness ? { metalnessMap: maps.metalness } : {}) }), [maps]);
  const loaded = useTexture(urls);
  useLayoutEffect(() => {
    for (const [key, texture] of Object.entries(loaded)) {
      const space = key === "map" ? SRGBColorSpace : NoColorSpace;
      if (texture.colorSpace !== space) { texture.colorSpace = space; texture.needsUpdate = true; }
    }
  }, [loaded]);
  return <meshStandardMaterial {...loaded} color={color} roughness={1} metalness={maps.metalness ? 1 : 0}/>;
}
/** Local canvas lettering supports Korean without remote font downloads. */
function Lettering({ text, color, width, height }: { text: string; color: string; width: number; height: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 2048; canvas.height = 512;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = color;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let size = 180; ctx.font = `600 ${size}px system-ui, sans-serif`;
    const lines = text.split("\n").slice(0, 3);
    const longest = Math.max(...lines.map(line => ctx.measureText(line).width), 1);
    size = Math.min(size, size * 1900 / longest, 400 / lines.length);
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, 1024, 256 + (i - (lines.length - 1) / 2) * size * 1.15));
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; return result;
  }, [text, color]);
  useLayoutEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  const w = Math.min(width * .85, height * 3);
  return <mesh position={[0, 0, .004]}><planeGeometry args={[w, w / 4]}/><meshBasicMaterial map={texture} transparent depthWrite={false}/></mesh>;
}
function SurfaceFace({ surface, width, height }: { surface: WallSurface; width: number; height: number }) {
  const fallback = <meshStandardMaterial color={surface.color} roughness={.85}/>;
  const graphicColor = surface.graphicColor ?? surface.textColor ?? TOKENS.ink;
  return <>
    <mesh receiveShadow><planeGeometry args={[width, height]}/>
      {surface.materialAssetId ? <SurfaceBoundary key={surface.materialAssetId} fallback={fallback}><Suspense fallback={fallback}><SurfaceMaterial id={surface.materialAssetId} color={surface.color}/></Suspense></SurfaceBoundary> : fallback}
    </mesh>
    {surface.graphic === "stripe" && <mesh position={[0, -height * .28, .002]}><planeGeometry args={[width, height * .12]}/><meshStandardMaterial color={graphicColor}/></mesh>}
    {surface.graphic === "frame" && [[0, -height * .44, width * .9, height * .025], [0, height * .44, width * .9, height * .025], [-width * .44, 0, width * .025, height * .9], [width * .44, 0, width * .025, height * .9]].map(([x, y, w, h], i) => <mesh key={i} position={[x, y, .002]}><planeGeometry args={[w, h]}/><meshStandardMaterial color={graphicColor}/></mesh>)}
    {surface.text && <Lettering text={surface.text} color={surface.textColor ?? TOKENS.ink} width={width} height={height}/>}
  </>;
}
export function WallSurfaces({ document, walls, onSelect }: { document: PlanDocument; walls: DerivedWall[]; onSelect?: (hostId: string) => void }) {
  return <>{(document.wallSurfaces ?? []).map(surface => {
    const frame = wallSurfaceFrame(document, surface, walls); if (!frame) return null;
    return <group key={surface.id} name={`wall-surface:${surface.id}`} position={[frame.x - document.widthMeters! / 2, frame.elevation + frame.height / 2, frame.y - document.heightMeters! / 2]} rotation-y={-frame.angle} onClick={onSelect ? event => { event.stopPropagation(); onSelect(surface.hostId); } : undefined}>
      <SurfaceFace surface={surface} width={frame.width} height={frame.height}/>
    </group>;
  })}</>;
}
