"use client";

import { useState } from "react";
import type { PlanDocument } from "@/lib/plans/schema";

type Point = { x: number; y: number };
export function PlanCanvas({ document, selected, onSelect, sourceOnly, drawing, onDraw, measurement, rectangle }: {
  document: PlanDocument; selected: string | null; onSelect: (id: string | null) => void;
  sourceOnly: boolean; drawing: boolean; onDraw: (a: Point, b: Point) => void; measurement: [Point, Point] | null; rectangle: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [start, setStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const width = document.source.width, height = document.source.height;
  const point = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const svg = event.currentTarget;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.max(0, Math.min(1, p.x / width)), y: Math.max(0, Math.min(1, p.y / height)) };
  };
  return <div className={`ps-plan ${drawing ? "is-drawing" : ""}`}>
    <div className="ps-plan-scroll"><svg style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: `${zoom * 100}%`, minHeight: `${zoom * 100}%` }} viewBox={`0 0 ${width} ${height}`} aria-label="Floor plan with extracted geometry" onPointerDown={(e) => {
      if (!drawing) { if (e.target === e.currentTarget) onSelect(null); return; }
      const p = point(e);
      if (start) { if (Math.hypot(p.x - start.x, p.y - start.y) > 0.002) onDraw(start, p); setStart(null); }
      else setStart(p);
    }} onPointerMove={(e) => { if (drawing && start) setCursor(point(e)); }} onKeyDown={(e) => { if (e.key === "Escape") setStart(null); }} tabIndex={drawing ? 0 : -1}>
      <rect width={width} height={height} fill="white" />
      <image href={document.preview} width={width} height={height} opacity={sourceOnly ? 1 : 0.5} />
      {!sourceOnly && document.lines.map((line) => <g key={line.id}>
        <line x1={line.a.x * width} y1={line.a.y * height} x2={line.b.x * width} y2={line.b.y * height}
          stroke={selected === line.id ? "#0064e0" : line.kind === "wall" ? "#2f7a5b" : line.kind === "dimension" ? "#aa7933" : "#8596a5"}
          strokeWidth={selected === line.id ? 4 : line.kind === "wall" ? 2.5 : 1.1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <line x1={line.a.x * width} y1={line.a.y * height} x2={line.b.x * width} y2={line.b.y * height}
          stroke="transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" className="ps-line-hit"
          onPointerDown={(e) => { if (!drawing) { e.stopPropagation(); onSelect(line.id); } }}>
          <title>{line.kind} · {line.id}</title>
        </line>
      </g>)}
      {!sourceOnly && document.scaleConfirmed && document.widthMeters && document.heightMeters && (document.objects ?? []).map((object) => {
        const w = (object.rotation === 90 ? object.depth : object.width) / document.widthMeters! * width, h = (object.rotation === 90 ? object.width : object.depth) / document.heightMeters! * height;
        return <g key={object.id} transform={`translate(${object.x * width} ${object.y * height})`} pointerEvents="none"><rect x={-w / 2} y={-h / 2} width={w} height={h} fill={object.color} fillOpacity={0.8} stroke="white" strokeWidth={1} vectorEffect="non-scaling-stroke" /><text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(6, Math.min(w / 6, 15))} fill="white">{object.label}</text></g>;
      })}
      {measurement && <g stroke="#aa7933" strokeWidth={3} fill="#aa7933"><line x1={measurement[0].x * width} y1={measurement[0].y * height} x2={measurement[1].x * width} y2={measurement[1].y * height} vectorEffect="non-scaling-stroke" />{measurement.map((p, i) => <circle key={i} cx={p.x * width} cy={p.y * height} r={width / 150} />)}</g>}
      {drawing && start && cursor && (rectangle ? <rect x={Math.min(start.x, cursor.x) * width} y={Math.min(start.y, cursor.y) * height} width={Math.abs(start.x - cursor.x) * width} height={Math.abs(start.y - cursor.y) * height} fill="#0064e0" fillOpacity={0.12} stroke="#0064e0" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" /> : <line x1={start.x * width} y1={start.y * height} x2={cursor.x * width} y2={cursor.y * height} stroke="#0064e0" strokeWidth={3} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />)}
    </svg></div><div className="ps-zoom" role="group" aria-label="Plan zoom"><button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} aria-label="Zoom in">+</button><button onClick={() => setZoom(1)}>Fit</button></div>
  </div>;
}
