"use client";

import Image from "next/image";

import { useEffect, useRef, useState } from "react";
import { Draft, spaceErrors, STEP_LABELS, type ProjectDraft, type StoredProject } from "@/lib/projects/model";
import { readPlan } from "@/lib/projects/plan-file";
import { PlanEditor } from "./plan-editor";
import { Field, Icon } from "./primitives";

const HEADINGS = ["어떤 공간에서 시작할까요?", "도면을 실제 공간으로 바꿔보세요.", "어떤 행사를 준비하고 있나요?", "분석을 시작할 준비가 됐어요."];
const DESCRIPTIONS = ["장소의 도면을 올리거나, 크기를 아는 빈 공간에서 시작하세요.", "실제 치수를 맞추고, 배치에 필요한 공간 요소를 표시하세요.", "부스와 방문객 조건을 설정하면 같은 조건으로 배치안을 비교합니다.", "입력한 공간과 행사 조건을 마지막으로 확인하세요."];

export function ProjectWizard({ project, onChange, onAnalyze, onBackup, saveState }: {
  project: StoredProject; onChange: (draft: ProjectDraft, file?: Blob | null) => void; onAnalyze: () => void; onBackup: () => void; saveState: string;
}) {
  const d = project.draft;
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [confirmNewFile, setConfirmNewFile] = useState(false);
  const latest = useRef(d);
  const requestId = useRef(0);
  useEffect(() => { latest.current = d; }, [d]);
  useEffect(() => () => { requestId.current++; }, []);
  const upload = async (file: Blob, name: string, page = 1) => {
    const request = ++requestId.current;
    setLoading(true); setError("");
    try {
      const source = await readPlan(file, name, page);
      if (request !== requestId.current) return;
      onChange({ ...latest.current, source, boundary: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, scaleConfirmed: false, spaceConfirmed: false, marks: [] }, file);
    } catch (err) { if (request === requestId.current) setError(err instanceof Error ? err.message : "도면을 열 수 없습니다. 다른 파일로 시도해 주세요."); }
    finally { if (request === requestId.current) setLoading(false); }
  };
  const chooseFile = (file?: File) => {
    if (!file || loading) return;
    if ((d.marks.length || d.scaleConfirmed) && !window.confirm("도면을 교체하면 공간 표시와 축척이 초기화됩니다. 계속할까요?")) return;
    void upload(file, file.name);
  };
  const go = (step: number) => {
    if (loading) return;
    if (!d.name.trim()) { setError("프로젝트 이름을 입력해 주세요."); return; }
    if (step > 1) { const errors = spaceErrors(d); if (errors.length) { setError(errors.join(" ")); return; } }
    const parsed = Draft.safeParse(d);
    if (!parsed.success) { setError("입력값의 범위를 확인해 주세요. 비어 있거나 범위를 벗어난 항목이 있습니다."); return; }
    setError(""); onChange({ ...d, name: d.name.trim(), step });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const resetFile = () => {
    onChange({ ...d, source: null, marks: [], scaleConfirmed: false, spaceConfirmed: false }, null); setConfirmNewFile(false);
  };
  return <div className="ws-wizard">
    <aside className="ws-wizard-rail">
      <span className="ws-eyebrow">PROJECT SETUP</span>
      <nav aria-label="프로젝트 입력 단계">{STEP_LABELS.map((label, i) => <button key={label} className={`ws-step ${i === d.step ? "current" : ""} ${i < d.step ? "complete" : ""}`} onClick={() => go(i)} aria-current={i === d.step ? "step" : undefined}><span>{i < d.step ? <Icon name="check" width="15" /> : String(i + 1).padStart(2, "0")}</span><div>{label}<small>{["PDF · 이미지 · 빈 공간", "축척 · 출입구 · 장애물", "부스 · 통로 · 방문객", "조건 확인 · 배치 생성"][i]}</small></div></button>)}</nav>
      <div className="ws-rail-note"><Icon name="clock" /><h3>잠시 멈춰도 괜찮아요.</h3><p>입력한 내용은 이 브라우저에 자동 저장됩니다. 프로젝트 홈에서 이어갈 수 있어요.</p><button onClick={onBackup}>백업 내려받기 <Icon name="download" width="14" /></button></div>
    </aside>
    <section className="ws-wizard-body">
      <div className="ws-wizard-heading"><span className="ws-eyebrow">STEP {String(d.step + 1).padStart(2, "0")} / 04</span><h1>{HEADINGS[d.step]}</h1><p>{DESCRIPTIONS[d.step]}</p></div>
      {d.step === 0 && <div className="ws-upload-layout">
        <div>
          <Field label="프로젝트 이름"><input maxLength={120} value={d.name} onChange={(e) => onChange({ ...d, name: e.target.value })} placeholder="예: 가을 디자인 마켓" /></Field>
          <div className="ws-setting-options">{(["indoor", "outdoor"] as const).map((setting) => <button key={setting} className={d.setting === setting ? "selected" : ""} onClick={() => onChange({ ...d, setting })} aria-pressed={d.setting === setting}><Icon name={setting === "indoor" ? "grid" : "box"} /><span>{setting === "indoor" ? "실내 공간" : "야외 부지"}<small>{setting === "indoor" ? "전시장, 홀, 실내 행사장" : "광장, 공원, 야외 행사장"}</small></span><span className="ws-radio" /></button>)}</div>
          <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button className={`ws-dropzone ${dragging ? "dragging" : ""}`} disabled={loading} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}>
            <span className="ws-upload-icon"><Icon name="upload" width="27" height="27" /></span>
            <strong>{loading ? "도면을 준비하고 있어요…" : d.source ? "다른 도면으로 교체" : "도면을 여기에 놓아주세요"}</strong><span>{loading ? "파일을 브라우저에서 처리하고 있습니다" : "또는 클릭해서 파일 선택"}</span><small>PDF, PNG, JPG · 최대 20MB</small>
          </button>
          {d.source && <div className="ws-file-row"><Icon name="file" /><div><strong>{d.source.name}</strong><small>{d.source.pages}페이지 · 원본 파일도 함께 저장됩니다</small></div><button className="ws-icon-button" disabled={loading} aria-label="도면 제거" onClick={() => setConfirmNewFile(true)}><Icon name="close" /></button></div>}
          {confirmNewFile && <div className="ws-inline-message">도면과 공간 표시를 초기화할까요?<div className="flex gap-2 mt-2"><button className="ws-button ws-secondary" onClick={() => setConfirmNewFile(false)}>취소</button><button className="ws-button ws-secondary" onClick={resetFile}>도면 제거</button></div></div>}
          {d.source && d.source.pages > 1 && <Field label="사용할 도면 페이지" hint="페이지를 바꾸면 축척과 공간 표시가 초기화됩니다."><select disabled={loading} value={d.source.page} onChange={(e) => { if (project.file && (!(d.marks.length || d.scaleConfirmed) || window.confirm("페이지를 바꾸고 공간 표시를 초기화할까요?"))) void upload(project.file, d.source!.name, Number(e.target.value)); }}>{Array.from({ length: d.source.pages }, (_, i) => <option key={i} value={i + 1}>{i + 1}페이지</option>)}</select></Field>}
          <p className="ws-local-caption"><Icon name="user" width="15" />파일은 외부로 전송되지 않고 이 브라우저에 보관됩니다.</p>
        </div>
        <div className="ws-upload-preview">{d.source ? <><div className="ws-eyebrow">PLAN PREVIEW</div>{/* A local data URL, never a remote image. */}<Image src={d.source.preview} alt="선택한 도면 미리보기" width={d.source.width} height={d.source.height} unoptimized /><span>{d.source.name} · {d.source.page}페이지</span></> : <><div className="ws-eyebrow">FROM PLAN TO POSSIBILITY</div><Illustration /><h3>한 장의 도면에서,<br />더 나은 행사 공간으로.</h3><p>배치할 수 있는 공간을 정하고<br />부스와 사람의 흐름을 함께 계획하세요.</p></>}</div>
      </div>}
      {d.step === 1 && <PlanEditor draft={d} onChange={onChange} />}
      {d.step === 2 && <div className="ws-conditions-layout">
        <div className="ws-form-card"><h2><span>01</span> 부스와 동선</h2><p>같은 크기의 부스를 기준으로 첫 배치안을 만듭니다.</p><Field label="부스 수" hint="1–200개"><input type="number" min="1" max="200" value={d.booths} onChange={(e) => onChange({ ...d, booths: Number(e.target.value) })} /></Field><div className="ws-two-fields"><Field label="부스 너비 (m)"><input type="number" min="1" max="30" step="0.5" value={d.boothWidth} onChange={(e) => onChange({ ...d, boothWidth: Number(e.target.value) })} /></Field><Field label="부스 깊이 (m)"><input type="number" min="1" max="30" step="0.5" value={d.boothDepth} onChange={(e) => onChange({ ...d, boothDepth: Number(e.target.value) })} /></Field></div><Field label="최소 통로 폭 (m)" hint="배치에서 확보할 통로의 최소 너비"><input type="number" min="1.2" max="10" step="0.1" value={d.aisle} onChange={(e) => onChange({ ...d, aisle: Number(e.target.value) })} /></Field></div>
        <div className="ws-form-card"><h2><span>02</span> 방문객 시나리오</h2><p>배치안 간 비교에는 같은 방문객 조건을 사용합니다.</p><Field label="시뮬레이션 방문객 수" hint="1–3,000명 · 총 행사 방문객 수와 구분해 입력하세요"><input type="number" min="1" max="3000" value={d.scenario.agents} onChange={(e) => onChange({ ...d, scenario: { ...d.scenario, agents: Number(e.target.value) } })} /></Field><Field label="방문객 흐름"><select value={d.scenario.kind} onChange={(e) => onChange({ ...d, scenario: { ...d.scenario, kind: e.target.value as "entry" | "browse" | "exit" } })}><option value="browse">둘러보기 · 부스 방문과 체류</option><option value="entry">입장 · 입구에서 유입</option><option value="exit">퇴장 · 출구로 이동</option></select></Field><Field label="시뮬레이션 시간 (초)" hint="최대 3,600초"><input type="number" min="1" max="3600" value={d.scenario.duration_s} onChange={(e) => onChange({ ...d, scenario: { ...d.scenario, duration_s: Number(e.target.value) } })} /></Field></div>
        <div className="ws-condition-note"><Icon name="file" /><p>도면에 없는 운영 조건은 여기서 설정합니다. 이후 분석 화면에서 배치안과 혼잡 지표를 함께 검토할 수 있습니다.</p></div>
      </div>}
      {d.step === 3 && <div className="ws-review-layout"><div className="ws-form-card"><span className="ws-eyebrow">PROJECT BRIEF</span><h2 className="mt-4">{d.name}</h2><dl className="ws-review-details"><dt>공간 유형</dt><dd>{d.setting === "indoor" ? "실내 공간" : "야외 부지"}</dd><dt>부지 크기</dt><dd>{d.width} × {d.height} m</dd><dt>원본 도면</dt><dd>{d.source?.name ?? "빈 공간에서 시작"}</dd><dt>공간 요소</dt><dd>출입구 {d.marks.filter((m) => ["entrance", "exit"].includes(m.kind)).length}개 · 장애물/금지 구역 {d.marks.filter((m) => ["obstacle", "keepout"].includes(m.kind)).length}개</dd><dt>부스</dt><dd>{d.booths}개 · {d.boothWidth} × {d.boothDepth} m</dd><dt>최소 통로</dt><dd>{d.aisle} m</dd><dt>방문객</dt><dd>{d.scenario.agents}명 · {d.scenario.duration_s}초</dd><dt>시나리오</dt><dd>{{ entry: "입장", browse: "둘러보기", exit: "퇴장" }[d.scenario.kind]}</dd></dl><button className="ws-text-button" onClick={() => go(1)}>공간 정보 수정 <Icon name="arrow" width="15" /></button></div><div className="ws-next-card"><span className="ws-next-icon"><Icon name="play" width="28" height="28" /></span><h2>이제 배치안을 비교해 보세요.</h2><ol><li><span>1</span>조건에 맞는 부스 배치 생성</li><li><span>2</span>공간 제약 검사와 보행 시뮬레이션</li><li><span>3</span>개선안과 분석 보고서 검토</li></ol><p>분석 화면에서 실행을 시작합니다. 서버의 분석 기능이 활성화되어 있어야 새 계산을 실행할 수 있습니다.</p><button className="ws-button ws-primary" onClick={onAnalyze}>분석 화면 열기 <Icon name="arrow" /></button></div></div>}
      {error && <div className="ws-error" role="alert">{error}</div>}
      <footer className="ws-wizard-footer"><span><Icon name="check" width="15" />{saveState}</span><div>{d.step > 0 && <button className="ws-button ws-secondary" disabled={loading} onClick={() => go(d.step - 1)}>이전</button>}{d.step < 3 && <button className="ws-button ws-primary" disabled={loading} onClick={() => go(d.step + 1)}>{d.step === 0 && !d.source ? "도면 없이 공간 설정" : "다음 단계"}<Icon name="arrow" width="17" /></button>}</div></footer>
    </section>
  </div>;
}

