"use client";

import { useMemo, useState } from "react";
import type { PlanDocument } from "@/lib/plans/schema";

type Point = { x: number; y: number };
export function PlanCanvas({ document, selected, onSelect, sourceOnly, drawing, onDraw, measurement, rectangle, floorDraft, onBoundaryPoint }: {
  floorDraft?: Point[] | null; onBoundaryPoint?: (point: Point) => void;
  document: PlanDocument; selected: string | null; onSelect: (id: string | null) => void;
  sourceOnly: boolean; drawing: boolean; onDraw: (a: Point, b: Point) => void; measurement: [Point, Point] | null; rectangle: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [start, setStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const width = document.source.width, height = document.source.height;
  const paths = useMemo(() => {
    const paths = {unknown: "", wall: "", dimension: ""};
    for (const line of document.lines) paths[line.kind] += `M${line.a.x*width},${line.a.y*height}L${line.b.x*width},${line.b.y*height}`;
    return paths;
  }, [document.lines, width, height]);
  const selectedLine = document.lines.find(line => line.id === selected);
  const point = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const svg = event.currentTarget;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.max(0, Math.min(1, p.x / width)), y: Math.max(0, Math.min(1, p.y / height)) };
  };
  return <div className={`ps-plan ${drawing ? "is-drawing" : ""}`}>
    <div className="ps-plan-scroll"><svg style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: `${zoom * 100}%`, minHeight: `${zoom * 100}%` }} viewBox={`0 0 ${width} ${height}`} aria-label="Floor plan with extracted geometry" onPointerDown={(e) => {
      if (onBoundaryPoint) { onBoundaryPoint(point(e)); return; }
      if (!drawing) {
        if (sourceOnly) return;
        const p=point(e),px=p.x*width,py=p.y*height;
        let best: string | null=null, distance=8/(e.currentTarget.getScreenCTM()?.a ?? 1);
        for (const line of document.lines) {
          const ax=line.a.x*width,ay=line.a.y*height,dx=(line.b.x-line.a.x)*width,dy=(line.b.y-line.a.y)*height;
          const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy || 1)));
          const d=Math.hypot(px-ax-t*dx,py-ay-t*dy);
          if (d<distance) {distance=d;best=line.id;}
        }
        onSelect(best); return;
      }
      const p = point(e);
      if (start) { if (Math.hypot(p.x - start.x, p.y - start.y) > 0.002) onDraw(start, p); setStart(null); }
      else setStart(p);
    }} onPointerMove={(e) => { if (drawing && start) setCursor(point(e)); }} onKeyDown={(e) => { if (e.key === "Escape") setStart(null); }} tabIndex={drawing ? 0 : -1}>
      <rect width={width} height={height} fill="white" />
      <image href={document.preview} width={width} height={height} opacity={sourceOnly ? 1 : 0.5} />
      {!sourceOnly && <g pointerEvents="none">
        <path d={paths.unknown} fill="none" stroke="#8596a5" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        <path d={paths.dimension} fill="none" stroke="#aa7933" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        <path d={paths.wall} fill="none" stroke="#2f7a5b" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        {selectedLine && <line x1={selectedLine.a.x*width} y1={selectedLine.a.y*height} x2={selectedLine.b.x*width} y2={selectedLine.b.y*height} stroke="#0064e0" strokeWidth={4} vectorEffect="non-scaling-stroke" />}
      </g>}
      {!sourceOnly && document.scaleConfirmed && document.widthMeters && document.heightMeters && (document.zones ?? []).map(zone => {
        const w=(zone.rotation===90?zone.depth:zone.width)/document.widthMeters!*width,h=(zone.rotation===90?zone.width:zone.depth)/document.heightMeters!*height;
        return <g key={zone.id} transform={`translate(${zone.x*width} ${zone.y*height})`} onPointerDown={e=>{if(!drawing&&!onBoundaryPoint){e.stopPropagation();onSelect(zone.id);}}} style={{cursor:"pointer"}}><rect x={-w/2} y={-h/2} width={w} height={h} fill="#72b5aa" fillOpacity={selected===zone.id?0.4:0.16} stroke={selected===zone.id?"#0064e0":"#438b80"} strokeDasharray="5 3" vectorEffect="non-scaling-stroke"/><text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(6,Math.min(w/8,15))} fill="#25554f">{zone.label}</text></g>;
      })}
      {!sourceOnly && document.scaleConfirmed && document.widthMeters && document.heightMeters && (document.objects ?? []).map((object) => {
        const w = (object.rotation === 90 ? object.depth : object.width) / document.widthMeters! * width, h = (object.rotation === 90 ? object.width : object.depth) / document.heightMeters! * height;
        return <g key={object.id} transform={`translate(${object.x * width} ${object.y * height})`} onPointerDown={e=>{if(!drawing&&!onBoundaryPoint){e.stopPropagation();onSelect(object.id);}}} style={{cursor:"pointer"}}><rect x={-w / 2} y={-h / 2} width={w} height={h} fill={object.color} fillOpacity={0.8} stroke={selected===object.id?"#0064e0":"white"} strokeWidth={selected===object.id?3:1} vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(6, Math.min(w / 6, 15))} fill="white">{object.label}</text></g>;
      })}
      {(floorDraft ?? document.floorBoundary) && <g pointerEvents="none"><polygon points={(floorDraft ?? document.floorBoundary ?? []).map(p=>`${p.x*width},${p.y*height}`).join(" ")} fill="#0064e0" fillOpacity={0.06} stroke="#0064e0" strokeWidth={2} strokeDasharray={floorDraft ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />{floorDraft?.map((p,i)=><circle key={i} cx={p.x*width} cy={p.y*height} r={4} fill="#0064e0" />)}</g>}
      {measurement && <g stroke="#aa7933" strokeWidth={3} fill="#aa7933"><line x1={measurement[0].x * width} y1={measurement[0].y * height} x2={measurement[1].x * width} y2={measurement[1].y * height} vectorEffect="non-scaling-stroke" />{measurement.map((p, i) => <circle key={i} cx={p.x * width} cy={p.y * height} r={width / 150} />)}</g>}
      {drawing && start && cursor && (rectangle ? <rect x={Math.min(start.x, cursor.x) * width} y={Math.min(start.y, cursor.y) * height} width={Math.abs(start.x - cursor.x) * width} height={Math.abs(start.y - cursor.y) * height} fill="#0064e0" fillOpacity={0.12} stroke="#0064e0" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" /> : <line x1={start.x * width} y1={start.y * height} x2={cursor.x * width} y2={cursor.y * height} stroke="#0064e0" strokeWidth={3} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />)}
    </svg></div><div className="ps-zoom" role="group" aria-label="Plan zoom"><button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} aria-label="Zoom in">+</button><button onClick={() => setZoom(1)}>Fit</button></div>
  </div>;
}
