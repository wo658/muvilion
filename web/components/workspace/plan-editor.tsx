"use client";

import { useState, type MouseEvent } from "react";
import { boxFromPoints, calibratedSize, doorOnBoundary, type PlanPoint, type ProjectDraft } from "@/lib/projects/model";
import { Field, Icon } from "./primitives";

type Tool = "boundary" | "scale" | "obstacle" | "keepout" | "entrance" | "exit";
const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "boundary", label: "부지 경계", icon: "box" }, { id: "scale", label: "거리 측정", icon: "ruler" },
  { id: "obstacle", label: "장애물", icon: "box" }, { id: "keepout", label: "설치 금지", icon: "box" },
  { id: "entrance", label: "입구", icon: "door" }, { id: "exit", label: "출구", icon: "door" },
];
const COLORS = { boundary: "#1f5f5b", scale: "#b9772c", obstacle: "#6b6a65", keepout: "#a1473a", entrance: "#267e64", exit: "#466ba4" };

export function PlanEditor({ draft, onChange }: { draft: ProjectDraft; onChange: (next: ProjectDraft) => void }) {
  const [tool, setTool] = useState<Tool>("boundary");
  const [first, setFirst] = useState<PlanPoint | null>(null);
  const [hover, setHover] = useState<PlanPoint | null>(null);
  const [measure, setMeasure] = useState<[PlanPoint, PlanPoint] | null>(null);
  const [distance, setDistance] = useState(10);
  const [message, setMessage] = useState("");
  const pw = draft.source?.width ?? 1200, ph = draft.source?.height ?? 800;
  const r = draft.boundary;
  const position = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  };
  const add = (p: PlanPoint) => {
    if (!first) { setFirst(p); setMessage(""); return; }
    const a = first; setFirst(null); setHover(null);
    if (tool === "scale") { setMeasure([a, p]); return; }
    if (tool === "entrance" || tool === "exit") {
      const [start, end] = doorOnBoundary(a, p, r);
      if (Math.hypot(start.x - end.x, start.y - end.y) < 0.005) { setMessage("같은 외곽선을 따라 출입구 양 끝을 선택해 주세요."); return; }
      onChange({ ...draft, spaceConfirmed: false, marks: [...draft.marks, { id: crypto.randomUUID(), kind: tool, a: start, b: end }] }); return;
    }
    const box = boxFromPoints(a, p);
    if (box.w < 0.005 || box.h < 0.005) { setMessage("너비와 높이가 있는 영역을 선택해 주세요."); return; }
    if (tool === "boundary") {
      if (draft.marks.length && !window.confirm("부지 경계를 바꾸면 기존 출입구와 장애물 표시가 초기화됩니다. 계속할까요?")) return;
      onChange({ ...draft, boundary: box, scaleConfirmed: false, spaceConfirmed: false, marks: [] }); setMeasure(null); return;
    }
    if (box.x < r.x || box.y < r.y || box.x + box.w > r.x + r.w + 0.00001 || box.y + box.h > r.y + r.h + 0.00001) {
      setMessage("장애물과 설치 금지 구역은 부지 경계 안에 표시해 주세요."); return;
    }
    onChange({ ...draft, spaceConfirmed: false, marks: [...draft.marks, { id: crypto.randomUUID(), kind: tool, a, b: p }] });
  };
  const shape = (kind: Tool, a: PlanPoint, b: PlanPoint, id: string, pending = false) => {
    const color = COLORS[kind];
    if (kind === "entrance" || kind === "exit" || kind === "scale") return <g key={id}><line x1={a.x * pw} y1={a.y * ph} x2={b.x * pw} y2={b.y * ph} stroke={color} strokeWidth={kind === "scale" ? 2 : 7} vectorEffect="non-scaling-stroke" strokeDasharray={pending ? "5 3" : undefined} /><circle cx={a.x * pw} cy={a.y * ph} r={pw / 180} fill={color} /><circle cx={b.x * pw} cy={b.y * ph} r={pw / 180} fill={color} /></g>;
    const box = boxFromPoints(a, b);
    return <rect key={id} x={box.x * pw} y={box.y * ph} width={box.w * pw} height={box.h * ph} fill={kind === "boundary" ? "none" : color} fillOpacity="0.2" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray={pending || kind === "keepout" ? "6 4" : undefined} />;
  };
  const applyScale = () => {
    if (!measure) return;
    try {
      const size = calibratedSize(draft, ...measure, distance);
      if (size.width <= 0 || size.height <= 0 || size.width > 1000 || size.height > 1000) throw new Error("부지 크기는 가로·세로 각각 0m 초과, 1,000m 이하여야 합니다.");
      onChange({ ...draft, ...size, scaleConfirmed: true, spaceConfirmed: false }); setMessage("실제 거리를 기준으로 축척을 맞췄습니다.");
    } catch (error) { setMessage((error as Error).message); }
  };
  return <div className="ws-plan-editor">
    <div className="ws-plan-main">
      <div className="ws-tools" aria-label="공간 표시 도구">{TOOLS.map((t) => <button key={t.id} aria-pressed={tool === t.id} className={tool === t.id ? "active" : ""} onClick={() => { setTool(t.id); setFirst(null); setHover(null); setMessage(""); }}><Icon name={t.icon} />{t.label}</button>)}</div>
      <div className="ws-plan-tip"><span className="ws-step-dot">{first ? "2" : "1"}</span>{first ? "반대쪽 끝점을 클릭하세요. Esc로 취소할 수 있어요." : tool === "scale" ? "실제 길이를 아는 구간의 양 끝점을 클릭하세요." : tool === "entrance" || tool === "exit" ? "외곽선에 있는 출입구의 양 끝점을 클릭하세요." : "영역의 왼쪽 위와 오른쪽 아래를 차례로 클릭하세요."}</div>
      <div className="ws-drawing">
        <svg viewBox={`0 0 ${pw} ${ph}`} style={{ aspectRatio: `${pw}/${ph}` }} role="img" aria-label="도면 공간 편집기. 도구를 선택하고 두 점을 클릭하여 영역을 표시합니다." tabIndex={0} onKeyDown={(e) => { if (e.key === "Escape") { setFirst(null); setHover(null); } }} onClick={(e) => add(position(e))} onMouseMove={(e) => { if (first) setHover(position(e)); }}>
          <defs><pattern id="plan-grid" width={pw / 30} height={pw / 30} patternUnits="userSpaceOnUse"><path d={`M ${pw / 30} 0 L 0 0 0 ${pw / 30}`} fill="none" stroke="#e0ddd4" strokeWidth="1" /></pattern></defs>
          <rect width={pw} height={ph} fill="white" />
          {draft.source ? <image href={draft.source.preview} width={pw} height={ph} opacity="0.65" /> : <rect width={pw} height={ph} fill="url(#plan-grid)" />}
          {shape("boundary", { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, "boundary")}
          {draft.marks.map((m) => shape(m.kind, m.a, m.b, m.id))}
          {measure && shape("scale", measure[0], measure[1], "measure")}
          {first && hover && shape(tool, first, hover, "pending", true)}
          {first && <circle cx={first.x * pw} cy={first.y * ph} r={pw / 150} fill={COLORS[tool]} />}
        </svg>
      </div>
      <div className="ws-plan-caption"><span>{draft.source?.name ?? "빈 도면"}{draft.source && ` · ${draft.source.page}페이지`}</span><span className="num">{draft.width} × {draft.height} m</span></div>
      {message && <p className="ws-inline-message" role="status">{message}</p>}
    </div>
    <aside className="ws-plan-properties">
      <div className="ws-property-section"><h3>실제 치수</h3><p>알고 있는 가로·세로 길이를 입력하거나, 거리 측정 도구로 축척을 맞추세요.</p>
        <div className="ws-two-fields"><Field label="가로 (m)"><input type="number" min="0.1" max="1000" step="0.1" value={draft.width} onChange={(e) => onChange({ ...draft, width: Number(e.target.value), scaleConfirmed: false, spaceConfirmed: false })} /></Field><Field label="세로 (m)"><input type="number" min="0.1" max="1000" step="0.1" value={draft.height} onChange={(e) => onChange({ ...draft, height: Number(e.target.value), scaleConfirmed: false, spaceConfirmed: false })} /></Field></div>
        {measure && <div className="ws-measure"><Field label="선택한 구간의 실제 길이 (m)"><input type="number" min="0.1" step="0.1" value={distance} onChange={(e) => setDistance(Number(e.target.value))} /></Field><button className="ws-button ws-secondary" onClick={applyScale}>축척 적용</button></div>}
        <label className="ws-check"><input type="checkbox" checked={draft.scaleConfirmed} onChange={(e) => onChange({ ...draft, scaleConfirmed: e.target.checked, spaceConfirmed: false })} />실제 치수와 일치합니다</label>
      </div>
      <div className="ws-property-section"><h3>공간 요소 <span>{draft.marks.length}</span></h3>{draft.marks.length === 0 ? <p>입구와 출구를 먼저 표시하고, 기둥·고정시설과 설치 금지 구역을 추가하세요.</p> : <ul className="ws-mark-list">{draft.marks.map((m, i) => <li key={m.id}><span style={{ background: COLORS[m.kind] }} /><span>{TOOLS.find((t) => t.id === m.kind)?.label} {i + 1}</span><button className="ws-icon-button" aria-label={`${TOOLS.find((t) => t.id === m.kind)?.label} ${i + 1} 삭제`} onClick={() => onChange({ ...draft, marks: draft.marks.filter((x) => x.id !== m.id), spaceConfirmed: false })}><Icon name="trash" width="15" height="15" /></button></li>)}</ul>}</div>
      <div className="ws-property-section ws-soft-note"><Icon name="box" /><p>현재는 직사각형 단층 부지를 지원합니다. 경계 밖 공간은 분석에서 제외됩니다.</p></div>
      <label className="ws-check ws-final-check"><input type="checkbox" checked={draft.spaceConfirmed} onChange={(e) => onChange({ ...draft, spaceConfirmed: e.target.checked })} />도면과 경계·출입구·장애물 표시를 확인했습니다</label>
    </aside>
  </div>;
}