export function Illustration() {
  return <svg className="ws-illustration" viewBox="0 0 400 270" fill="none" aria-hidden="true"><path d="m50 170 160 80 150-85-160-80Z" fill="#e2e8e0" /><path d="m50 170 160 80v-15L50 155Zm160 80 150-85v-15l-150 85Z" fill="#c9d2c5" /><path d="M50 155V80l150-80v85Zm0-75 160 80v75L50 155Z" fill="#f9f8f3" stroke="#c9c9bd" /><path d="m210 160 150-85v75l-150 85Z" fill="#f0eee6" stroke="#c9c9bd" /><path d="m95 139 31 16 31-17-31-16Z" fill="#fbfaf7" stroke="#a9b9ad"/><path d="M95 139v-27l31 16v27Zm31-11 31-17v27l-31 17Z" fill="#9fb7ac"/><path d="m95 112 31 16 31-17-31-16Z" fill="#d5e2db"/><path d="m175 181 31 16 31-17-31-16Z" fill="#fbfaf7" stroke="#a9b9ad"/><path d="M175 181v-27l31 16v27Zm31-11 31-17v27l-31 17Z" fill="#9fb7ac"/><path d="m175 154 31 16 31-17-31-16Z" fill="#d5e2db"/><path d="m255 137 31 16 31-17-31-16Z" fill="#fbfaf7" stroke="#a9b9ad"/><path d="M255 137v-27l31 16v27Zm31-11 31-17v27l-31 17Z" fill="#9fb7ac"/><path d="m255 110 31 16 31-17-31-16Z" fill="#d5e2db"/><path d="m100 171 110 54 125-71" stroke="#1f5f5b" strokeDasharray="5 5" strokeWidth="2"/><circle cx="210" cy="225" r="4" fill="#1f5f5b"/></svg>;
}
