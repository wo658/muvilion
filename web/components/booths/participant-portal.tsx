"use client";

import dynamic from "next/dynamic";
import { BoothChat } from "./booth-chat";
import { PlanCanvas } from "../studio/plan-canvas";
import { Segmented } from "../ui";
import "../studio/studio.css";
import "../studio/spatial-design.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PlanDocument } from "@/lib/plans/schema";
import type { BoothApplication, BoothListing, PublicBoothProject } from "@/lib/booths/schema";
import { Badge, Button } from "../ui";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { BoothDesigner } from "./booth-designer";
import { applicationStatus, boothRequest, won } from "./client";

const SceneView = dynamic(() => import("../studio/scene-view"), { ssr: false });
type Access = { applicationId: string; token: string };
export function ParticipantPortal({ projectId, embedded = false, active = true, selectedZoneId, onSelect, onProject, onDesignPreview, onObjectSelect, selectedObjectId }: { selectedObjectId?: string | null; onObjectSelect?: (id: string | null) => void; onDesignPreview?: (document: PlanDocument | null) => void; projectId: string; embedded?: boolean; active?: boolean; selectedZoneId?: string | null; onSelect?: (id: string) => void; onProject?: (project: PublicBoothProject) => void }) {
  const [view, setView] = useState<"plan" | "scene">("plan");
  const [project, setProject] = useState<PublicBoothProject | null>(null);
  const [localSelected, setSelected] = useState<BoothListing | null>(null);
  const selected = project?.booths.find(booth => booth.zoneId === selectedZoneId) ?? localSelected;
  useEffect(() => { if (project) onProject?.(project); }, [project, onProject]);
  const [access, setAccess] = useState<Access | null>(null);
  const [application, setApplication] = useState<BoothApplication | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const storageKey = `muvilion.booth-applicant.v1:${projectId}`;
  const refresh = useCallback(async (auth: Access | null, signal?: AbortSignal) => {
    const [catalogue, privateData] = await Promise.all([
      boothRequest<{ project: PublicBoothProject }>(`/api/booths/projects/${projectId}`, { signal }),
      auth ? boothRequest<{ application: BoothApplication }>(`/api/booths/projects/${projectId}/applications/${auth.applicationId}`, { token: auth.token, signal }) : Promise.resolve(null),
    ]);
    setProject(catalogue.project);
    if (privateData) setApplication(privateData.application);
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    let auth: Access | null = null;
    if (hash.get("application") && hash.get("token")) auth = { applicationId: hash.get("application")!, token: hash.get("token")! };
    if (!auth) { try { auth = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Access | null; } catch { /* An unsaved browser can still apply. */ } }
    if (auth && (typeof auth.applicationId !== "string" || typeof auth.token !== "string")) auth = null;
    if (auth) { try { localStorage.setItem(storageKey, JSON.stringify(auth)); } catch { /* Private URL remains available. */ } }
    void Promise.allSettled([
      boothRequest<{ project: PublicBoothProject }>(`/api/booths/projects/${projectId}`, { signal: controller.signal }),
      auth ? boothRequest<{ application: BoothApplication }>(`/api/booths/projects/${projectId}/applications/${auth.applicationId}`, { token: auth.token, signal: controller.signal }) : Promise.resolve(null),
    ]).then(([catalogue, privateData]) => {
      if (controller.signal.aborted) return;
      if (catalogue.status === "fulfilled") setProject(catalogue.value.project);
      else setError(catalogue.reason instanceof Error ? catalogue.reason.message : "모집 정보를 불러올 수 없습니다.");
      if (privateData.status === "fulfilled" && privateData.value) { setApplication(privateData.value.application); setAccess(auth); }
      else if (privateData.status === "rejected") setError("저장된 신청 링크를 열 수 없습니다. 올바른 전용 링크로 다시 접속하거나 새 신청을 시작해 주세요.");
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [projectId, storageKey, active]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || busy) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const data = await boothRequest<{ application: BoothApplication; applicantToken: string }>(`/api/booths/projects/${projectId}/applications`, { method: "POST", body: { boothId: selected.id, company: String(form.get("company")), contactName: String(form.get("contactName")), email: String(form.get("email")), brief: String(form.get("brief")) } });
      const auth = { applicationId: data.application.id, token: data.applicantToken };
      setAccess(auth); setApplication(data.application); setSelected(null);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${new URLSearchParams({ application: auth.applicationId, token: auth.token })}`);
      try { localStorage.setItem(storageKey, JSON.stringify(auth)); } catch { setNotice("브라우저에 저장하지 못했습니다. 반드시 전용 링크를 복사해 보관하세요."); }
      setNotice("신청서를 접수했습니다. 전용 링크를 보관하고 승인 상태를 확인하세요.");
    } catch (err) { setError(err instanceof Error ? err.message : "신청서를 접수하지 못했습니다."); } finally { setBusy(false); }
  }
  const privateUrl = access && typeof window !== "undefined" ? `${window.location.origin}/participate/${projectId}#${new URLSearchParams({ application: access.applicationId, token: access.token })}` : "";
  return <div className={embedded ? "flex flex-col gap-5 p-4" : "mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-5 py-8"}>
    {!embedded && <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-semibold">muvilion</Link><span className="text-sm text-muted">참가 모드</span></header>}
    <section><h1 className="text-xl font-semibold">{project?.title ?? "부스 둘러보기"}</h1><p className="mt-2 text-sm text-muted">가격이 정해진 부스를 둘러보고 신청하세요. 승인 후 내 부스를 꾸밀 수 있어요.</p></section>
    {!embedded && project && <><Segmented options={[{ id: "plan", label: "2D 공간" }, { id: "scene", label: "3D 공간" }]} value={view} onChange={setView} label="공간 보기"/><div className="ps-canvas-area" style={{ minHeight: 480 }}>{view === "scene" ? <SceneView document={project.space} selected={selected?.zoneId ?? null} onSelect={id => setSelected(project.booths.find(booth => booth.zoneId === id) ?? null)} wallHeight={project.space.wallHeight ?? 3}/> : <PlanCanvas document={project.space} selected={selected?.zoneId ?? null} onSelect={id => setSelected(project.booths.find(booth => booth.zoneId === id) ?? null)} sourceOnly={false} showSourceFallback={false} drawing={false} rectangle={false} onDraw={() => {}} measurement={null}/>}</div></>}
    {project && application?.status !== "approved" && <BoothChat projectId={projectId} selectedZoneId={selected?.zoneId} applicationId={access?.applicationId} token={access?.token}/>}
    {error && <p role="alert" className="text-sm text-bad">{error}</p>}{notice && <p role="status" className="text-sm text-accent">{notice}</p>}
    {!ready && <p role="status">모집 정보를 불러오는 중…</p>}
    {ready && !project && <Button onClick={() => { setError(""); void refresh(access).catch(err => setError(err.message)); }}>다시 불러오기</Button>}
    {application && access && <section className="flex flex-col gap-4 rounded-xl border border-hairline p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{application.company}의 참가 신청</h2><Badge tone={application.status === "approved" ? "ok" : application.status === "rejected" ? "bad" : "neutral"}>{applicationStatus[application.status]}</Badge></div>
      <p className="text-sm">{project?.booths.find(booth => booth.id === application.boothId)?.name} · 신청 시 참가비 {won(application.quotedPrice)}</p>
      <details open={application.status !== "approved"}><summary className="cursor-pointer text-sm text-muted">내 신청 · 승인 정보</summary><div className="mt-3 flex flex-col gap-4">
      <p className="text-sm text-muted">{application.status === "pending" ? "운영자가 신청서를 검토하고 있습니다. 승인 후 아래에서 부스 디자인을 시작할 수 있습니다." : application.status === "rejected" ? "신청이 반려되었습니다. 다른 부스에 신청하려면 아래에서 새 신청을 시작하세요." : "참가가 승인되었습니다. 배정된 부스 안에서 디자인하고 시공 검토용 초안을 제출하세요."}</p>
      <FieldGroup><Field><FieldLabel htmlFor="participant-private-link">내 신청 · 디자인 전용 링크</FieldLabel><Input id="participant-private-link" readOnly value={privateUrl}/></Field></FieldGroup><p className="text-xs text-muted">이 링크로 신청과 디자인에 접근합니다. 본인만 보관하세요. 자동 이메일은 발송되지 않습니다.</p>
      <div className="flex flex-wrap gap-2"><Button onClick={() => void navigator.clipboard.writeText(privateUrl).then(() => setNotice("전용 링크를 복사했습니다.")).catch(() => setError("링크 입력란에서 직접 복사해 주세요."))}>전용 링크 복사</Button><Button disabled={busy} onClick={() => { setBusy(true); setError(""); void refresh(access).catch(err => setError(err.message)).finally(() => setBusy(false)); }}>승인 상태 새로고침</Button><Button onClick={() => { setAccess(null); setApplication(null); setSelected(null); window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); try { localStorage.removeItem(storageKey); } catch { /* Keep current state usable. */ } setNotice("이전 신청은 전용 링크로 다시 열 수 있습니다."); }}>다른 부스 신청하기</Button></div>
      </div></details>
      {application.status === "approved" && <BoothDesigner selectedObjectId={embedded ? selectedObjectId : undefined} onObjectSelect={onObjectSelect} embedded={embedded} onPreview={onDesignPreview} key={application.id} projectId={projectId} applicationId={application.id} token={access.token}/>}
    </section>}
    {!application && project && <>
      <section className={embedded ? "grid gap-4" : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"} aria-label="참가 가능한 부스">{project.booths.map(booth => <article key={booth.id} className="flex flex-col gap-4 rounded-xl border border-hairline p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{booth.name}</h2><Badge tone={booth.available ? "accent" : "neutral"}>{booth.available ? "신청 가능" : "배정 완료"}</Badge></div><div className="flex min-h-28 items-center justify-center rounded-lg bg-sunken"><div className="flex min-h-20 min-w-24 items-center justify-center border border-accent p-3 text-sm text-accent" style={{ aspectRatio: booth.width / booth.depth }}>{booth.width} × {booth.depth} m</div></div><strong className="text-2xl">{won(booth.price)}</strong><p className="text-sm text-muted">{(booth.width * booth.depth).toFixed(1)} m² · 설치 높이 {booth.maxHeight} m 이하</p><p className="flex-1 whitespace-pre-wrap text-sm">{booth.description || "참가 조건은 운영자에게 문의해 주세요."}</p><Button variant={selected?.id === booth.id ? "primary" : "secondary"} disabled={!booth.available} onClick={() => { setSelected(booth); onSelect?.(booth.zoneId); }}>{selected?.id === booth.id ? "선택한 부스" : "이 부스 신청하기"}</Button></article>)}</section>
      <p className="text-xs text-muted">표시 금액은 참가비 안내입니다. 이 페이지에서 결제하지 않습니다.</p>
      {selected && <form onSubmit={event => void submit(event)} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-hairline p-5"><h2 className="text-xl font-semibold">{selected.name} 참가 신청</h2><p className="text-sm text-muted">{won(selected.price)} · 승인 후 부스 디자인 이용 가능</p><FieldGroup><Field><FieldLabel htmlFor="applicant-company">회사 · 팀 이름</FieldLabel><Input id="applicant-company" name="company" required maxLength={150}/></Field><Field><FieldLabel htmlFor="applicant-contact">담당자 이름</FieldLabel><Input id="applicant-contact" name="contactName" required maxLength={100}/></Field><Field><FieldLabel htmlFor="applicant-email">연락 이메일</FieldLabel><Input id="applicant-email" name="email" type="email" required maxLength={254}/></Field><Field><FieldLabel htmlFor="applicant-brief">참가 소개 · 전시 계획</FieldLabel><Textarea id="applicant-brief" name="brief" required maxLength={6000} rows={4} placeholder="브랜드 소개와 전시할 제품, 필요한 공간을 알려주세요."/></Field></FieldGroup><Button type="submit" variant="primary" disabled={busy}>{busy ? "신청서 접수 중…" : "참가 신청서 제출"}</Button></form>}
    </>}
  </div>;
}
