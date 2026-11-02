"use client";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
/* Local data URLs are already resized; no image optimization server is needed. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { FileTextIcon, ImageIcon, LinkIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "../ui";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import type { PlanDocument } from "@/lib/plans/schema";
import { SourceLibrarySchema, type SourceLibrary, type ReferenceSource } from "@/lib/sources/schema";
import { createSourceId, readReference } from "@/lib/sources/files";
import type { DrawingSource } from "@/lib/projects/schema";

type Props = {
  drawings: DrawingSource[]; activeDrawingId?: string; onSwitchDrawing: (id: string) => void;
  library: SourceLibrary; ready: boolean; document: PlanDocument | null; busy: boolean;
  onChange: (update: (current: SourceLibrary) => SourceLibrary) => void;
  onDrawing: () => void;
  onUploadOriginal: (file: File) => Promise<string>;
};

export function SourcesPanel({ drawings, activeDrawingId, onSwitchDrawing, library, ready, document, busy, onChange, onDrawing, onUploadOriginal }: Props) {
  const alive = useRef(true);
  const uploadRequest = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; uploadRequest.current?.abort(); }; }, []);
  const { t, locale } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [url, setUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandNotes, setBrandNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const concept = useRef<HTMLInputElement>(null), brief = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const removeTrigger = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drawingPreview = preview === activeDrawingId ? document : drawings.find(source => source.id === preview)?.document;
  const item = library.items.find(item => item.id === preview);
  useEffect(() => { if (preview) dialog.current?.showModal(); else dialog.current?.close(); }, [preview]);
  const term = query.trim().toLocaleLowerCase(locale);
  const visibleDrawings = drawings.filter(source => source.document.source.name.toLocaleLowerCase(locale).includes(term));
  const visibleReferences = library.items.filter(source => `${source.name} ${source.url ?? ""}`.toLocaleLowerCase(locale).includes(term));
  const locked = !ready || busy;
  const referencesFull = library.items.length >= 12;
  const updateItem = (id: string, update: Partial<ReferenceSource>) => onChange(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...update } : item) }));
  const add = (source: ReferenceSource) => onChange(current => SourceLibrarySchema.parse({ ...current, items: [...current.items, { ...source, selected: true }] }));
  function closeBrandForm() {
    setAddingBrand(false);
    addTrigger.current?.focus();
  }
  async function upload(file: File, kind: "concept" | "brief") {
    if (uploadRequest.current) return;
    const controller = new AbortController();
    uploadRequest.current = controller;
    setUploading(true); setError(null);
    try {
      const source = await readReference(file, kind, controller.signal);
      controller.signal.throwIfAborted();
      const originalAssetId = await onUploadOriginal(file);
      controller.signal.throwIfAborted();
      if (alive.current && uploadRequest.current === controller) { add({ ...source, originalAssetId }); setQuery(""); }
    } catch (error) {
      if (alive.current && !controller.signal.aborted && uploadRequest.current === controller) setError(error instanceof Error ? error.message : "Could not add this source.");
    } finally {
      if (uploadRequest.current === controller) {
        uploadRequest.current = null;
        if (alive.current) setUploading(false);
      }
    }
  }
  return <section className="ps-sources" aria-label={t("Project sources")}>
    <div className="ps-source-toolbar">
      <Field className="ps-source-search">
        <FieldLabel htmlFor="source-search" className="sr-only">{t("Search sources")}</FieldLabel>
        <Input ref={search} id="source-search" placeholder={t("Search sources")} value={query} onChange={event => { setQuery(event.target.value); setRemoving(null); }}/>
      </Field>
      <Button variant="primary" disabled={locked || uploading} aria-expanded={addingSource} aria-controls="source-add-choices" onClick={event => {
        addTrigger.current = event.currentTarget;
        setAddingSource(value => !value); setAddingBrand(false);
      }}>{t("Add source")}</Button>
    </div>
    {addingSource && <div id="source-add-choices" className="ps-source-actions" role="group" aria-label={t("Add source")}>
      <Button disabled={locked || drawings.length >= 12} onClick={() => { setAddingSource(false); onDrawing(); }}>{t("＋ Drawing")}</Button>
      <Button disabled={uploading || locked || referencesFull} onClick={() => { setAddingSource(false); addTrigger.current?.focus(); concept.current?.click(); }}>{t("＋ Concept image")}</Button>
      <Button disabled={locked || referencesFull} onClick={() => { setAddingSource(false); setAddingBrand(true); }}>{t("＋ Brand URL")}</Button>
      <Button disabled={uploading || locked || referencesFull} onClick={() => { setAddingSource(false); addTrigger.current?.focus(); brief.current?.click(); }}>{t("＋ Brief")}</Button>
      <p className="ps-source-description">{t("20 MB/file · PDF up to 12 pages")} {t("For CAD drawings, export a PDF before uploading.")}</p>
    </div>}
    <input ref={concept} type="file" accept=".png,.jpg,.jpeg,.webp" hidden aria-label={t("Add concept image")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, "concept"); }}/>
    <input ref={brief} type="file" accept=".pdf,.txt,.md" hidden aria-label={t("Add planning document")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, "brief"); }}/>
    {uploading && <div className="ps-source-feedback"><p role="status">{t("Preparing source preview…")}</p><Button onClick={() => { uploadRequest.current?.abort(); uploadRequest.current = null; setUploading(false); }}>{t("Cancel preparation")}</Button></div>}
    {error && <p role="alert" className="ps-source-error">{localizeMessage(locale, error)}</p>}
    <section className="ps-source-group" aria-labelledby="source-drawings-heading">
      <header className="ps-source-group-heading">
        <h3 id="source-drawings-heading">{t("Drawings")} <span>{drawings.length}</span></h3>
      </header>
      <ul className="ps-source-list">
        {visibleDrawings.map(source => <li key={source.id} data-current={source.id === activeDrawingId || undefined}>
          <div className="ps-source-row">
            <button className="ps-source-preview-button" onClick={() => setPreview(source.id)}>
              <span className="ps-source-thumbnail" aria-hidden="true"><img src={source.document.preview} alt="" loading="lazy"/></span>
              <span className="ps-source-identity"><strong>{source.document.source.name}</strong><small className={source.document.source.pages > 1 ? undefined : "sr-only"}>{t("DRAWING")} · {t("Page {page} of {pages}", { page: source.document.source.page, pages: source.document.source.pages })}</small></span>
            </button>
            <div className="ps-source-row-actions">
              {source.id === activeDrawingId ? <span className="ps-source-current">{t("Current drawing")}</span> : <Button disabled={locked} onClick={() => onSwitchDrawing(source.id)}>{t("Open drawing")}</Button>}
            </div>
          </div>
        </li>)}
      </ul>
      {!drawings.length && !term && <p className="ps-source-empty">{t("Add a drawing to start designing your space.")}</p>}
    </section>
    <section className="ps-source-group" aria-labelledby="source-references-heading">
      <header className="ps-source-group-heading">
        <h3 id="source-references-heading">{t("References")} <span>{library.items.length}</span></h3>
      </header>
      {addingBrand && <form id="source-brand-form" className="ps-source-form" onSubmit={event => {
        event.preventDefault();
        if (locked || referencesFull) return;
        setError(null);
        try {
          const parsed = new URL(url);
          if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(t("Use an http or https URL without credentials."));
          add({ id: createSourceId(), kind: "brand", name: brandName.trim() || parsed.hostname, url: parsed.href, selected: true, text: "", notes: brandNotes, images: [] });
          closeBrandForm(); setUrl(""); setBrandName(""); setBrandNotes(""); setQuery("");
        } catch (error) { setError(error instanceof Error ? error.message : t("Check this URL.")); }
      }}>
        <FieldGroup>
          <Field><FieldLabel htmlFor="source-brand-url">{t("Brand URL")}</FieldLabel><Input id="source-brand-url" type="url" autoFocus placeholder="https://brand.com" required value={url} maxLength={2000} onChange={event => setUrl(event.target.value)}/></Field>
          <Field><FieldLabel htmlFor="source-brand-name">{t("Brand name")}</FieldLabel><Input id="source-brand-name" value={brandName} maxLength={255} onChange={event => setBrandName(event.target.value)}/></Field>
          <Field><FieldLabel htmlFor="source-brand-notes">{t("Brand notes")}</FieldLabel><Textarea id="source-brand-notes" placeholder={t("Colours, tone, guidelines to reference…")} maxLength={6000} value={brandNotes} onChange={event => setBrandNotes(event.target.value)}/></Field>
        </FieldGroup>
        <p className="ps-source-description">{t("Link only. Add brand details in notes.")}</p>
        <footer><Button type="button" variant="ghost" onClick={closeBrandForm}>{t("Cancel")}</Button><Button type="submit" variant="primary" disabled={locked || referencesFull}>{t("Add brand")}</Button></footer>
      </form>}
      <ul className="ps-source-list">
        {visibleReferences.map(source => <li key={source.id}>
          <div className="ps-source-row">
            <button className="ps-source-preview-button" onClick={() => setPreview(source.id)}>
              <span className="ps-source-thumbnail" aria-hidden="true">{source.images[0] ? <img src={source.images[0]} alt="" loading="lazy"/> : source.kind === "brand" ? <LinkIcon/> : source.kind === "concept" ? <ImageIcon/> : <FileTextIcon/>}</span>
              <span className="ps-source-identity"><strong>{source.name}</strong><small className="sr-only">{source.kind === "concept" ? t("CONCEPT IMAGE") : source.kind === "brand" ? t("BRAND LINK") : t("PLANNING DOCUMENT")} · {source.url ? new URL(source.url).hostname : source.images.length ? t("{count} previews", { count: source.images.length }) : t("{count} characters", { count: source.text.length })}</small></span>
            </button>
            <div className="ps-source-row-actions">
              <Button variant="ghost" className="ps-source-remove" disabled={locked} aria-expanded={removing === source.id} aria-label={t("Remove {name}", { name: source.name })} onClick={event => { removeTrigger.current = event.currentTarget; setRemoving(source.id); }}><Trash2Icon aria-hidden="true"/></Button>
            </div>
          </div>
          {removing === source.id && <div className="ps-source-remove-confirm" role="group" aria-label={t("Remove this source?")}>
            <p>{t("Remove this source?")}</p><div><Button variant="ghost" autoFocus onClick={() => { setRemoving(null); removeTrigger.current?.focus(); }}>{t("Cancel")}</Button><Button variant="danger" disabled={locked} onClick={() => {
              onChange(current => ({ ...current, items: current.items.filter(item => item.id !== source.id) }));
              setRemoving(null); if (preview === source.id) setPreview(null); search.current?.focus();
            }}>{t("Remove")}</Button></div>
          </div>}
        </li>)}
      </ul>
      {!library.items.length && !term && <p className="ps-source-empty">{t("Add references to give Muse a direction.")}</p>}
    </section>
    {term && !visibleDrawings.length && !visibleReferences.length && <div className="ps-source-empty" role="status"><SearchIcon aria-hidden="true"/><strong>{t("No sources found")}</strong><Button variant="ghost" onClick={() => { setQuery(""); search.current?.focus(); }}>{t("Clear search")}</Button></div>}
    <dialog ref={dialog} className="ps-source-dialog" onCancel={() => setPreview(null)} onClose={() => setPreview(null)} aria-labelledby="source-preview-title">
      <header><h2 id="source-preview-title">{drawingPreview?.source.name ?? item?.name}</h2><Button variant="ghost" onClick={() => setPreview(null)} aria-label={t("Close source preview")}><XIcon aria-hidden="true"/></Button></header>
      <div className="ps-source-preview-body">
        {drawingPreview && <><p className="ps-source-description">{t("Original drawing preview · page")}{drawingPreview.source.page}</p><img className="ps-source-original" src={drawingPreview.preview} alt={t("Original drawing: {name}", { name: drawingPreview.source.name })}/></>}
        {item && <div className="ps-source-preview-content">
          {item.url && <div className="ps-source-link"><a href={item.url} target="_blank" rel="noopener noreferrer">{item.url} ↗</a><p>{t("Muse uses the link and notes; webpage content is not imported.")}</p></div>}
          {item.images.map((image, i) => <figure key={i}><img src={image} alt={t("{name} — page {page}", { name: item.name, page: i + 1 })}/><figcaption>{item.images.length > 1 ? t("Page {page}", { page: i + 1 }) : item.name}</figcaption></figure>)}
          {item.text && <details open={!item.images.length}><summary>{t("Document text")}</summary><pre>{item.text}</pre></details>}
          <Field><FieldLabel htmlFor="source-notes">{t("Notes for Muse")}</FieldLabel><Textarea id="source-notes" disabled={locked} value={item.notes} maxLength={6000} onChange={event => updateItem(item.id, { notes: event.target.value })}/></Field>
        </div>}
      </div>
    </dialog>
  </section>;
}
