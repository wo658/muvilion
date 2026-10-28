"use client";

import { useEffect, useState } from "react";
import type { PricingContext } from "@/lib/booths/pricing";
import type { PlanDocument, SpaceZone } from "@/lib/plans/schema";
import type { BoothApplication, OrganizerBoothProject } from "@/lib/booths/schema";
import { Badge, Button } from "../ui";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { boothRequest, applicationStatus, won } from "./client";
import { BoothDesigner } from "./booth-designer";

type Credential = { projectId: string; token: string };
type OfferDraft = { name: string; price: number; maxHeight: number; description: string; selected: boolean };
type OrganizerProps = { onPublished?: (id: string | null) => void; onPricing?: (pricing: PricingContext) => void; document: PlanDocument; onDocumentChange: (document: PlanDocument) => void };
function sourceKey(document: PlanDocument) {
  return `muvilion.booth-organizer.v1:${JSON.stringify(document.source)}:${document.lines.slice(0, 5).map(line => `${line.a.x},${line.a.y},${line.b.x},${line.b.y}`).join(";")}`;
}
export function OrganizerBooths(props: OrganizerProps) { return <OrganizerBoothsInner key={sourceKey(props.document)} {...props}/>; }
function OrganizerBoothsInner({ document, onDocumentChange, onPublished, onPricing }: OrganizerProps) {
  const zones = (document.zones ?? []).filter(zone => zone.assignable || zone.purpose === "booth");
  const [title, setTitle] = useState(document.source.name.replace(/\.[^.]+$/, ""));
  const [drafts, setDrafts] = useState<Record<string, OfferDraft>>({});
  const [credential, setCredential] = useState<Credential | null>(null);
  const [project, setProject] = useState<OrganizerBoothProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<BoothApplication | null>(null);
  const [restoreCode, setRestoreCode] = useState("");
  const key = sourceKey(document);
  const offer = (id: string, name: string): OfferDraft => drafts[id] ?? { name, price: 0, maxHeight: Math.min(document.ceiling?.height ?? 3, 3), description: "", selected: true };
  const updateOffer = (id: string, name: string, patch: Partial<OfferDraft>) => setDrafts(current => ({ ...current, [id]: { ...offer(id, name), ...patch } }));
  useEffect(() => {
    onPublished?.(project?.id ?? null);
    onPricing?.(project ? project.booths.map(booth => ({ name: booth.name, width: booth.width, depth: booth.depth, price: booth.price, description: booth.description, published: true })) : (document.zones ?? []).filter(zone => zone.assignable || zone.purpose === "booth").map(zone => ({ name: drafts[zone.id]?.name ?? zone.label, width: zone.width, depth: zone.depth, price: drafts[zone.id]?.price ?? 0, description: drafts[zone.id]?.description ?? "", published: false })));
  }, [project, document, drafts, onPublished, onPricing]);
  async function load(auth: Credential, signal?: AbortSignal) {
    const data = await boothRequest<{ project: OrganizerBoothProject }>(`/api/booths/projects/${auth.projectId}`, { token: auth.token, signal });
    setProject(data.project);
  }
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      const value = localStorage.getItem(key);
      if (!value) return null;
      const auth = JSON.parse(value) as Credential;
      if (typeof auth.projectId !== "string" || typeof auth.token !== "string") throw new Error("관리 복구 정보가 올바르지 않습니다. 복구 코드를 입력해 주세요.");
      const result = await boothRequest<{ project: OrganizerBoothProject }>(`/api/booths/projects/${auth.projectId}`, { token: auth.token, signal: controller.signal });
      return { auth, project: result.project };
    }).then(result => { if (result && !controller.signal.aborted) { setCredential(result.auth); setProject(result.project); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => controller.abort();
  }, [key]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : "작업을 완료하지 못했습니다."); } finally { setBusy(false); }
  }
  function remember(auth: Credential) {
    setCredential(auth);
    try { localStorage.setItem(key, JSON.stringify(auth)); } catch { setNotice("이 브라우저에 관리 권한을 저장할 수 없습니다. 관리 복구 코드를 복사해 보관해 주세요."); }
  }
  function addBooth() {
    const width = document.widthMeters ?? 3, depth = document.heightMeters ?? 3;
    const id = crypto.randomUUID();
    const centre = document.walkStart ?? { x: .5, y: .5 };
    onDocumentChange({ ...document, zones: [...(document.zones ?? []), { id, label: `참가 부스 ${zones.length + 1}`, purpose: "booth", assignable: true, ...centre, width: Math.min(3, width), depth: Math.min(3, depth), rotation: 0 }] });
    setNotice("부스 구역을 추가했습니다. 아래에서 위치와 크기를 조정한 뒤 공개해 주세요.");
  }
  function updateZone(id: string, patch: Partial<SpaceZone>) {
    onDocumentChange({ ...document, zones: (document.zones ?? []).map(zone => zone.id === id ? { ...zone, ...patch } : zone) });
  }
  async function publish() {
    await action(async () => {
      const selectedZones = zones.filter(zone => offer(zone.id, zone.label).selected);
      const offeredIds = new Set(selectedZones.map(zone => zone.id));
      const publishedDocument = { ...document, zones: document.zones?.map(zone => offeredIds.has(zone.id) ? { ...zone, assignable: true } : zone) };
      const data = await boothRequest<{ project: OrganizerBoothProject; organizerToken: string }>("/api/booths/projects", { method: "POST", body: { title, document: publishedDocument, booths: selectedZones.map(zone => { const draft = offer(zone.id, zone.label); return { zoneId: zone.id, name: draft.name, price: draft.price, currency: "KRW", maxHeight: draft.maxHeight, description: draft.description }; }) } });
      onDocumentChange(publishedDocument);
      setProject(data.project); remember({ projectId: data.project.id, token: data.organizerToken });
      setNotice("참가 모집 페이지를 만들었습니다. 공개 링크를 참가자에게 공유하세요.");
    });
  }
  async function decide(application: BoothApplication, status: "approved" | "rejected") {
    if (!credential) return;
    await action(async () => {
      await boothRequest(`/api/booths/projects/${credential.projectId}/applications/${application.id}`, { method: "PATCH", token: credential.token, body: { status } });
      await load(credential); setNotice(status === "approved" ? "승인했습니다. 참가자가 전용 링크에서 부스 디자인을 시작할 수 있습니다." : "신청을 반려했습니다.");
    });
  }
  const publicPath = project ? `/participate/${project.id}` : "";
  return <div className="flex flex-col gap-6 p-5">
    <div><p className="eyebrow">SPACE DESIGN</p><h2 className="mt-2 text-xl font-semibold">부스 가격 · 신청 관리</h2><p className="mt-2 text-sm text-muted">Muse와 가격을 검토한 뒤 공개하세요. 부스 디자이너 모드에서 신청 경험을 바로 확인할 수 있어요.</p></div>
    {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    {notice && <p role="status" className="text-sm text-accent">{notice}</p>}
    {restoring && <p role="status" className="text-sm text-muted">저장된 모집 정보를 확인하는 중…</p>}
    {!project ? <>
      <FieldGroup><Field><FieldLabel htmlFor="booth-event-title">행사 이름</FieldLabel><Input id="booth-event-title" value={title} maxLength={150} onChange={event => setTitle(event.target.value)}/></Field></FieldGroup>
      {!document.scaleConfirmed && <p className="text-sm text-muted">먼저 도면의 실제 크기를 확정해 주세요.</p>}
      <div className="flex flex-wrap items-center gap-3"><strong>{zones.length}개 참가 가능 구역</strong><Button disabled={!document.scaleConfirmed || (document.zones?.length ?? 0) >= 200} onClick={addBooth}>부스 구역 추가</Button></div>
      {!zones.length && <p className="text-sm text-muted">부스 구역을 추가하면 가격과 위치를 설정할 수 있습니다.</p>}
      {zones.map(zone => { const value = offer(zone.id, zone.label); return <section key={zone.id} className="rounded-lg border border-hairline p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={value.selected} onChange={event => updateOffer(zone.id, zone.label, { selected: event.target.checked })}/><strong>{zone.label}</strong></label><span className="text-sm text-muted">{zone.width} × {zone.depth} m · {(zone.width * zone.depth).toFixed(1)} m²</span></div>
        <details className="mb-4"><summary className="cursor-pointer text-sm">부스 위치 · 크기 조정</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ key: "x", label: "중심 가로 위치 (m)", value: zone.x * (document.widthMeters ?? 1), max: document.widthMeters ?? 1, min: 0 }, { key: "y", label: "중심 세로 위치 (m)", value: zone.y * (document.heightMeters ?? 1), max: document.heightMeters ?? 1, min: 0 }, { key: "width", label: "너비 (m)", value: zone.width, max: 100, min: .1 }, { key: "depth", label: "깊이 (m)", value: zone.depth, max: 100, min: .1 }] as const).map(field => <Field key={field.key}><FieldLabel htmlFor={`${zone.id}-${field.key}`}>{field.label}</FieldLabel><Input id={`${zone.id}-${field.key}`} type="number" min={field.min} max={field.max} step={.1} value={Number(field.value.toFixed(3))} onChange={event => { const n = event.target.valueAsNumber; if (Number.isFinite(n) && n >= field.min && n <= field.max) updateZone(zone.id, { [field.key]: field.key === "x" ? n / (document.widthMeters ?? 1) : field.key === "y" ? n / (document.heightMeters ?? 1) : n }); }}/></Field>)}</div><Button className="mt-3" onClick={() => updateZone(zone.id, { rotation: zone.rotation === 0 ? 90 : 0 })}>90° 회전 · 현재 {zone.rotation}°</Button><p className="mt-2 text-xs text-muted">도면 왼쪽 위가 기준점입니다. 공개 전에 전체 공간에서 동선과 구역 위치를 확인하세요.</p></details>
        <FieldGroup><Field><FieldLabel htmlFor={`booth-name-${zone.id}`}>공개 부스 이름</FieldLabel><Input id={`booth-name-${zone.id}`} value={value.name} maxLength={100} onChange={event => updateOffer(zone.id, zone.label, { name: event.target.value })}/></Field>
          <Field><FieldLabel htmlFor={`booth-price-${zone.id}`}>참가비 (원)</FieldLabel><Input id={`booth-price-${zone.id}`} type="number" min={0} max={1000000000} step={1000} value={value.price} onChange={event => updateOffer(zone.id, zone.label, { price: Number(event.target.value) })}/></Field>
          <Field><FieldLabel htmlFor={`booth-height-${zone.id}`}>설치 높이 제한 (m)</FieldLabel><Input id={`booth-height-${zone.id}`} type="number" min={.5} max={30} step={.1} value={value.maxHeight} onChange={event => updateOffer(zone.id, zone.label, { maxHeight: Number(event.target.value) })}/></Field>
          <Field><FieldLabel htmlFor={`booth-description-${zone.id}`}>제공 사항 · 참가 조건</FieldLabel><Textarea id={`booth-description-${zone.id}`} value={value.description} maxLength={2000} placeholder="예: 전기 1kW 포함, 가구 별도, VAT 포함" onChange={event => updateOffer(zone.id, zone.label, { description: event.target.value })}/></Field></FieldGroup>
      </section>; })}
      <p className="text-xs text-muted">참가비를 안내하고 신청을 받습니다. 결제는 처리하지 않습니다. 공개 시점의 부스 위치와 크기가 참가자 작업 범위로 고정됩니다.</p>
      <Button variant="primary" disabled={busy || restoring || !document.scaleConfirmed || !title.trim() || !zones.some(zone => offer(zone.id, zone.label).selected)} onClick={() => void publish()}>{busy ? "공개하는 중…" : "가격 확정 · 부스 공개"}</Button>
      <details><summary className="cursor-pointer text-sm">기존 모집 관리 권한 복구</summary><FieldGroup className="mt-3"><Field><FieldLabel htmlFor="organizer-restore">관리 복구 코드</FieldLabel><Textarea id="organizer-restore" value={restoreCode} onChange={event => setRestoreCode(event.target.value)}/></Field></FieldGroup><Button className="mt-3" disabled={busy || !restoreCode.trim()} onClick={() => void action(async () => { const auth = JSON.parse(restoreCode) as Credential; if (typeof auth.projectId !== "string" || typeof auth.token !== "string" || !auth.projectId || !auth.token) throw new Error("복구 코드 형식이 올바르지 않습니다."); await load(auth); remember(auth); })}>관리 페이지 열기</Button></details>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{project.title}</h3><Badge tone="ok">모집 페이지 공개됨</Badge></div>
      <FieldGroup><Field><FieldLabel htmlFor="public-booth-link">참가자용 공개 링크</FieldLabel><Input id="public-booth-link" readOnly value={typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`}/></Field></FieldGroup>
      <div className="flex flex-wrap gap-2"><a className="text-sm text-accent underline" href={publicPath} target="_blank" rel="noreferrer">모집 페이지 열기 ↗</a><Button onClick={() => void action(async () => { await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`); setNotice("참가자 링크를 복사했습니다."); })}>링크 복사</Button><Button disabled={busy} onClick={() => credential && void action(() => load(credential))}>신청 새로고침</Button></div>
      <details><summary className="cursor-pointer text-sm text-muted">관리 권한 보관</summary><p className="mt-2 text-xs text-muted">이 코드를 가진 사람은 모집과 신청을 관리할 수 있습니다. 참가자에게 공유하지 마세요.</p><Button className="mt-2" onClick={() => void action(async () => { await navigator.clipboard.writeText(JSON.stringify(credential)); setNotice("관리 복구 코드를 복사했습니다."); })}>관리 복구 코드 복사</Button></details>
      <div className="flex flex-col gap-3">{project.booths.map(booth => <section key={booth.id} className="rounded-lg border border-hairline p-4"><div className="flex flex-wrap items-center justify-between gap-3"><strong>{booth.name}</strong><Badge tone={booth.available ? "accent" : "ok"}>{booth.available ? "신청 가능" : "배정 완료"}</Badge></div><p className="mt-2 text-sm text-muted">{booth.width} × {booth.depth} m · {won(booth.price)} · 높이 {booth.maxHeight} m</p><p className="mt-2 whitespace-pre-wrap text-sm">{booth.description}</p><details className="mt-3"><summary className="cursor-pointer text-sm">가격 · 안내 수정</summary><form className="mt-3 flex flex-col gap-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void action(async () => { await boothRequest(`/api/booths/projects/${project.id}`, { method: "PATCH", token: credential!.token, body: { booths: project.booths.map(item => ({ id: item.id, name: item.name, price: item.id === booth.id ? Number(form.get("price")) : item.price, currency: item.currency, maxHeight: item.maxHeight, description: item.id === booth.id ? String(form.get("description")) : item.description })) } }); await load(credential!); setNotice("가격과 안내를 저장했습니다."); }); }}><FieldGroup><Field><FieldLabel htmlFor={`update-price-${booth.id}`}>참가비 (원)</FieldLabel><Input id={`update-price-${booth.id}`} name="price" type="number" min={0} step={1000} defaultValue={booth.price}/></Field><Field><FieldLabel htmlFor={`update-desc-${booth.id}`}>참가 안내</FieldLabel><Textarea id={`update-desc-${booth.id}`} name="description" maxLength={2000} defaultValue={booth.description}/></Field></FieldGroup><Button type="submit" disabled={busy}>변경 저장</Button></form></details></section>)}</div>
      <section className="flex flex-col gap-3"><h3 className="font-semibold">참가 신청 · {project.applications.length}건</h3>{!project.applications.length && <p className="text-sm text-muted">접수된 신청이 없습니다. 참가자에게 공개 링크를 공유하세요.</p>}{project.applications.map(application => <article key={application.id} className="rounded-lg border border-hairline p-4"><div className="flex flex-wrap items-center justify-between gap-3"><strong>{application.company}</strong><Badge tone={application.status === "approved" ? "ok" : application.status === "rejected" ? "bad" : "neutral"}>{applicationStatus[application.status]}</Badge></div><p className="mt-2 text-sm">{project.booths.find(booth => booth.id === application.boothId)?.name} · {application.contactName} · {application.email}</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{application.brief}</p><div className="mt-3 flex flex-wrap gap-2">{application.status === "pending" && <><Button variant="primary" disabled={busy || !project.booths.find(booth => booth.id === application.boothId)?.available} onClick={() => void decide(application, "approved")}>참가 승인</Button><Button disabled={busy} onClick={() => void decide(application, "rejected")}>반려</Button></>}{application.status === "approved" && <Button onClick={() => setReview(application)}>부스 디자인 열기</Button>}{application.design && <Badge tone={application.design.status === "submitted" ? "accent" : "neutral"}>{application.design.status === "submitted" ? "시공 검토 제출됨" : "디자인 초안"}</Badge>}</div></article>)}</section>
      {review && credential && <section className="flex flex-col gap-4 border-t border-hairline pt-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{review.company} · 부스 디자인</h3><Button onClick={() => setReview(null)}>닫기</Button></div><BoothDesigner key={review.id} projectId={project.id} applicationId={review.id} token={credential.token} organizerDocument={document} onDocumentChange={onDocumentChange}/></section>}
    </>}
  </div>;
}
