"use client";

/**
 * 2D site plan in an architectural drawing style: hairline walls (or a fence outdoors) with door
 * gaps, hatched obstacles, zones with subtle fills, white booth outlines with labels and kind
 * marks, crowding as a soft blurred gradient. Hall coordinates are meters with origin bottom-left
 * and y up; SVG is y-down, so every y is flipped with `fy` (rect origins use y + h).
 */
import { useId } from "react";
import type { BoothMove } from "@/lib/agent/events";
import type { BoothSpec, DensityGrid, Hotspot, Obstacle, Point, Rect, Venue, Zone } from "@/lib/engine/contract";
import { boothRect, center, doorClearanceRect, doorMid, polygonBBox } from "@/lib/geometry";
import { HEAT_GRADIENT, heatCss, HEAT_MAX } from "@/lib/ui/heat";
import type { AnimatedBooth } from "@/lib/ui/placement";
import { inwardNormal, wallSegments } from "@/lib/ui/site";
import { Swatch } from "./ui";

type Props = {
  venue: Venue;
  specs: BoothSpec[];
  booths?: AnimatedBooth[];
  grid?: DensityGrid;
  hotspots?: Hotspot[];
  moves?: BoothMove[];
  keepOut?: Rect[];
  fixed?: Record<string, Point>;
  doorClearance?: number;
  showHeatmap?: boolean;
  heatMax?: number;
};

const ZONE_FILL: Record<Zone["kind"], string> = {
  lawn: "var(--lawn)",
  paved: "var(--paving)",
  fire_lane: "var(--fire-lane)",
  stage_front: "var(--stage-front)",
  queue_area: "var(--queue-area)",
};

