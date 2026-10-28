"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignObject, PlanDocument } from "@/lib/plans/schema";
import type { BoothApplicationAccess } from "@/lib/booths/schema";
import { createBoothDocument, validateBoothDesign, importBoothDesignIntoVenue } from "@/lib/booths/design";
import { PlanCanvas } from "../studio/plan-canvas";
import { Badge, Button, Segmented } from "../ui";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { NativeSelect } from "../ui/native-select";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { boothRequest } from "./client";
import "../studio/studio.css";
import "../studio/spatial-design.css";
const SceneView = dynamic(() => import("../studio/scene-view"), { ssr: false, loading: () => <p role="status">3D 공간을 준비하는 중…</p> });
type Generation = { document: PlanDocument; summary: string; steps: { agent: string; tool: string; outcome: string }[]; handoff: { notes: string[] } };
const kinds: { value: DesignObject["kind"]; label: string }[] = [{ value: "furniture", label: "가구" }, { value: "partition", label: "가벽" }, { value: "equipment", label: "전시 장비" }, { value: "light", label: "조명" }, { value: "hanging-sign", label: "행잉 사인" }];
export function BoothDesigner({ projectId, applicationId, token, organizerDocument, onDocumentChange }: { projectId: string; applicationId: string; token: string; organizerDocument?: PlanDocument; onDocumentChange?: (document: PlanDocument) => void }) {
  const [data, setData] = useState<BoothApplicationAccess | null>(null);
  const [document, setDocument] = useState<PlanDocument | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "scene">("scene");
  const [brief, setBrief] = useState("");
  const [notes, setNotes] = useState("");
  const [buildNotes, setBuildNotes] = useState("");
  const [proposal, setProposal] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const generation = useRef<AbortController | null>(null);
  const base = `/api/booths/projects/${projectId}/applications/${applicationId}`;
  useEffect(() => {
    const controller = new AbortController();
    void boothRequest<BoothApplicationAccess>(base, { token, signal: controller.signal }).then(result => {
      setData(result); setDocument(result.document); setBrief(result.application.brief);
      setNotes(result.application.design?.notes ?? ""); setBuildNotes(result.application.design?.buildNotes ?? "");
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => { controller.abort(); generation.current?.abort(); };
  }, [base, token]);
  const issues = useMemo(() => data && document ? validateBoothDesign(data.booth, document.objects ?? []) : [], [data, document]);
  const object = document?.objects?.find(item => item.id === selected);
  const locked = busy || generating;
  function changeObjects(objects: DesignObject[]) { if (data) { setDocument(createBoothDocument(data.booth, objects)); setDirty(true); setNotice(""); } }
  function updateObject(patch: Partial<DesignObject>) { if (document) changeObjects((document.objects ?? []).map(item => item.id === selected ? { ...item, ...patch, provenance: "manual" } : item)); }
  function addObject(kind: DesignObject["kind"]) {
    if (!data || !document) return;
    const id = crypto.randomUUID();
    changeObjects([...(document.objects ?? []), { id, kind, label: kinds.find(item => item.value === kind)?.label ?? kind, x: .5, y: .5, width: Math.min(1, data.booth.width / 2), depth: Math.min(.5, data.booth.depth / 2), height: Math.min(1, data.booth.maxHeight), elevation: 0, rotation: 0, color: "#89a9b6", provenance: "manual" }]); setSelected(id);
  }
  async function generate() {
    if (!brief.trim() || locked) return;
    const controller = new AbortController(); generation.current = controller;
    setGenerating(true); setError(""); setNotice(""); setProposal(null);
    try { setProposal(await boothRequest<Generation>(`${base}/design/generate`, { method: "POST", token, body: { brief }, signal: controller.signal })); }
    catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "디자인을 생성하지 못했습니다."); else setNotice("디자인 요청을 중단했습니다. 현재 초안은 유지됩니다."); }
    finally { setGenerating(false); generation.current = null; }
  }
  async function save(status: "draft" | "submitted") {
    if (!document || issues.length || locked) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await boothRequest<{ application: BoothApplicationAccess["application"] }>(`${base}/design`, { method: "PATCH", token, body: { objects: document.objects ?? [], notes, buildNotes, status } });
      setData(current => current ? { ...current, application: result.application } : current); setDirty(false);
      setNotice(status === "submitted" ? "시공 검토용 컨셉을 운영자에게 제출했습니다." : "부스 디자인 초안을 저장했습니다.");
    } catch (err) { setError(err instanceof Error ? err.message : "저장하지 못했습니다."); } finally { setBusy(false); }
  }
  function exportHandoff() {
    if (!data || !document) return;
    const content = { company: data.application.company, booth: data.booth, status: "concept", notes, buildNotes, objects: document.objects ?? [], exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }));
    const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `booth-${applicationId}-concept.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className="flex flex-col gap-5">
    {error && <p role="alert" className="text-sm text-bad">{error}</p>}{notice && <p role="status" className="text-sm text-accent">{notice}</p>}
    {!data || !document ? <p role="status">부스 작업실을 불러오는 중…</p> : data.application.status !== "approved" ? <p>참가 승인 후 디자인할 수 있습니다.</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">{data.booth.name} 디자인 작업실</h3><p className="mt-1 text-sm text-muted">{data.booth.width} × {data.booth.depth} m · 설치 높이 {data.booth.maxHeight} m 이하</p></div><Badge tone={dirty ? "neutral" : "ok"}>{dirty ? "저장하지 않은 변경" : data.application.design?.status === "submitted" ? "검토 제출됨" : "디자인 초안"}</Badge></div>
      <section className="flex flex-col gap-3 rounded-lg border border-hairline p-4"><h4 className="font-semibold">Muse · 부스 전담 디자이너</h4><p className="text-sm text-muted">부스 전담 하위 에이전트가 배치안을 만들고 경계·높이·겹침을 검사하며 수정합니다.</p><FieldGroup><Field><FieldLabel htmlFor={`design-brief-${applicationId}`}>원하는 부스 디자인</FieldLabel><Textarea id={`design-brief-${applicationId}`} value={brief} maxLength={6000} rows={3} disabled={locked} onChange={event => setBrief(event.target.value)} placeholder="예: 제품 체험 테이블과 상담 카운터, 브랜드 사인이 있는 부스"/></Field></FieldGroup><div className="flex flex-wrap gap-2"><Button variant="primary" disabled={locked || !brief.trim()} onClick={() => void generate()}>{generating ? "Muse가 디자인 · 검증 중…" : "부스 전담 에이전트에게 디자인 요청"}</Button>{generating && <Button onClick={() => generation.current?.abort()}>요청 중단</Button>}</div>
        {proposal && <div className="flex flex-col gap-3 rounded-lg bg-sunken p-4"><strong>검토할 디자인 제안</strong><p className="whitespace-pre-wrap text-sm">{proposal.summary}</p><p className="text-sm">설치물 {proposal.document.objects?.length ?? 0}개 · 현재 초안을 대체합니다.</p><details><summary className="cursor-pointer text-sm">에이전트 작업 기록</summary><ol className="mt-2 flex flex-col gap-1 text-xs text-muted">{proposal.steps.map((step, index) => <li key={index}>{step.agent} · {step.tool} · {step.outcome}</li>)}</ol></details><div className="flex gap-2"><Button variant="primary" disabled={locked} onClick={() => { setDocument(proposal.document); setNotes(proposal.summary); setBuildNotes(proposal.handoff.notes.join("\n")); setDirty(true); setSelected(null); setProposal(null); }}>이 제안 적용</Button><Button onClick={() => setProposal(null)}>제안 버리기</Button></div></div>}
      </section>
      <div className="flex items-center justify-between gap-3"><Segmented options={[{ id: "plan", label: "2D 편집" }, { id: "scene", label: "3D 공간" }]} value={view} onChange={setView} label="부스 보기"/><span className="text-sm text-muted">설치물 {document.objects?.length ?? 0}개</span></div>
      <div className="ps-canvas-area relative min-h-96 overflow-hidden rounded-xl border border-hairline" style={{ height: 420 }}>{view === "plan" ? <PlanCanvas document={document} selected={selected} onSelect={setSelected} sourceOnly={false} drawing={false} onDraw={() => {}} measurement={null} rectangle={false}/> : <SceneView document={document} wallHeight={data.booth.maxHeight} selected={selected} onSelect={setSelected}/>}</div>
      <details><summary className="cursor-pointer text-sm font-semibold">설치물 직접 조정</summary><div className="mt-4 flex flex-col gap-4"><div className="flex flex-wrap gap-2">{kinds.map(kind => <Button key={kind.value} disabled={locked || (document.objects?.length ?? 0) >= 80} onClick={() => addObject(kind.value)}>＋ {kind.label}</Button>)}</div>
      <FieldGroup><Field><FieldLabel htmlFor={`booth-object-${applicationId}`}>편집할 설치물</FieldLabel><NativeSelect id={`booth-object-${applicationId}`} value={selected ?? ""} onChange={event => setSelected(event.target.value || null)}><option value="">설치물을 선택하세요</option>{document.objects?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect></Field></FieldGroup>
      {object && <fieldset disabled={locked} className="flex flex-col gap-4 rounded-lg border border-hairline p-4"><legend className="px-2 text-sm">{object.label} 편집</legend><FieldGroup><Field><FieldLabel htmlFor={`object-name-${applicationId}`}>이름</FieldLabel><Input id={`object-name-${applicationId}`} value={object.label} maxLength={100} onChange={event => updateObject({ label: event.target.value })}/></Field></FieldGroup><div className="grid gap-3 sm:grid-cols-3">{([{ key: "width", label: "너비 (m)", min: .1, max: data.booth.width }, { key: "depth", label: "깊이 (m)", min: .1, max: data.booth.depth }, { key: "height", label: "높이 (m)", min: .1, max: data.booth.maxHeight }, { key: "elevation", label: "바닥에서 띄운 높이 (m)", min: 0, max: data.booth.maxHeight }, { key: "x", label: "가로 위치 (0–1)", min: 0, max: 1 }, { key: "y", label: "세로 위치 (0–1)", min: 0, max: 1 }] as const).map(field => <Field key={field.key}><FieldLabel htmlFor={`${applicationId}-${field.key}`}>{field.label}</FieldLabel><Input id={`${applicationId}-${field.key}`} type="number" step={field.key === "x" || field.key === "y" ? .01 : .1} min={field.min} max={field.max} value={object[field.key] ?? 0} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value) && value >= field.min && value <= field.max) updateObject({ [field.key]: value }); }}/></Field>)}</div><FieldGroup><Field><FieldLabel htmlFor={`object-color-${applicationId}`}>색상</FieldLabel><Input id={`object-color-${applicationId}`} type="color" value={object.color} onChange={event => updateObject({ color: event.target.value })}/></Field></FieldGroup><div className="flex gap-2"><Button onClick={() => updateObject({ rotation: object.rotation === 0 ? 90 : 0 })}>90° 회전</Button><Button variant="danger" onClick={() => { changeObjects((document.objects ?? []).filter(item => item.id !== object.id)); setSelected(null); }}>설치물 삭제</Button></div></fieldset>}</div></details>
      {issues.length > 0 && <section role="alert" className="rounded-lg border border-hairline p-4"><strong className="text-sm text-bad">저장 전에 수정해 주세요</strong><ul className="mt-2 list-disc pl-5 text-sm">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></section>}
      <FieldGroup><Field><FieldLabel htmlFor={`design-notes-${applicationId}`}>디자인 설명</FieldLabel><Textarea id={`design-notes-${applicationId}`} value={notes} maxLength={6000} disabled={locked} onChange={event => { setNotes(event.target.value); setDirty(true); }}/></Field><Field><FieldLabel htmlFor={`construction-notes-${applicationId}`}>시공 협의 메모 · 재료 · 전기 요구사항</FieldLabel><Textarea id={`construction-notes-${applicationId}`} value={buildNotes} maxLength={12000} rows={4} disabled={locked} placeholder="마감 재료, 전원 위치, 조립 방식, 시공사와 확인할 사항" onChange={event => { setBuildNotes(event.target.value); setDirty(true); }}/></Field></FieldGroup>
      <details><summary className="cursor-pointer text-sm font-semibold">시공 검토용 설치물 목록</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">설치물</th><th className="p-2">너비 × 깊이 × 높이 (m)</th><th className="p-2">수량</th></tr></thead><tbody>{document.objects?.map(item => <tr key={item.id} className="border-t border-hairline"><td className="p-2">{item.label}</td><td className="p-2">{item.width} × {item.depth} × {item.height}</td><td className="p-2">1</td></tr>)}</tbody></table></div></details>
      <p className="text-xs text-muted">시공 협의용 컨셉입니다. 구조·전기·소방·리깅 확인과 시공 견적은 별도 검토가 필요합니다.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={locked || !!issues.length} onClick={() => void save("draft")}>초안 저장</Button><Button variant="primary" disabled={locked || !!issues.length || !document.objects?.length} onClick={() => void save("submitted")}>시공 검토용 디자인 제출</Button><Button disabled={!document.objects?.length} onClick={exportHandoff}>설치물 · 협의 자료 내보내기</Button>{organizerDocument && onDocumentChange && <Button disabled={locked || !!issues.length || !document.objects?.length} onClick={() => { try { onDocumentChange(importBoothDesignIntoVenue(organizerDocument, data.booth, applicationId, document.objects ?? [])); setNotice("이 부스 디자인을 전체 공간에 반영했습니다."); } catch (err) { setError(err instanceof Error ? err.message : "전체 공간에 반영하지 못했습니다."); } }}>전체 공간에 디자인 반영</Button>}</div>
    </>}
  </div>;
}
