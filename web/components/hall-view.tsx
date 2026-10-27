"use client";

/**
 * SVG hall renderer. Hall coordinates are meters with origin bottom-left and y up;
 * SVG is y-down, so every y is flipped with `fy` (and rect origins use y + h).
 */
import type { BoothMove } from "@/lib/agent/events";
import type { BoothSpec, DensityGrid, Hotspot, Layout, Rect, Venue } from "@/lib/engine/contract";
import { boothRect, center, doorClearanceRect } from "@/lib/geometry";

type Props = {
  venue: Venue;
  specs: BoothSpec[];
  layout?: Layout;
  grid?: DensityGrid;
  hotspots?: Hotspot[];
  moves?: BoothMove[];
  keepOut?: Rect[];
  popularThreshold?: number;
  doorClearance?: number;
  showHeatmap?: boolean;
  /** Density mapped to full heat color. */
  heatMax?: number;
};

const DOOR_COLOR = { entrance: "var(--door-entrance)", exit: "var(--door-exit)", emergency: "var(--door-emergency)" } as const;

function heatColor(v: number, max: number): string | null {
  const t = Math.min(1, v / max);
  if (t < 0.12) return null;
  // yellow → orange → red, more opaque as density rises
  const hue = 55 - 55 * t;
  return `hsl(${hue} 95% 50% / ${0.18 + 0.6 * t})`;
}

