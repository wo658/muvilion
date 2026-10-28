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
import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage } from "@/lib/i18n/messages";

type Credential = { projectId: string; token: string };
type OfferDraft = { name: string; price: number; maxHeight: number; description: string; selected: boolean };
type OrganizerProps = { onPublished?: (id: string | null) => void; onPricing?: (pricing: PricingContext) => void; document: PlanDocument; onDocumentChange: (document: PlanDocument) => void };
function sourceKey(document: PlanDocument) {
  return `muvilion.booth-organizer.v1:${JSON.stringify(document.source)}:${document.lines.slice(0, 5).map(line => `${line.a.x},${line.a.y},${line.b.x},${line.b.y}`).join(";")}`;
}
export function OrganizerBooths(props: OrganizerProps) { return <OrganizerBoothsInner key={sourceKey(props.document)} {...props}/>; }
function OrganizerBoothsInner({ document, onDocumentChange, onPublished, onPricing }: OrganizerProps) {
  const { t, locale } = useI18n();
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
      if (typeof auth.projectId !== "string" || typeof auth.token !== "string") throw new Error("The saved management recovery data is invalid. Enter your recovery code.");
      const result = await boothRequest<{ project: OrganizerBoothProject }>(`/api/booths/projects/${auth.projectId}`, { token: auth.token, signal: controller.signal });
      return { auth, project: result.project };
    }).then(result => { if (result && !controller.signal.aborted) { setCredential(result.auth); setProject(result.project); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => controller.abort();
  }, [key]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : "Could not complete the action."); } finally { setBusy(false); }
  }
  function remember(auth: Credential) {
    setCredential(auth);
    try { localStorage.setItem(key, JSON.stringify(auth)); } catch { setNotice("Management access cannot be saved in this browser. Copy and keep your management recovery code."); }
  }
  function addBooth() {
    const width = document.widthMeters ?? 3, depth = document.heightMeters ?? 3;
    const id = crypto.randomUUID();
    const centre = document.walkStart ?? { x: .5, y: .5 };
    onDocumentChange({ ...document, zones: [...(document.zones ?? []), { id, label: t("Participant booth {count}", { count: zones.length + 1 }), purpose: "booth", assignable: true, ...centre, width: Math.min(3, width), depth: Math.min(3, depth), rotation: 0 }] });
    setNotice("Booth zone added. Adjust its position and size below, then publish.");
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
      setNotice("Recruitment page created. Share the public link with participants.");
    });
  }
  async function decide(application: BoothApplication, status: "approved" | "rejected") {
    if (!credential) return;
    await action(async () => {
      await boothRequest(`/api/booths/projects/${credential.projectId}/applications/${application.id}`, { method: "PATCH", token: credential.token, body: { status } });
      await load(credential); setNotice(status === "approved" ? "Approved. The participant can start designing the booth from their private link." : "Application rejected.");
    });
  }
  const publicPath = project ? `/participate/${project.id}` : "";
  return <div className="flex flex-col gap-6 p-5">
    <div><p className="eyebrow">{t("SPACE DESIGN")}</p><h2 className="mt-2 text-xl font-semibold">{t("Booth pricing · applications")}</h2><p className="mt-2 text-sm text-muted">{t("Review prices with Muse, then publish. You can preview the application experience in participant mode.")}</p></div>
    {error && <p role="alert" className="text-sm text-bad">{localizeMessage(locale, error)}</p>}
    {notice && <p role="status" className="text-sm text-accent">{localizeMessage(locale, notice)}</p>}
    {restoring && <p role="status" className="text-sm text-muted">{t("Checking saved recruitment details…")}</p>}
    {!project ? <>
      <FieldGroup><Field><FieldLabel htmlFor="booth-event-title">{t("Event name")}</FieldLabel><Input id="booth-event-title" value={title} maxLength={150} onChange={event => setTitle(event.target.value)}/></Field></FieldGroup>
      {!document.scaleConfirmed && <p className="text-sm text-muted">{t("Confirm the drawing’s real-world size first.")}</p>}
      <div className="flex flex-wrap items-center gap-3"><strong>{t("{count} assignable zones", { count: zones.length })}</strong><Button disabled={!document.scaleConfirmed || (document.zones?.length ?? 0) >= 200} onClick={addBooth}>{t("Add booth zone")}</Button></div>
      {!zones.length && <p className="text-sm text-muted">{t("Add a booth zone to set its price and position.")}</p>}
      {zones.map(zone => { const value = offer(zone.id, zone.label); return <section key={zone.id} className="rounded-lg border border-hairline p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={value.selected} onChange={event => updateOffer(zone.id, zone.label, { selected: event.target.checked })}/><strong>{zone.label}</strong></label><span className="text-sm text-muted">{zone.width} × {zone.depth} m · {(zone.width * zone.depth).toFixed(1)} m²</span></div>
        <details className="mb-4"><summary className="cursor-pointer text-sm">{t("Adjust booth position · size")}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ key: "x", label: t("Centre horizontal position (m)"), value: zone.x * (document.widthMeters ?? 1), max: document.widthMeters ?? 1, min: 0 }, { key: "y", label: t("Centre vertical position (m)"), value: zone.y * (document.heightMeters ?? 1), max: document.heightMeters ?? 1, min: 0 }, { key: "width", label: t("Width (m)"), value: zone.width, max: 100, min: .1 }, { key: "depth", label: t("Depth (m)"), value: zone.depth, max: 100, min: .1 }] as const).map(field => <Field key={field.key}><FieldLabel htmlFor={`${zone.id}-${field.key}`}>{field.label}</FieldLabel><Input id={`${zone.id}-${field.key}`} type="number" min={field.min} max={field.max} step={.1} value={Number(field.value.toFixed(3))} onChange={event => { const n = event.target.valueAsNumber; if (Number.isFinite(n) && n >= field.min && n <= field.max) updateZone(zone.id, { [field.key]: field.key === "x" ? n / (document.widthMeters ?? 1) : field.key === "y" ? n / (document.heightMeters ?? 1) : n }); }}/></Field>)}</div><Button className="mt-3" onClick={() => updateZone(zone.id, { rotation: zone.rotation === 0 ? 90 : 0 })}>{t("Rotate 90° · currently {rotation}°", { rotation: zone.rotation })}</Button><p className="mt-2 text-xs text-muted">{t("The drawing’s top-left corner is the origin. Check circulation and zone positions in the whole venue before publishing.")}</p></details>
        <FieldGroup><Field><FieldLabel htmlFor={`booth-name-${zone.id}`}>{t("Public booth name")}</FieldLabel><Input id={`booth-name-${zone.id}`} value={value.name} maxLength={100} onChange={event => updateOffer(zone.id, zone.label, { name: event.target.value })}/></Field>
          <Field><FieldLabel htmlFor={`booth-price-${zone.id}`}>{t("Participation fee (KRW)")}</FieldLabel><Input id={`booth-price-${zone.id}`} type="number" min={0} max={1000000000} step={1000} value={value.price} onChange={event => updateOffer(zone.id, zone.label, { price: Number(event.target.value) })}/></Field>
          <Field><FieldLabel htmlFor={`booth-height-${zone.id}`}>{t("Installation height limit (m)")}</FieldLabel><Input id={`booth-height-${zone.id}`} type="number" min={.5} max={30} step={.1} value={value.maxHeight} onChange={event => updateOffer(zone.id, zone.label, { maxHeight: Number(event.target.value) })}/></Field>
          <Field><FieldLabel htmlFor={`booth-description-${zone.id}`}>{t("What’s included · participation terms")}</FieldLabel><Textarea id={`booth-description-${zone.id}`} value={value.description} maxLength={2000} placeholder={t("e.g. 1 kW power included, furniture extra, VAT included")} onChange={event => updateOffer(zone.id, zone.label, { description: event.target.value })}/></Field></FieldGroup>
      </section>; })}
      <p className="text-xs text-muted">{t("Shows participation fees and accepts applications. No payments are processed. Booth positions and sizes at publication become fixed participant work areas.")}</p>
      <Button variant="primary" disabled={busy || restoring || !document.scaleConfirmed || !title.trim() || !zones.some(zone => offer(zone.id, zone.label).selected)} onClick={() => void publish()}>{busy ? t("Publishing…") : t("Confirm prices · publish booths")}</Button>
      <details><summary className="cursor-pointer text-sm">{t("Restore access to an existing recruitment")}</summary><FieldGroup className="mt-3"><Field><FieldLabel htmlFor="organizer-restore">{t("Management recovery code")}</FieldLabel><Textarea id="organizer-restore" value={restoreCode} onChange={event => setRestoreCode(event.target.value)}/></Field></FieldGroup><Button className="mt-3" disabled={busy || !restoreCode.trim()} onClick={() => void action(async () => { const auth = JSON.parse(restoreCode) as Credential; if (typeof auth.projectId !== "string" || typeof auth.token !== "string" || !auth.projectId || !auth.token) throw new Error("The recovery code format is invalid."); await load(auth); remember(auth); })}>{t("Open management page")}</Button></details>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{project.title}</h3><Badge tone="ok">{t("Recruitment page published")}</Badge></div>
      <FieldGroup><Field><FieldLabel htmlFor="public-booth-link">{t("Public link for participants")}</FieldLabel><Input id="public-booth-link" readOnly value={typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`}/></Field></FieldGroup>
      <div className="flex flex-wrap gap-2"><a className="text-sm text-accent underline" href={publicPath} target="_blank" rel="noreferrer">{t("Open recruitment page ↗")}</a><Button onClick={() => void action(async () => { await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`); setNotice("Participant link copied."); })}>{t("Copy link")}</Button><Button disabled={busy} onClick={() => credential && void action(() => load(credential))}>{t("Refresh applications")}</Button></div>
      <details><summary className="cursor-pointer text-sm text-muted">{t("Keep management access")}</summary><p className="mt-2 text-xs text-muted">{t("Anyone with this code can manage the recruitment and applications. Do not share it with participants.")}</p><Button className="mt-2" onClick={() => void action(async () => { await navigator.clipboard.writeText(JSON.stringify(credential)); setNotice("Management recovery code copied."); })}>{t("Copy management recovery code")}</Button></details>
      <div className="flex flex-col gap-3">{project.booths.map(booth => <section key={booth.id} className="rounded-lg border border-hairline p-4"><div className="flex flex-wrap items-center justify-between gap-3"><strong>{booth.name}</strong><Badge tone={booth.available ? "accent" : "ok"}>{booth.available ? t("Open for applications") : t("Allocated")}</Badge></div><p className="mt-2 text-sm text-muted">{t("{width} × {depth} m · {price} · height {height} m", { width: booth.width, depth: booth.depth, price: won(booth.price, locale), height: booth.maxHeight })}</p><p className="mt-2 whitespace-pre-wrap text-sm">{booth.description}</p><details className="mt-3"><summary className="cursor-pointer text-sm">{t("Edit price · details")}</summary><form className="mt-3 flex flex-col gap-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void action(async () => { await boothRequest(`/api/booths/projects/${project.id}`, { method: "PATCH", token: credential!.token, body: { booths: project.booths.map(item => ({ id: item.id, name: item.name, price: item.id === booth.id ? Number(form.get("price")) : item.price, currency: item.currency, maxHeight: item.maxHeight, description: item.id === booth.id ? String(form.get("description")) : item.description })) } }); await load(credential!); setNotice("Price and details saved."); }); }}><FieldGroup><Field><FieldLabel htmlFor={`update-price-${booth.id}`}>{t("Participation fee (KRW)")}</FieldLabel><Input id={`update-price-${booth.id}`} name="price" type="number" min={0} step={1000} defaultValue={booth.price}/></Field><Field><FieldLabel htmlFor={`update-desc-${booth.id}`}>{t("Participation details")}</FieldLabel><Textarea id={`update-desc-${booth.id}`} name="description" maxLength={2000} defaultValue={booth.description}/></Field></FieldGroup><Button type="submit" disabled={busy}>{t("Save changes")}</Button></form></details></section>)}</div>
      <section className="flex flex-col gap-3"><h3 className="font-semibold">{t("Applications · {count}", { count: project.applications.length })}</h3>{!project.applications.length && <p className="text-sm text-muted">{t("No applications yet. Share the public link with participants.")}</p>}{project.applications.map(application => <article key={application.id} className="rounded-lg border border-hairline p-4"><div className="flex flex-wrap items-center justify-between gap-3"><strong>{application.company}</strong><Badge tone={application.status === "approved" ? "ok" : application.status === "rejected" ? "bad" : "neutral"}>{t(applicationStatus[application.status])}</Badge></div><p className="mt-2 text-sm">{project.booths.find(booth => booth.id === application.boothId)?.name} · {application.contactName} · {application.email}</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{application.brief}</p><div className="mt-3 flex flex-wrap gap-2">{application.status === "pending" && <><Button variant="primary" disabled={busy || !project.booths.find(booth => booth.id === application.boothId)?.available} onClick={() => void decide(application, "approved")}>{t("Approve participation")}</Button><Button disabled={busy} onClick={() => void decide(application, "rejected")}>{t("Reject")}</Button></>}{application.status === "approved" && <Button onClick={() => setReview(application)}>{t("Open booth design")}</Button>}{application.design && <Badge tone={application.design.status === "submitted" ? "accent" : "neutral"}>{application.design.status === "submitted" ? t("Submitted for construction review") : t("Design draft")}</Badge>}</div></article>)}</section>
      {review && credential && <section className="flex flex-col gap-4 border-t border-hairline pt-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t("{company} · booth design", { company: review.company })}</h3><Button onClick={() => setReview(null)}>{t("Close")}</Button></div><BoothDesigner key={review.id} projectId={project.id} applicationId={review.id} token={credential.token} organizerDocument={document} onDocumentChange={onDocumentChange}/></section>}
    </>}
  </div>;
}