export function HallView({
  venue,
  specs,
  booths,
  grid,
  hotspots = [],
  moves = [],
  keepOut = [],
  fixed = {},
  doorClearance = 0,
  showHeatmap = true,
  heatMax = HEAT_MAX,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const W = venue.width;
  const H = venue.height;
  const pad = 2.6;
  const fy = (y: number, h = 0) => H - y - h;
  const spec = new Map(specs.map((s) => [s.id, s]));
  const moved = new Map(moves.map((m) => [m.booth_id, m]));
  const outdoor = venue.setting === "outdoor";
  const pts = (poly: Point[]) => poly.map((p) => `${p.x},${fy(p.y)}`).join(" ");
  const id = (s: string) => `${s}-${uid}`;
  const label = Math.max(0.62, Math.min(0.85, W / 60));

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad + 1.2}`}
      className="h-auto max-h-[calc(100dvh-15rem)] w-full select-none"
      role="img"
      aria-label={`Site plan of ${venue.name}`}
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <defs>
        <pattern id={id("hatch")} width="0.7" height="0.7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.7" stroke="var(--ink-soft)" strokeWidth="0.06" />
        </pattern>
        <pattern id={id("fire")} width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="1.2" stroke="var(--fire-lane-hatch)" strokeWidth="0.12" />
        </pattern>
        <pattern id={id("light")} width="1" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1" stroke="var(--hairline-strong)" strokeWidth="0.07" />
        </pattern>
        <pattern id={id("keep")} width="0.9" height="0.9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.9" stroke="var(--accent)" strokeWidth="0.07" opacity="0.55" />
        </pattern>
        <marker id={id("arrow")} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
        <filter id={id("blur")} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={(grid?.cell ?? 2) * 0.6} />
        </filter>
        <clipPath id={id("site")}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>

      {/* ground */}
      <rect x={0} y={0} width={W} height={H} fill={outdoor ? "var(--floor-outdoor)" : "var(--floor-indoor)"} />
      {venue.zones.map((z) => (
        <g key={z.id}>
          <polygon points={pts(z.polygon)} fill={ZONE_FILL[z.kind]} />
          {z.kind === "fire_lane" && <polygon points={pts(z.polygon)} fill={`url(#${id("fire")})`} />}
          {z.kind === "stage_front" && <polygon points={pts(z.polygon)} fill={`url(#${id("light")})`} />}
          {!z.buildable && (
            <text
              x={center(polygonBBox(z.polygon)).x}
              y={fy(center(polygonBBox(z.polygon)).y) + 0.25}
              fontSize={0.7}
              textAnchor="middle"
              fill="var(--muted)"
              letterSpacing={0.12}
            >
              {z.kind === "fire_lane" ? "FIRE LANE · KEEP CLEAR" : z.kind.replace(/_/g, " ").toUpperCase()}
            </text>
          )}
        </g>
      ))}

      {/* 5 m grid */}
      <g stroke="var(--ink)" strokeWidth={0.03} opacity={0.12}>
        {Array.from({ length: Math.floor(W / 5) - (W % 5 === 0 ? 1 : 0) }, (_, i) => (
          <line key={`gx${i}`} x1={(i + 1) * 5} y1={0} x2={(i + 1) * 5} y2={H} />
        ))}
        {Array.from({ length: Math.floor(H / 5) - (H % 5 === 0 ? 1 : 0) }, (_, j) => (
          <line key={`gy${j}`} x1={0} y1={fy((j + 1) * 5)} x2={W} y2={fy((j + 1) * 5)} />
        ))}
      </g>
      {Array.from({ length: Math.floor(W / 10) + 1 }, (_, i) => (
        <text key={`tx${i}`} x={i * 10} y={H + 1.25} fontSize={0.62} textAnchor="middle" fill="var(--faint)" className="num">
          {i * 10}
        </text>
      ))}
      {Array.from({ length: Math.floor(H / 10) + 1 }, (_, j) => (
        <text key={`ty${j}`} x={-0.7} y={fy(j * 10) + 0.22} fontSize={0.62} textAnchor="end" fill="var(--faint)" className="num">
          {j * 10}
        </text>
      ))}

      {/* crowding: soft gradient */}
      {showHeatmap && grid && (
        <g clipPath={`url(#${id("site")})`}>
          <g filter={`url(#${id("blur")})`}>
            {grid.peak.map((v, k) => {
              const c = heatCss(v, heatMax);
              if (!c) return null;
              const x = (k % grid.cols) * grid.cell;
              const y = Math.floor(k / grid.cols) * grid.cell;
              return <rect key={k} x={x} y={fy(y, grid.cell)} width={grid.cell + 0.02} height={grid.cell + 0.02} fill={c} />;
            })}
          </g>
        </g>
      )}

      {/* door clearances */}
      {doorClearance > 0 &&
        venue.doors.map((d) => {
          const r = doorClearanceRect(d, venue, doorClearance);
          return r ? (
            <rect key={`dc-${d.id}`} x={r.x} y={fy(r.y, r.h)} width={r.w} height={r.h} fill="none" stroke="var(--faint)" strokeWidth={0.05} strokeDasharray="0.3 0.25" />
          ) : null;
        })}

      {/* keep-outs (agent-set) */}
      {keepOut.map((r, i) => (
        <rect key={`ko-${i}`} x={r.x} y={fy(r.y, r.h)} width={r.w} height={r.h} fill={`url(#${id("keep")})`} stroke="var(--accent)" strokeWidth={0.07} strokeDasharray="0.45 0.3" />
      ))}

      {venue.obstacles.map((o) => (
        <ObstaclePlan key={o.id} o={o} fy={fy} hatch={`url(#${id("hatch")})`} />
      ))}

      {/* boundary */}
      {wallSegments(venue).map((s, i) =>
        outdoor ? (
          <line key={i} x1={s.a[0]} y1={fy(s.a[1])} x2={s.b[0]} y2={fy(s.b[1])} stroke="var(--ink-soft)" strokeWidth={0.09} strokeDasharray="1.1 0.25" />
        ) : (
          <line key={i} x1={s.a[0]} y1={fy(s.a[1])} x2={s.b[0]} y2={fy(s.b[1])} stroke="var(--ink)" strokeWidth={0.32} strokeLinecap="square" />
        ),
      )}

      {/* doors / gates */}
      {venue.doors.map((d) => {
        const m = doorMid(d);
        const n = inwardNormal(d, venue);
        const lx = m.x + n.x * 1.3;
        const ly = m.y + n.y * 1.3;
        return (
          <g key={d.id}>
            <line x1={d.a.x} y1={fy(d.a.y)} x2={d.b.x} y2={fy(d.b.y)} stroke={d.kind === "emergency" ? "var(--muted)" : "var(--ink)"} strokeWidth={0.08} strokeDasharray={d.kind === "emergency" ? "0.25 0.2" : undefined} />
            {d.kind === "entrance" && (
              <path
                d={`M ${m.x - n.y * 0.45 - n.x * 0.1} ${fy(m.y + n.x * 0.45 - n.y * 0.1)} L ${m.x + n.x * 0.7} ${fy(m.y + n.y * 0.7)} L ${m.x + n.y * 0.45 - n.x * 0.1} ${fy(m.y - n.x * 0.45 - n.y * 0.1)} Z`}
                fill="var(--ink)"
              />
            )}
            <text
              x={lx}
              y={fy(ly) + 0.25}
              fontSize={0.66}
              fontWeight={600}
              textAnchor={n.x > 0 ? "start" : n.x < 0 ? "end" : "middle"}
              fill={d.kind === "emergency" ? "var(--muted)" : "var(--ink-soft)"}
              letterSpacing={0.04}
            >
              {d.id}
            </text>
          </g>
        );
      })}

      {/* ghosts of moved booths */}
      {booths
        ?.filter((b) => moved.has(b.id))
        .map((b) => {
          const r = boothRect({ ...b, ...moved.get(b.id)!.from });
          return <rect key={`g-${b.id}`} x={r.x} y={fy(r.y, r.h)} width={r.w} height={r.h} fill="none" stroke="var(--accent)" strokeWidth={0.07} strokeDasharray="0.3 0.22" opacity={0.85} />;
        })}

      {/* booths */}
      {booths?.map((b) => {
        const r = boothRect(b);
        const s = spec.get(b.id);
        const isMoved = moved.has(b.id);
        const pinned = Boolean(fixed[b.id]);
        const kind = s?.kind ?? "booth";
        const c = center(r);
        return (
          <g key={b.id} opacity={b.alpha} style={{ transition: "opacity 120ms" }}>
            <title>{`${s?.label ?? b.id} · ${kind.replace("_", " ")} · popularity ${s?.popularity ?? "?"}${isMoved ? " · moved by the agent" : ""}${pinned ? " · pinned" : ""}`}</title>
            {kind === "kiosk" ? (
              <circle cx={c.x} cy={fy(c.y)} r={Math.min(r.w, r.h) / 2 - 0.05} fill="var(--model)" stroke={isMoved ? "var(--accent)" : "var(--model-edge)"} strokeWidth={isMoved ? 0.16 : 0.07} />
            ) : (
              <rect x={r.x} y={fy(r.y, r.h)} width={r.w} height={r.h} rx={0.12} fill="var(--model)" stroke={isMoved ? "var(--accent)" : "var(--model-edge)"} strokeWidth={isMoved ? 0.16 : 0.07} />
            )}
            {kind === "tent" && (
              <path d={`M ${r.x} ${fy(r.y)} L ${r.x + r.w} ${fy(r.y + r.h)} M ${r.x} ${fy(r.y + r.h)} L ${r.x + r.w} ${fy(r.y)}`} stroke="var(--hairline-strong)" strokeWidth={0.05} />
            )}
            {kind === "food_truck" && (
              <line
                x1={r.w >= r.h ? r.x + r.w - 1.4 : r.x}
                y1={r.w >= r.h ? fy(r.y) : fy(r.y + r.h - 1.4)}
                x2={r.w >= r.h ? r.x + r.w - 1.4 : r.x + r.w}
                y2={r.w >= r.h ? fy(r.y + r.h) : fy(r.y + r.h - 1.4)}
                stroke="var(--model-edge)"
                strokeWidth={0.05}
              />
            )}
            <text x={c.x - (kind === "food_truck" ? 0.6 : 0)} y={fy(c.y) + label * 0.35} fontSize={label} textAnchor="middle" fill={isMoved ? "var(--accent)" : "var(--ink)"} fontWeight={isMoved ? 650 : 500} className="num">
              {b.id}
            </text>
            {pinned && <circle cx={r.x + r.w - 0.35} cy={fy(r.y + r.h - 0.35)} r={0.18} fill="var(--accent)" />}
          </g>
        );
      })}

      {/* move arrows */}
      {booths
        ?.filter((b) => moved.has(b.id))
        .map((b) => {
          const a = center(boothRect({ ...b, ...moved.get(b.id)!.from }));
          const z = center(boothRect(b));
          return <line key={`mv-${b.id}`} x1={a.x} y1={fy(a.y)} x2={z.x} y2={fy(z.y)} stroke="var(--accent)" strokeWidth={0.12} markerEnd={`url(#${id("arrow")})`} />;
        })}

      {/* hotspots */}
      {hotspots.map((h, i) => (
        <g key={`hs-${i}`}>
          <rect x={h.zone.x} y={fy(h.zone.y, h.zone.h)} width={h.zone.w} height={h.zone.h} rx={0.4} fill="none" stroke="var(--heat-3)" strokeWidth={0.1} strokeDasharray="0.5 0.3" />
          <text x={h.zone.x + 0.25} y={fy(h.zone.y + h.zone.h) - 0.35} fontSize={0.66} fontWeight={600} fill="var(--heat-3)" className="num">
            #{i} · {h.peak_density.toFixed(2)} p/m²
          </text>
        </g>
      ))}

      {/* scale bar */}
      <g transform={`translate(${W - 10}, ${H + 1.9})`}>
        {[0, 1].map((k) => (
          <rect key={k} x={k * 5} y={0} width={5} height={0.28} fill={k ? "var(--surface)" : "var(--ink)"} stroke="var(--ink)" strokeWidth={0.04} />
        ))}
        <text x={0} y={1.1} fontSize={0.55} fill="var(--muted)" className="num">0</text>
        <text x={5} y={1.1} fontSize={0.55} fill="var(--muted)" textAnchor="middle" className="num">5</text>
        <text x={10} y={1.1} fontSize={0.55} fill="var(--muted)" textAnchor="end" className="num">10 m</text>
      </g>
    </svg>
  );
}

