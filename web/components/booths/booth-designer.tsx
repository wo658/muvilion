"use client";
import { BoothChat } from "./booth-chat";
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
import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage, type MessageKey } from "@/lib/i18n/messages";
import "../studio/studio.css";
import "../studio/spatial-design.css";
import { TOKENS } from "@/lib/ui/tokens";
const SceneView = dynamic(() => import("../studio/scene-view"), { ssr: false, loading: SceneLoading });
function SceneLoading() { const { t } = useI18n(); return <p role="status">{t("Preparing the 3D space…")}</p>; }
type Generation = { document: PlanDocument; summary: string; steps: { agent: string; tool: string; outcome: string; values?: Record<string, string | number> }[]; handoff: { notes: string[] } };
const kinds: { value: DesignObject["kind"]; label: MessageKey }[] = [{ value: "furniture", label: "Furniture" }, { value: "partition", label: "Partition" }, { value: "equipment", label: "Exhibit equipment" }, { value: "light", label: "Lighting" }, { value: "hanging-sign", label: "Hanging sign" }];
export function BoothDesigner({ projectId, applicationId, token, organizerDocument, onDocumentChange, onPreview, embedded = false, selectedObjectId, onObjectSelect }: { selectedObjectId?: string | null; onObjectSelect?: (id: string | null) => void; onPreview?: (document: PlanDocument | null) => void; embedded?: boolean; projectId: string; applicationId: string; token: string; organizerDocument?: PlanDocument; onDocumentChange?: (document: PlanDocument) => void }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<BoothApplicationAccess | null>(null);
  const [document, setDocument] = useState<PlanDocument | null>(null);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selected = selectedObjectId === undefined ? localSelected : selectedObjectId;
  function setSelected(id: string | null) { setLocalSelected(id); onObjectSelect?.(id); }
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
  const issues = useMemo(() => data && document ? validateBoothDesign(data.booth, document.objects ?? [], locale) : [], [data, document, locale]);
  useEffect(() => { onPreview?.(document); }, [document, onPreview]);
  useEffect(() => () => onPreview?.(null), [onPreview]);
  const object = document?.objects?.find(item => item.id === selected);
  const locked = busy || generating;
  function changeObjects(objects: DesignObject[]) { if (data) { setDocument(createBoothDocument(data.booth, objects)); setDirty(true); setNotice(""); } }
  function updateObject(patch: Partial<DesignObject>) { if (document) changeObjects((document.objects ?? []).map(item => item.id === selected ? { ...item, ...patch, provenance: "manual" } : item)); }
  function addObject(kind: DesignObject["kind"]) {
    if (!data || !document) return;
    const id = crypto.randomUUID();
    changeObjects([...(document.objects ?? []), { id, kind, label: (() => { const label = kinds.find(item => item.value === kind)?.label; return label ? t(label) : kind; })(), x: .5, y: .5, width: Math.min(1, data.booth.width / 2), depth: Math.min(.5, data.booth.depth / 2), height: Math.min(1, data.booth.maxHeight), elevation: 0, rotation: 0, color: TOKENS.objectDefault, provenance: "manual" }]); setSelected(id);
  }
  async function generate(designBrief = brief) {
    if (!designBrief.trim() || locked) return;
    const controller = new AbortController(); generation.current = controller;
    setGenerating(true); setError(""); setNotice(""); setProposal(null);
    try { setProposal(await boothRequest<Generation>(`${base}/design/generate`, { method: "POST", token, body: { brief: designBrief, locale }, signal: controller.signal })); }
    catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not generate the design."); else setNotice("Design request stopped. Your current draft is kept."); }
    finally { setGenerating(false); generation.current = null; }
  }
  async function save(status: "draft" | "submitted") {
    if (!document || issues.length || locked) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await boothRequest<{ application: BoothApplicationAccess["application"] }>(`${base}/design`, { method: "PATCH", token, body: { objects: document.objects ?? [], notes, buildNotes, status } });
      setData(current => current ? { ...current, application: result.application } : current); setDirty(false);
      setNotice(status === "submitted" ? "Concept submitted to the organizer for construction review." : "Booth design draft saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save."); } finally { setBusy(false); }
  }
  function exportHandoff() {
    if (!data || !document) return;
    const content = { company: data.application.company, booth: data.booth, status: "concept", notes, buildNotes, objects: document.objects ?? [], exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }));
    const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `booth-${applicationId}-concept.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className="flex flex-col gap-5">
    {error && <p role="alert" className="text-sm text-bad">{localizeMessage(locale, error)}</p>}{notice && <p role="status" className="text-sm text-accent">{localizeMessage(locale, notice)}</p>}
    {!data || !document ? <p role="status">{t("Loading the booth workspace…")}</p> : data.application.status !== "approved" ? <p>{t("You can design after your participation is approved.")}</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">{t("{name} design workspace", { name: data.booth.name })}</h3><p className="mt-1 text-sm text-muted">{t("{width} × {depth} m · installation height up to {height} m", { width: data.booth.width, depth: data.booth.depth, height: data.booth.maxHeight })}</p></div><Badge tone={dirty ? "neutral" : "ok"}>{dirty ? t("Unsaved changes") : data.application.design?.status === "submitted" ? t("Submitted for review") : t("Design draft")}</Badge></div>
      <BoothChat projectId={projectId} applicationId={applicationId} token={token} designing={locked} onDesign={text => { setBrief(text); void generate(text); }}/>
      <section className="flex flex-col gap-3">{generating && <Button onClick={() => generation.current?.abort()}>{t("Stop design request")}</Button>}
        {proposal && <div className="flex flex-col gap-3 rounded-lg bg-sunken p-4"><strong>{t("Design proposal to review")}</strong><p className="whitespace-pre-wrap text-sm">{proposal.summary}</p><p className="text-sm">{t("{count} installations · replaces the current draft.", { count: proposal.document.objects?.length ?? 0 })}</p><details><summary className="cursor-pointer text-sm">{t("Agent activity log")}</summary><ol className="mt-2 flex flex-col gap-1 text-xs text-muted">{proposal.steps.map((step, index) => <li key={index}>{localizeMessage(locale, step.agent)} · {step.tool} · {localizeMessage(locale, step.outcome, step.values)}</li>)}</ol></details><div className="flex gap-2"><Button variant="primary" disabled={locked} onClick={() => { setDocument(proposal.document); setNotes(proposal.summary); setBuildNotes(proposal.handoff.notes.join("\n")); setDirty(true); setSelected(null); setProposal(null); }}>{t("Apply this proposal")}</Button><Button onClick={() => setProposal(null)}>{t("Discard proposal")}</Button></div></div>}
      </section>
      {!embedded && <>
      <div className="flex items-center justify-between gap-3"><Segmented options={[{ id: "plan", label: t("2D editing") }, { id: "scene", label: t("3D space") }]} value={view} onChange={setView} label={t("Booth view")}/><span className="text-sm text-muted">{t("{count} installations", { count: document.objects?.length ?? 0 })}</span></div>
      <div className="ps-canvas-area relative min-h-96 overflow-hidden rounded-xl border border-hairline" style={{ height: 420 }}>{view === "plan" ? <PlanCanvas document={document} selected={selected} onSelect={setSelected} sourceOnly={false} showSourceFallback={false} drawing={false} onDraw={() => {}} measurement={null} rectangle={false}/> : <SceneView document={document} wallHeight={data.booth.maxHeight} selected={selected} onSelect={setSelected}/>}</div>
      </>}
      <details><summary className="cursor-pointer text-sm font-semibold">{t("Adjust installations manually")}</summary><div className="mt-4 flex flex-col gap-4"><div className="flex flex-wrap gap-2">{kinds.map(kind => <Button key={kind.value} disabled={locked || (document.objects?.length ?? 0) >= 80} onClick={() => addObject(kind.value)}>＋ {t(kind.label)}</Button>)}</div>
      <FieldGroup><Field><FieldLabel htmlFor={`booth-object-${applicationId}`}>{t("Installation to edit")}</FieldLabel><NativeSelect id={`booth-object-${applicationId}`} value={selected ?? ""} onChange={event => setSelected(event.target.value || null)}><option value="">{t("Select an installation")}</option>{document.objects?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect></Field></FieldGroup>
      {object && <fieldset disabled={locked} className="flex flex-col gap-4 rounded-lg border border-hairline p-4"><legend className="px-2 text-sm">{t("Edit {name}", { name: object.label })}</legend><FieldGroup><Field><FieldLabel htmlFor={`object-name-${applicationId}`}>{t("Name")}</FieldLabel><Input id={`object-name-${applicationId}`} value={object.label} maxLength={100} onChange={event => updateObject({ label: event.target.value })}/></Field></FieldGroup><div className="grid gap-3 sm:grid-cols-3">{([{ key: "width", label: t("Width (m)"), min: .1, max: data.booth.width }, { key: "depth", label: t("Depth (m)"), min: .1, max: data.booth.depth }, { key: "height", label: t("Height (m)"), min: .1, max: data.booth.maxHeight }, { key: "elevation", label: t("Height above floor (m)"), min: 0, max: data.booth.maxHeight }, { key: "x", label: t("Horizontal position (0–1)"), min: 0, max: 1 }, { key: "y", label: t("Vertical position (0–1)"), min: 0, max: 1 }] as const).map(field => <Field key={field.key}><FieldLabel htmlFor={`${applicationId}-${field.key}`}>{field.label}</FieldLabel><Input id={`${applicationId}-${field.key}`} type="number" step={field.key === "x" || field.key === "y" ? .01 : .1} min={field.min} max={field.max} value={object[field.key] ?? 0} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value) && value >= field.min && value <= field.max) updateObject({ [field.key]: value }); }}/></Field>)}</div><FieldGroup><Field><FieldLabel htmlFor={`object-color-${applicationId}`}>{t("Color")}</FieldLabel><Input id={`object-color-${applicationId}`} type="color" value={object.color} onChange={event => updateObject({ color: event.target.value })}/></Field></FieldGroup><div className="flex gap-2"><Button onClick={() => updateObject({ rotation: object.rotation === 0 ? 90 : 0 })}>{t("Rotate 90°")}</Button><Button variant="danger" onClick={() => { changeObjects((document.objects ?? []).filter(item => item.id !== object.id)); setSelected(null); }}>{t("Delete installation")}</Button></div></fieldset>}</div></details>
      {issues.length > 0 && <section role="alert" className="rounded-lg border border-hairline p-4"><strong className="text-sm text-bad">{t("Fix these before saving")}</strong><ul className="mt-2 list-disc pl-5 text-sm">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></section>}
      <FieldGroup><Field><FieldLabel htmlFor={`design-notes-${applicationId}`}>{t("Design description")}</FieldLabel><Textarea id={`design-notes-${applicationId}`} value={notes} maxLength={6000} disabled={locked} onChange={event => { setNotes(event.target.value); setDirty(true); }}/></Field><Field><FieldLabel htmlFor={`construction-notes-${applicationId}`}>{t("Construction notes · materials · electrical requirements")}</FieldLabel><Textarea id={`construction-notes-${applicationId}`} value={buildNotes} maxLength={12000} rows={4} disabled={locked} placeholder={t("Finish materials, power locations, assembly method, items to confirm with the builder")} onChange={event => { setBuildNotes(event.target.value); setDirty(true); }}/></Field></FieldGroup>
      <details><summary className="cursor-pointer text-sm font-semibold">{t("Installation list for construction review")}</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">{t("Installation")}</th><th className="p-2">{t("Width × depth × height (m)")}</th><th className="p-2">{t("Quantity")}</th></tr></thead><tbody>{document.objects?.map(item => <tr key={item.id} className="border-t border-hairline"><td className="p-2">{item.label}</td><td className="p-2">{item.width} × {item.depth} × {item.height}</td><td className="p-2">1</td></tr>)}</tbody></table></div></details>
      <p className="text-xs text-muted">{t("This is a concept for construction coordination. Structural, electrical, fire and rigging checks and a construction quote need separate review.")}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={locked || !!issues.length} onClick={() => void save("draft")}>{t("Save draft")}</Button><Button variant="primary" disabled={locked || !!issues.length || !document.objects?.length} onClick={() => void save("submitted")}>{t("Submit design for construction review")}</Button><Button disabled={!document.objects?.length} onClick={exportHandoff}>{t("Export installations · coordination material")}</Button>{organizerDocument && onDocumentChange && <Button disabled={locked || !!issues.length || !document.objects?.length} onClick={() => { try { onDocumentChange(importBoothDesignIntoVenue(organizerDocument, data.booth, applicationId, document.objects ?? [], locale)); setNotice("Applied this booth design to the whole venue."); } catch (err) { setError(err instanceof Error ? err.message : "Could not apply the design to the whole venue."); } }}>{t("Apply design to the whole venue")}</Button>}</div>
    </>}
  </div>;
}
