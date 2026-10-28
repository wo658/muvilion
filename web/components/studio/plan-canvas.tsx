"use client";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "../ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { deriveWalls } from "@/lib/plans/walls";
import { VENUE_COLORS } from "@/lib/plans/overview";
import type { PlanDocument } from "@/lib/plans/schema";
import { TOKENS } from "@/lib/ui/tokens";
type Point = {
    x: number;
    y: number;
};
export function PlanCanvas({ document, selected, onSelect, sourceOnly, showOriginal = false, showSourceFallback = true, drawing, onDraw, measurement, rectangle, floorDraft, onBoundaryPoint, onEntrancePoint }: {
    onEntrancePoint?: (point: Point) => void;
    floorDraft?: Point[] | null;
    onBoundaryPoint?: (point: Point) => void;
    document: PlanDocument;
    selected: string | null;
    onSelect: (id: string | null) => void;
    sourceOnly: boolean;
    showOriginal?: boolean;
    showSourceFallback?: boolean;
    drawing: boolean;
    onDraw: (a: Point, b: Point) => void;
    measurement: [
        Point,
        Point
    ] | null;
    rectangle: boolean;
}) {
  const { t } = useI18n();
    const [zoom, setZoom] = useState(1);
    const [start, setStart] = useState<Point | null>(null);
    const [cursor, setCursor] = useState<Point | null>(null);
    const width = document.source.width, height = document.source.height;
    const viewport = useRef<HTMLDivElement>(null);
    const [viewportSize, setViewportSize] = useState({ width: 600, height: 600 });
    useEffect(() => {
        const element = viewport.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const walls = useMemo(() => deriveWalls(document, { pairParallelEdges: true }), [document]);
    const reference = sourceOnly || showOriginal || drawing || Boolean(onBoundaryPoint) || (showSourceFallback && walls.length === 0);
    const scale = Math.max(.001, Math.min(viewportSize.width / width, viewportSize.height / height) * zoom);
    const labelSize = 11 / scale;
    const labelEdge = document.lines.reduce((edge, line) => line.kind === "wall" ? Math.max(edge, line.a.x * width, line.b.x * width) : edge, width * .6) + 14 / scale;
    const metresWidth = document.widthMeters ?? 10;
    const metresHeight = document.heightMeters ?? metresWidth * height / width;
    const paths = useMemo(() => {
        const paths = { unknown: "", wall: "", dimension: "" };
        for (const line of document.lines)
            paths[line.kind] += `M${line.a.x * width},${line.a.y * height}L${line.b.x * width},${line.b.y * height}`;
        return paths;
    }, [document.lines, width, height]);
    const selectedLine = document.lines.find(line => line.id === selected);
    const point = (event: React.PointerEvent<SVGSVGElement>): Point => {
        const svg = event.currentTarget;
        const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
        return { x: Math.max(0, Math.min(1, p.x / width)), y: Math.max(0, Math.min(1, p.y / height)) };
    };
    return <div className={`ps-plan ${drawing ? "is-drawing" : ""}`}>
    <div className="ps-plan-scroll" ref={viewport}><svg style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: `${zoom * 100}%`, minHeight: `${zoom * 100}%` }} viewBox={`0 0 ${width} ${height}`} aria-label={reference ? t("Floor plan with extracted geometry") : t("Space layout")} onPointerDown={(e) => {
            if (onEntrancePoint) { onEntrancePoint(point(e)); return; }
            if (onBoundaryPoint) {
                onBoundaryPoint(point(e));
                return;
            }
            if (!drawing) {
                if (sourceOnly)
                    return;
                const p = point(e), px = p.x * width, py = p.y * height;
                let best: string | null = null, distance = 8 / (e.currentTarget.getScreenCTM()?.a ?? 1);
                for (const line of document.lines) {
                    if (!reference && line.kind !== "wall") continue;
                    const ax = line.a.x * width, ay = line.a.y * height, dx = (line.b.x - line.a.x) * width, dy = (line.b.y - line.a.y) * height;
                    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
                    const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
                    if (d < distance) {
                        distance = d;
                        best = line.id;
                    }
                }
                onSelect(best);
                return;
            }
            const p = point(e);
            if (start) {
                if (Math.hypot(p.x - start.x, p.y - start.y) > 0.002)
                    onDraw(start, p);
                setStart(null);
            }
            else
                setStart(p);
        }} onPointerMove={(e) => { if (drawing && start)
        setCursor(point(e)); }} onKeyDown={(e) => { if (e.key === "Escape")
        setStart(null); }} tabIndex={drawing ? 0 : -1}>
      <rect width={width} height={height} fill={reference ? "var(--surface)" : "var(--bg)"}/>
      {!reference && document.floorBoundary && <polygon points={document.floorBoundary.map(p => `${p.x * width},${p.y * height}`).join(" ")} fill="var(--model)" stroke="var(--hairline-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke"/>}
      {reference && <image href={document.preview} width={width} height={height} opacity={sourceOnly ? 1 : 0.5}/>}
      {!sourceOnly && <g pointerEvents="none">
        {reference && <><path d={paths.unknown} fill="none" stroke="var(--faint)" strokeWidth={0.6} vectorEffect="non-scaling-stroke"/>
        <path d={paths.dimension} fill="none" stroke="var(--evidence-dimension)" strokeWidth={1.1} vectorEffect="non-scaling-stroke"/>
        <path d={paths.wall} fill="none" stroke="var(--evidence-wall)" strokeWidth={2.5} vectorEffect="non-scaling-stroke"/></>}
        {!reference && walls.map(wall => <line key={wall.id} x1={wall.a.x / metresWidth * width} y1={wall.a.y / metresHeight * height} x2={wall.b.x / metresWidth * width} y2={wall.b.y / metresHeight * height} stroke={VENUE_COLORS.cap} strokeWidth={Math.max(3 / scale, wall.thickness / metresWidth * width)} strokeLinecap="butt"/>)}
        {selectedLine && <line x1={selectedLine.a.x * width} y1={selectedLine.a.y * height} x2={selectedLine.b.x * width} y2={selectedLine.b.y * height} stroke="var(--accent)" strokeWidth={4} vectorEffect="non-scaling-stroke"/>}
      </g>}
      {!sourceOnly && document.scaleConfirmed && document.widthMeters && document.heightMeters && (document.zones ?? []).map(zone => {
            const w = (zone.rotation === 90 ? zone.depth : zone.width) / document.widthMeters! * width, h = (zone.rotation === 90 ? zone.width : zone.depth) / document.heightMeters! * height;
            const fill = zone.purpose === "circulation" ? TOKENS.zoneCirculation : zone.purpose === "lounge" ? TOKENS.zoneLounge : zone.purpose === "stage" ? TOKENS.zoneStage : TOKENS.zoneOther;
            return <g key={zone.id} transform={`translate(${zone.x * width} ${zone.y * height})`} onPointerDown={e => { if (!drawing && !onBoundaryPoint && !onEntrancePoint) { e.stopPropagation(); onSelect(zone.id); } }} style={{ cursor: "pointer" }}>
              <title>{zone.label}</title><rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.min(5 / scale, w / 10, h / 10)} fill={fill} fillOpacity={reference ? .25 : .85} stroke={selected === zone.id ? "var(--accent)" : "var(--hairline-strong)"} strokeWidth={selected === zone.id ? 2 : 1} strokeDasharray={zone.purpose === "circulation" ? "5 4" : undefined} vectorEffect="non-scaling-stroke"/>
              {(zone.purpose !== "circulation" || selected === zone.id) && (w * scale > 120 && h * scale > 35 ? <text x={-w / 2 + 5 / scale} y={-h / 2 + 14 / scale} fontSize={labelSize} fill="var(--muted)" paintOrder="stroke" stroke={fill} strokeWidth={3 / scale}>{zone.label.length > Math.floor(w * scale / 7) ? `${zone.label.slice(0, Math.max(4, Math.floor(w * scale / 7) - 1))}…` : zone.label}</text> : <g pointerEvents="none"><line x1={w / 2} x2={labelEdge - zone.x * width - 5 / scale} stroke="var(--hairline-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke"/><text x={labelEdge - zone.x * width} dominantBaseline="central" fontSize={labelSize} fill="var(--muted)" paintOrder="stroke" stroke="var(--bg)" strokeWidth={3 / scale}>{zone.label}</text></g>)}
            </g>;
        })}
      {!sourceOnly && document.scaleConfirmed && document.widthMeters && document.heightMeters && (document.objects ?? []).map((object) => {
            const w = (object.rotation === 90 ? object.depth : object.width) / document.widthMeters! * width, h = (object.rotation === 90 ? object.width : object.depth) / document.heightMeters! * height;
            const partition = object.kind === "partition";
            const overhead = ["beam", "light", "hanging-sign", "canopy"].includes(object.kind);
            const plant = object.appearance === "plant";
            const fill = partition ? VENUE_COLORS.partition : plant ? TOKENS.objectPlant : object.kind === "stage" ? TOKENS.objectStage : object.kind === "booth" ? TOKENS.objectBooth : object.appearance === "sofa" ? TOKENS.objectSofa : TOKENS.objectOther;
            const labeled = selected === object.id || (!overhead && !partition && ["booth", "stage", "lounge"].includes(object.kind) && w * scale > 45 && h * scale > 24);
            return <g key={object.id} transform={`translate(${object.x * width} ${object.y * height})`} onPointerDown={e => { if (!drawing && !onBoundaryPoint && !onEntrancePoint) { e.stopPropagation(); onSelect(object.id); } }} style={{ cursor: "pointer" }}>
              <title>{object.label}{partition ? object.provenance === "ai" ? t(" · AI-proposed partition") : t(" · Planned partition") : ""}</title>
              <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={partition || overhead ? 0 : plant ? Math.min(w, h) / 2 : Math.min(w, h) * .12} fill={overhead ? "none" : fill} stroke={selected === object.id ? "var(--accent)" : partition ? "var(--venue-partition-edge)" : "var(--edge)"} strokeDasharray={overhead ? "3 4" : undefined} strokeOpacity={overhead && selected !== object.id ? .35 : 1} strokeWidth={selected === object.id ? 3 : 1} vectorEffect="non-scaling-stroke"/>
              {!overhead && !partition && !plant && (object.appearance === "sofa" || object.appearance === "seat" || object.kind === "booth") && <path d={`M${-w*.4},${h*.35}V${-h*.35}H${w*.4}V${h*.35}`} fill="none" stroke="var(--edge)" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
              {labeled && <text textAnchor="middle" dominantBaseline="central" fontSize={labelSize} fill={object.kind === "stage" ? "var(--surface)" : "var(--ink-soft)"} paintOrder="stroke" stroke={fill} strokeWidth={2 / scale} pointerEvents="none">{selected === object.id ? object.label : object.label.length > Math.floor(w * scale / 7) ? `${object.label.slice(0, Math.max(3, Math.floor(w * scale / 7)-1))}…` : object.label}</text>}
            </g>;
        })}
      {(floorDraft || reference && document.floorBoundary) && <g pointerEvents="none"><polygon points={(floorDraft ?? document.floorBoundary ?? []).map(p => `${p.x * width},${p.y * height}`).join(" ")} fill="var(--accent)" fillOpacity={0.06} stroke="var(--accent)" strokeWidth={2} strokeDasharray={floorDraft ? "6 4" : undefined} vectorEffect="non-scaling-stroke"/>{floorDraft?.map((p, i) => <circle key={i} cx={p.x * width} cy={p.y * height} r={4} fill="var(--accent)"/>)}</g>}
      {(document.entrances ?? []).map(entrance => <g key={entrance.id} transform={`translate(${entrance.x * width} ${entrance.y * height})`} onPointerDown={event => { if (!drawing && !onBoundaryPoint && !onEntrancePoint) { event.stopPropagation(); onSelect(entrance.id); } }} style={{ cursor: "pointer" }}>
        <circle r={6 / scale} fill="var(--venue-entrance)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke"/>
        <text y={-12 / scale} textAnchor="middle" fill="var(--venue-entrance)" stroke="var(--surface)" strokeWidth={3 / scale} paintOrder="stroke" fontSize={labelSize}>{entrance.label}</text>
      </g>)}
      {measurement && <g stroke="var(--evidence-dimension)" strokeWidth={3} fill="var(--evidence-dimension)"><line x1={measurement[0].x * width} y1={measurement[0].y * height} x2={measurement[1].x * width} y2={measurement[1].y * height} vectorEffect="non-scaling-stroke"/>{measurement.map((p, i) => <circle key={i} cx={p.x * width} cy={p.y * height} r={width / 150}/>)}</g>}
      {drawing && start && cursor && (rectangle ? <rect x={Math.min(start.x, cursor.x) * width} y={Math.min(start.y, cursor.y) * height} width={Math.abs(start.x - cursor.x) * width} height={Math.abs(start.y - cursor.y) * height} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/> : <line x1={start.x * width} y1={start.y * height} x2={cursor.x * width} y2={cursor.y * height} stroke="var(--accent)" strokeWidth={3} strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>)}
    </svg></div><div className="ps-zoom" role="group" aria-label={t("Plan zoom")}><Button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label={t("Zoom out")}>−</Button><span>{Math.round(zoom * 100)}%</span><Button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} aria-label={t("Zoom in")}>+</Button><Button onClick={() => setZoom(1)}>{t("Fit")}</Button></div>
  </div>;
}