function ObstaclePlan({ o, fy, hatch }: { o: Obstacle; fy: (y: number, h?: number) => number; hatch: string }) {
  const b = polygonBBox(o.polygon);
  const c = center(b);
  const pts = o.polygon.map((p) => `${p.x},${fy(p.y)}`).join(" ");
  if (o.kind === "tree") {
    const r = Math.max(b.w, b.h) / 2;
    return (
      <g>
        <circle cx={c.x} cy={fy(c.y)} r={r * 1.9} fill="var(--foliage)" opacity={0.55} />
        <circle cx={c.x} cy={fy(c.y)} r={r * 1.9} fill="none" stroke="var(--lawn-deep)" strokeWidth={0.05} />
        <circle cx={c.x} cy={fy(c.y)} r={0.12} fill="var(--ink-soft)" />
      </g>
    );
  }
  if (o.kind === "fountain") {
    const r = Math.max(b.w, b.h) / 2;
    return (
      <g>
        <circle cx={c.x} cy={fy(c.y)} r={r} fill="var(--model)" stroke="var(--ink-soft)" strokeWidth={0.07} />
        <circle cx={c.x} cy={fy(c.y)} r={r * 0.78} fill="var(--water)" stroke="var(--ink-soft)" strokeWidth={0.04} />
        <text x={c.x} y={fy(c.y) + 0.22} fontSize={0.6} textAnchor="middle" fill="var(--muted)" letterSpacing={0.08}>FOUNTAIN</text>
      </g>
    );
  }
  if (o.kind === "column") return <polygon points={pts} fill="var(--ink-soft)" />;
  const name = o.kind === "other" || o.kind === "structure" ? o.id : o.kind.toUpperCase();
  const textW = name.length * 0.45 + 0.6;
  const inside = textW <= b.w;
  return (
    <g>
      <polygon points={pts} fill="var(--sunken)" />
      <polygon points={pts} fill={hatch} stroke="var(--ink-soft)" strokeWidth={0.07} />
      {inside && <rect x={c.x - textW / 2} y={fy(c.y) - 0.48} width={textW} height={0.86} fill="var(--surface)" opacity={0.92} />}
      <text x={c.x} y={inside ? fy(c.y) + 0.2 : fy(b.y + b.h) - 0.45} fontSize={0.58} textAnchor="middle" fill="var(--ink-soft)" letterSpacing={0.08} fontWeight={600}>
        {name}
      </text>
    </g>
  );
}

