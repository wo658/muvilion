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
import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage } from "@/lib/i18n/messages";

const SceneView = dynamic(() => import("../studio/scene-view"), { ssr: false });
type Access = { applicationId: string; token: string };
export function ParticipantPortal({ projectId, embedded = false, active = true, selectedZoneId, onSelect, onProject, onDesignPreview, onObjectSelect, selectedObjectId }: { selectedObjectId?: string | null; onObjectSelect?: (id: string | null) => void; onDesignPreview?: (document: PlanDocument | null) => void; projectId: string; embedded?: boolean; active?: boolean; selectedZoneId?: string | null; onSelect?: (id: string) => void; onProject?: (project: PublicBoothProject) => void }) {
  const { t, locale } = useI18n();
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
      else setError(catalogue.reason instanceof Error ? catalogue.reason.message : "Could not load the recruitment details.");
      if (privateData.status === "fulfilled" && privateData.value) { setApplication(privateData.value.application); setAccess(auth); }
      else if (privateData.status === "rejected") setError("Could not open the saved application link. Reopen your correct private link or start a new application.");
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
      try { localStorage.setItem(storageKey, JSON.stringify(auth)); } catch { setNotice("Could not save in this browser. Be sure to copy and keep your private link."); }
      setNotice("Application received. Keep your private link and check your approval status.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit the application."); } finally { setBusy(false); }
  }
  const privateUrl = access && typeof window !== "undefined" ? `${window.location.origin}/participate/${projectId}#${new URLSearchParams({ application: access.applicationId, token: access.token })}` : "";
  return <div className={embedded ? "flex flex-col gap-5 p-4" : "mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-5 py-8"}>
    {!embedded && <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-semibold">muvilion</Link><span className="text-sm text-muted">{t("Participant mode")}</span></header>}
    <section><h1 className="text-xl font-semibold">{project?.title ?? t("Browse booths")}</h1><p className="mt-2 text-sm text-muted">{t("Browse priced booths and apply. After approval, you can design your booth.")}</p></section>
    {!embedded && project && <><Segmented options={[{ id: "plan", label: t("2D space") }, { id: "scene", label: t("3D space") }]} value={view} onChange={setView} label={t("Space view")}/><div className="ps-canvas-area" style={{ minHeight: 480 }}>{view === "scene" ? <SceneView document={project.space} selected={selected?.zoneId ?? null} onSelect={id => setSelected(project.booths.find(booth => booth.zoneId === id) ?? null)} wallHeight={project.space.wallHeight ?? 3}/> : <PlanCanvas document={project.space} selected={selected?.zoneId ?? null} onSelect={id => setSelected(project.booths.find(booth => booth.zoneId === id) ?? null)} sourceOnly={false} showSourceFallback={false} drawing={false} rectangle={false} onDraw={() => {}} measurement={null}/>}</div></>}
    {project && application?.status !== "approved" && <BoothChat projectId={projectId} selectedZoneId={selected?.zoneId} applicationId={access?.applicationId} token={access?.token}/>}
    {error && <p role="alert" className="text-sm text-bad">{localizeMessage(locale, error)}</p>}{notice && <p role="status" className="text-sm text-accent">{localizeMessage(locale, notice)}</p>}
    {!ready && <p role="status">{t("Loading recruitment details…")}</p>}
    {ready && !project && <Button onClick={() => { setError(""); void refresh(access).catch(err => setError(err.message)); }}>{t("Reload")}</Button>}
    {application && access && <section className="flex flex-col gap-4 rounded-xl border border-hairline p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("{company}’s application", { company: application.company })}</h2><Badge tone={application.status === "approved" ? "ok" : application.status === "rejected" ? "bad" : "neutral"}>{t(applicationStatus[application.status])}</Badge></div>
      <p className="text-sm">{t("{booth} · fee at application {price}", { booth: project?.booths.find(booth => booth.id === application.boothId)?.name ?? "", price: won(application.quotedPrice, locale) })}</p>
      <details open={application.status !== "approved"}><summary className="cursor-pointer text-sm text-muted">{t("My application · approval")}</summary><div className="mt-3 flex flex-col gap-4">
      <p className="text-sm text-muted">{application.status === "pending" ? t("The organizer is reviewing your application. After approval, you can start designing your booth below.") : application.status === "rejected" ? t("Your application was rejected. To apply for another booth, start a new application below.") : t("Your participation is approved. Design within your allocated booth and submit a draft for construction review.")}</p>
      <FieldGroup><Field><FieldLabel htmlFor="participant-private-link">{t("Private link for my application · design")}</FieldLabel><Input id="participant-private-link" readOnly value={privateUrl}/></Field></FieldGroup><p className="text-xs text-muted">{t("This link gives access to your application and design. Keep it to yourself. No automatic emails are sent.")}</p>
      <div className="flex flex-wrap gap-2"><Button onClick={() => void navigator.clipboard.writeText(privateUrl).then(() => setNotice("Private link copied.")).catch(() => setError("Copy the link directly from the link field."))}>{t("Copy private link")}</Button><Button disabled={busy} onClick={() => { setBusy(true); setError(""); void refresh(access).catch(err => setError(err.message)).finally(() => setBusy(false)); }}>{t("Refresh approval status")}</Button><Button onClick={() => { setAccess(null); setApplication(null); setSelected(null); window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); try { localStorage.removeItem(storageKey); } catch { /* Keep current state usable. */ } setNotice("You can reopen your previous application with its private link."); }}>{t("Apply for another booth")}</Button></div>
      </div></details>
      {application.status === "approved" && <BoothDesigner selectedObjectId={embedded ? selectedObjectId : undefined} onObjectSelect={onObjectSelect} embedded={embedded} onPreview={onDesignPreview} key={application.id} projectId={projectId} applicationId={application.id} token={access.token}/>}
    </section>}
    {!application && project && <>
      <section className={embedded ? "grid gap-4" : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"} aria-label={t("Available booths")}>{project.booths.map(booth => <article key={booth.id} className="flex flex-col gap-4 rounded-xl border border-hairline p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{booth.name}</h2><Badge tone={booth.available ? "accent" : "neutral"}>{booth.available ? t("Open for applications") : t("Allocated")}</Badge></div><div className="flex min-h-28 items-center justify-center rounded-lg bg-sunken"><div className="flex min-h-20 min-w-24 items-center justify-center border border-accent p-3 text-sm text-accent" style={{ aspectRatio: booth.width / booth.depth }}>{booth.width} × {booth.depth} m</div></div><strong className="text-2xl">{won(booth.price, locale)}</strong><p className="text-sm text-muted">{t("{area} m² · installation height up to {height} m", { area: (booth.width * booth.depth).toFixed(1), height: booth.maxHeight })}</p><p className="flex-1 whitespace-pre-wrap text-sm">{booth.description || t("Ask the organizer about participation terms.")}</p><Button variant={selected?.id === booth.id ? "primary" : "secondary"} disabled={!booth.available} onClick={() => { setSelected(booth); onSelect?.(booth.zoneId); }}>{selected?.id === booth.id ? t("Selected booth") : t("Apply for this booth")}</Button></article>)}</section>
      <p className="text-xs text-muted">{t("Listed amounts are participation fee guidance. No payment is made on this page.")}</p>
      {selected && <form onSubmit={event => void submit(event)} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-hairline p-5"><h2 className="text-xl font-semibold">{t("Apply for {booth}", { booth: selected.name })}</h2><p className="text-sm text-muted">{t("{price} · booth design available after approval", { price: won(selected.price, locale) })}</p><FieldGroup><Field><FieldLabel htmlFor="applicant-company">{t("Company · team name")}</FieldLabel><Input id="applicant-company" name="company" required maxLength={150}/></Field><Field><FieldLabel htmlFor="applicant-contact">{t("Contact name")}</FieldLabel><Input id="applicant-contact" name="contactName" required maxLength={100}/></Field><Field><FieldLabel htmlFor="applicant-email">{t("Contact email")}</FieldLabel><Input id="applicant-email" name="email" type="email" required maxLength={254}/></Field><Field><FieldLabel htmlFor="applicant-brief">{t("About you · exhibition plan")}</FieldLabel><Textarea id="applicant-brief" name="brief" required maxLength={6000} rows={4} placeholder={t("Tell us about your brand, the products you’ll exhibit and the space you need.")}/></Field></FieldGroup><Button type="submit" variant="primary" disabled={busy}>{busy ? t("Submitting application…") : t("Submit application")}</Button></form>}
    </>}
  </div>;
}