export function HallView({
  venue,
  specs,
  layout,
  grid,
  hotspots = [],
  moves = [],
  keepOut = [],
  popularThreshold = 0.8,
  doorClearance = 0,
  showHeatmap = true,
  heatMax = 4,
}: Props) {
  const W = venue.width;
  const H = venue.height;
  const pad = 1.5;
  const fy = (y: number, h = 0) => H - y - h;
  const pop = new Map(specs.map((s) => [s.id, s]));
  const moved = new Map(moves.map((m) => [m.booth_id, m]));

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label={`Floor plan of ${venue.name}`}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--move)" />
        </marker>
        <pattern id="hatch" width="1" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1" stroke="var(--keepout)" strokeWidth="0.25" />
        </pattern>
      </defs>

      {/* floor */}
      <rect x={0} y={0} width={W} height={H} fill="var(--floor)" stroke="var(--wall)" strokeWidth={0.35} />

      {/* 5 m grid ticks */}
      {Array.from({ length: Math.floor(W / 5) + 1 }, (_, i) => (
        <text key={`gx${i}`} x={i * 5} y={H + 1.2} fontSize={0.8} textAnchor="middle" fill="var(--muted)">
          {i * 5}
        </text>
      ))}
      {Array.from({ length: Math.floor(H / 5) + 1 }, (_, j) => (
        <text key={`gy${j}`} x={-0.5} y={fy(j * 5) + 0.3} fontSize={0.8} textAnchor="end" fill="var(--muted)">
          {j * 5}
        </text>
      ))}

      {/* density heatmap (row 0 = y 0..cell, upward) */}
      {showHeatmap &&
        grid &&
        grid.peak.map((v, k) => {
          const c = heatColor(v, heatMax);
          if (!c) return null;
          const i = k % grid.cols;
          const j = Math.floor(k / grid.cols);
          const x = i * grid.cell;
          const y = j * grid.cell;
          const w = Math.min(grid.cell, W - x);
          const h = Math.min(grid.cell, H - y);
          if (w <= 0 || h <= 0) return null;
          return <rect key={k} x={x} y={fy(y, h)} width={w} height={h} fill={c} />;
        })}

      {/* door clearance zones */}
      {doorClearance > 0 &&
        venue.doors.map((d) => {
          const r = doorClearanceRect(d, venue, doorClearance);
          return r ? (
            <rect key={`dc-${d.id}`} x={r.x} y={fy(r.y, r.h)} width={r.w} height={r.h} fill={DOOR_COLOR[d.kind]} opacity={0.07} />
          ) : null;
        })}

      {/* keep-out areas */}
      {keepOut.map((r, i) => (
        <rect key={`ko-${i}`} x={r.x} y={fy(r.y, r.h)} width={r.w} height={r.h} fill="url(#hatch)" stroke="var(--keepout)" strokeWidth={0.12} strokeDasharray="0.4 0.3" />
      ))}

      {/* obstacles */}
      {venue.obstacles.map((o) => (
        <g key={o.id}>
          <polygon points={o.polygon.map((p) => `${p.x},${fy(p.y)}`).join(" ")} fill="var(--obstacle)" stroke="var(--wall)" strokeWidth={0.1} />
          {o.kind !== "column" && (
            <text
              x={o.polygon.reduce((s, p) => s + p.x, 0) / o.polygon.length}
              y={fy(o.polygon.reduce((s, p) => s + p.y, 0) / o.polygon.length) + 0.3}
              fontSize={0.8}
              textAnchor="middle"
              fill="var(--obstacle-text)"
            >
              {o.id}
            </text>
          )}
        </g>
      ))}

      {/* previous positions of moved booths */}
      {layout?.booths
        .filter((b) => moved.has(b.id))
        .map((b) => {
          const m = moved.get(b.id)!;
          const r = boothRect({ ...b, x: m.from.x, y: m.from.y });
          return (
            <rect key={`ghost-${b.id}`} x={r.x} y={fy(r.y, r.h)} width={r.w} height={r.h} fill="none" stroke="var(--move)" strokeWidth={0.12} strokeDasharray="0.35 0.25" opacity={0.8} />
          );
        })}

      {/* booths */}
      {layout?.booths.map((b) => {
        const r = boothRect(b);
        const spec = pop.get(b.id);
        const p = spec?.popularity ?? 0.5;
        const isMoved = moved.has(b.id);
        const popular = p >= popularThreshold;
        return (
          <g key={b.id}>
            <title>{`${spec?.label ?? b.id} — popularity ${p}${isMoved ? " (moved)" : ""}`}</title>
            <rect
              x={r.x}
              y={fy(r.y, r.h)}
              width={r.w}
              height={r.h}
              rx={0.15}
              fill={`hsl(32 92% ${93 - p * 48}%)`}
              stroke={isMoved ? "var(--move)" : popular ? "var(--popular)" : "var(--booth-stroke)"}
              strokeWidth={isMoved ? 0.28 : popular ? 0.2 : 0.08}
            />
            <text x={r.x + r.w / 2} y={fy(r.y + r.h / 2) + 0.35} fontSize={Math.min(1, r.w / 3)} textAnchor="middle" fontWeight={popular ? 700 : 500} fill={p > 0.7 ? "#fff" : "var(--booth-text)"}>
              {b.id}
            </text>
          </g>
        );
      })}

      {/* hotspot outlines */}
      {hotspots.map((h, i) => (
        <g key={`hs-${i}`}>
          <rect x={h.zone.x} y={fy(h.zone.y, h.zone.h)} width={h.zone.w} height={h.zone.h} fill="none" stroke="var(--hotspot)" strokeWidth={0.22} strokeDasharray="0.6 0.3" />
          <text x={h.zone.x + 0.2} y={fy(h.zone.y + h.zone.h) - 0.3} fontSize={0.85} fontWeight={700} fill="var(--hotspot)">
            #{i} {h.peak_density.toFixed(2)}
          </text>
        </g>
      ))}

      {/* move arrows */}
      {layout?.booths
        .filter((b) => moved.has(b.id))
        .map((b) => {
          const m = moved.get(b.id)!;
          const a = center(boothRect({ ...b, x: m.from.x, y: m.from.y }));
          const z = center(boothRect(b));
          return (
            <line key={`mv-${b.id}`} x1={a.x} y1={fy(a.y)} x2={z.x} y2={fy(z.y)} stroke="var(--move)" strokeWidth={0.2} markerEnd="url(#arrow)" />
          );
        })}

      {/* doors */}
      {venue.doors.map((d) => (
        <g key={d.id}>
          <line x1={d.a.x} y1={fy(d.a.y)} x2={d.b.x} y2={fy(d.b.y)} stroke={DOOR_COLOR[d.kind]} strokeWidth={0.8} strokeLinecap="butt" />
          {/* labels sit just inside the hall so they never collide with the axis ticks */}
          <text
            x={(d.a.x + d.b.x) / 2 + (d.a.x === d.b.x ? (d.a.x === 0 ? 0.7 : -0.7) : 0)}
            y={fy((d.a.y + d.b.y) / 2) + (d.a.y === d.b.y ? (d.a.y === 0 ? -0.7 : 1.4) : 0.3)}
            fontSize={0.8}
            textAnchor={d.a.x === d.b.x ? (d.a.x === 0 ? "start" : "end") : "middle"}
            fill={DOOR_COLOR[d.kind]}
            fontWeight={600}
          >
            {d.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function HallLegend() {
  const item = (swatch: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
  const line = (c: string) => <span className="inline-block h-1 w-4 rounded" style={{ background: c }} />;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
      {item(line("var(--door-entrance)"), "Entrance")}
      {item(line("var(--door-exit)"), "Exit")}
      {item(line("var(--door-emergency)"), "Emergency")}
      {item(<span className="inline-block h-3 w-3 rounded-sm" style={{ background: "hsl(32 92% 50%)" }} />, "Booth (darker = more popular)")}
      {item(<span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed" style={{ borderColor: "var(--hotspot)" }} />, "Hotspot")}
      {item(<span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: "var(--move)" }} />, "Moved booth")}
      {item(<span className="inline-block h-3 w-6 rounded-sm" style={{ background: "linear-gradient(90deg, hsl(55 95% 50% / .3), hsl(0 95% 50% / .8))" }} />, "Peak density 0→4 p/m²")}
    </div>
  );
}