export function HallLegend({ outdoor = false }: { outdoor?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
      <Swatch label="Booth">
        <span className="inline-block h-2.5 w-3.5 rounded-[2px] border border-ink bg-white" />
      </Swatch>
      <Swatch label="Moved by agent">
        <span className="inline-block h-2.5 w-3.5 rounded-[2px] border-[1.5px] border-accent bg-white" />
      </Swatch>
      <Swatch label="Kept clear by agent">
        <span className="inline-block h-2.5 w-3.5 border border-dashed border-accent" style={{ background: "repeating-linear-gradient(45deg, transparent 0 2px, var(--accent-soft) 2px 4px)" }} />
      </Swatch>
      <Swatch label="Pinned">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      </Swatch>
      {outdoor && (
        <Swatch label="Fire lane">
          <span className="inline-block h-2.5 w-3.5" style={{ background: "repeating-linear-gradient(-45deg, var(--fire-lane) 0 2px, var(--fire-lane-hatch) 2px 3px)" }} />
        </Swatch>
      )}
      <Swatch label="Peak density 0 → 4 p/m²">
        <span className="inline-block h-2.5 w-10 rounded-full" style={{ background: HEAT_GRADIENT }} />
      </Swatch>
      <Swatch label="Hotspot">
        <span className="inline-block h-2.5 w-3.5 rounded-[3px] border border-dashed" style={{ borderColor: "var(--heat-3)" }} />
      </Swatch>
    </div>
  );
}
