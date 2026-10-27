"use client";

/** "How it works" explainer: the pipeline as a compact diagram plus the role table. */
import { useEffect, useRef } from "react";
import { ACTOR_ORDER, ACTORS, PIPELINE } from "@/lib/ui/actors";
import { ActorTag, Button } from "./ui";

export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="hiw-title"
      className="m-auto max-h-[min(92vh,900px)] w-[min(960px,calc(100vw-24px))] overflow-y-auto rounded-[8px] border border-hairline bg-surface p-0 text-ink shadow-[0_24px_60px_-20px_rgb(30_30_28/0.35)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-surface px-5 py-3">
        <div>
          <div className="eyebrow">How it works</div>
          <h2 id="hiw-title" className="text-[16px] font-semibold tracking-tight">
            Muse decides intent. The engines compute.
          </h2>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Close">
          Close
        </Button>
      </div>

      <div className="space-y-6 px-5 py-5">
        <Diagram />

        <div className="rounded-[6px] border border-accent/25 bg-accent-soft px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">The LLM never produces the numbers.</strong> Every booth coordinate comes from OR-Tools, every
          check from Shapely, every density and travel time from JuPedSim, and every table in the report from code. Muse chooses constraint values
          (aisle width, clearances, open areas, which booths sit by a gate), names likely causes and writes the prose — then code validates and
          translates its choices.
        </div>

        <div>
          <div className="eyebrow mb-2">Who does what</div>
          <table className="w-full text-[12.5px]">
            <tbody>
              {ACTOR_ORDER.map((id) => (
                <tr key={id} className="border-t border-hairline align-top first:border-t-0">
                  <td className="w-[7.5rem] py-2 pr-3">
                    <ActorTag id={id} />
                  </td>
                  <td className="py-2 pr-3 font-medium whitespace-nowrap text-ink max-sm:hidden">{ACTORS[id].name}</td>
                  <td className="py-2 leading-snug text-ink-soft">
                    <span className="font-medium text-ink sm:hidden">{ACTORS[id].name}. </span>
                    {ACTORS[id].role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 text-[12px] leading-relaxed text-ink-soft sm:grid-cols-2">
          <div>
            <div className="eyebrow mb-1">Empty site → placed layout</div>
            Muse reads the site (setting, gates, zones, obstacles, unknowns) and the booth list and writes a design brief — e.g. wider aisles
            outdoors, an open plaza inside the main gate, food trucks away from the gates, the ticket kiosk beside the main gate. Code turns that into
            constraints; the solver then reports its improving solutions, which the console animates from the first feasible arrangement to the
            final one.
          </div>
          <div>
            <div className="eyebrow mb-1">Identical conditions</div>
            Code locks the scenario (kind, agents, duration, seed), grid and compute cap for the whole run and checks every simulation against it,
            so the before/after comparison reflects layout changes only. Truncated simulations are never compared.
          </div>
        </div>
      </div>
    </dialog>
  );
}

function Diagram() {
  // seven nodes in one row on wide screens; the revision loop spans "Place booths" … "Analyze + revise"
  const W = 920;
  const nodeW = 112;
  const gap = (W - PIPELINE.length * nodeW) / (PIPELINE.length - 1);
  const x = (i: number) => i * (nodeW + gap);
  const y = 18;
  const h = 90;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <svg viewBox={`0 0 ${W} 182`} className="h-auto w-full min-w-[640px]" role="img" aria-label="Pipeline: input, Muse design brief, OR-Tools, Shapely, JuPedSim, Muse analysis and revision loop, report">
        <defs>
          <marker id="hiw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-soft)" />
          </marker>
          <marker id="hiw-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {PIPELINE.map((p, i) => {
          const a = ACTORS[p.actor];
          const llm = a.llm;
          return (
            <g key={p.label} transform={`translate(${x(i)}, ${y})`}>
              <rect width={nodeW} height={h} rx={6} fill={llm ? "var(--accent-soft)" : "var(--surface)"} stroke={llm ? "var(--accent)" : "var(--hairline-strong)"} />
              <rect x={10} y={10} width={a.tag.length * 6.4 + 12} height={16} rx={3} fill={llm ? "var(--accent)" : "var(--sunken)"} stroke={llm ? "none" : "var(--hairline-strong)"} />
              <text x={16} y={21.5} fontSize={9.5} fontWeight={650} letterSpacing={0.5} fill={llm ? "#fff" : "var(--ink-soft)"}>
                {a.tag.toUpperCase()}
              </text>
              <text x={10} y={44} fontSize={12.5} fontWeight={600} fill="var(--ink)">
                {p.label}
              </text>
              {wrap(p.note, 19).map((line, k) => (
                <text key={k} x={10} y={59 + k * 11} fontSize={9.5} fill="var(--muted)">
                  {line}
                </text>
              ))}
              {i < PIPELINE.length - 1 && <line x1={nodeW + 3} y1={h / 2} x2={nodeW + gap - 3} y2={h / 2} stroke="var(--ink-soft)" strokeWidth={1} markerEnd="url(#hiw-arrow)" />}
            </g>
          );
        })}
        {/* revision loop: from Analyze + revise back to Place booths */}
        <path
          d={`M ${x(5) + nodeW / 2} ${y + h + 2} V ${y + h + 34} H ${x(2) + nodeW / 2} V ${y + h + 6}`}
          fill="none"
          stroke="var(--accent)"
          strokeDasharray="4 3"
          markerEnd="url(#hiw-arrow-accent)"
        />
        <text x={(x(2) + x(5) + nodeW) / 2} y={y + h + 50} fontSize={10.5} textAnchor="middle" fill="var(--accent)" fontWeight={600}>
          revision loop · same scenario every time · stops on target, no improvement or max iterations
        </text>
      </svg>
    </div>
  );
}

function wrap(s: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}
