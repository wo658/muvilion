"use client";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
/* Local data URLs are already resized; no image optimization server is needed. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { FileTextIcon, ImageIcon, LinkIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { Badge, Button } from "../ui";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Switch } from "../ui/switch";
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
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const { t, locale } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [url, setUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandNotes, setBrandNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const concept = useRef<HTMLInputElement>(null), brief = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const brandTrigger = useRef<HTMLButtonElement>(null);
  const removeTrigger = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drawingPreview = preview === activeDrawingId ? document : drawings.find(source => source.id === preview)?.document;
  const item = library.items.find(item => item.id === preview);
  useEffect(() => { if (preview) dialog.current?.showModal(); else dialog.current?.close(); }, [preview]);
  const selectedCount = library.items.filter(item => item.selected).length + Number(Boolean(document && library.drawingSelected));
  const term = query.trim().toLocaleLowerCase(locale);
  const visibleDrawings = drawings.filter(source => source.document.source.name.toLocaleLowerCase(locale).includes(term));
  const visibleReferences = library.items.filter(source => `${source.name} ${source.url ?? ""}`.toLocaleLowerCase(locale).includes(term));
  const locked = !ready || busy;
  const referencesFull = library.items.length >= 12;
  const updateItem = (id: string, update: Partial<ReferenceSource>) => onChange(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...update } : item) }));
  const add = (source: ReferenceSource) => onChange(current => SourceLibrarySchema.parse({ ...current, items: [...current.items, source] }));
  function closeBrandForm() {
    setAddingBrand(false);
    brandTrigger.current?.focus();
  }
  async function upload(file: File, kind: "concept" | "brief") {
    setUploading(true); setError(null);
    try {
      const source = await readReference(file, kind);
      const originalAssetId = await onUploadOriginal(file);
      if (alive.current) add({ ...source, originalAssetId });
    } catch (error) {
      if (alive.current) setError(error instanceof Error ? error.message : "Could not add this source.");
    } finally {
      if (alive.current) setUploading(false);
    }
  }
  return <section className="ps-sources" aria-label={t("Project sources")}>
    <header className="ps-source-summary">
      <div><h2>{t("Sources")}</h2><p>{t("Choose the materials Muse can use for this project.")}</p></div>
      <Badge>{selectedCount} {t("selected for Muse")}</Badge>
    </header>
    <Field className="ps-source-search">
      <FieldLabel htmlFor="source-search" className="sr-only">{t("Search sources")}</FieldLabel>
      <Input ref={search} id="source-search" placeholder={t("Search sources")} value={query} onChange={event => { setQuery(event.target.value); setRemoving(null); }}/>
    </Field>
    <input ref={concept} type="file" accept=".png,.jpg,.jpeg,.webp" hidden aria-label={t("Add concept image")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, "concept"); }}/>
    <input ref={brief} type="file" accept=".pdf,.txt,.md" hidden aria-label={t("Add planning document")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, "brief"); }}/>
    {uploading && <p role="status" className="ps-source-feedback">{t("Preparing source preview…")}</p>}
    {error && <p role="alert" className="ps-source-error">{localizeMessage(locale, error)}</p>}
    <section className="ps-source-group" aria-labelledby="source-drawings-heading">
      <header className="ps-source-group-heading">
        <h3 id="source-drawings-heading">{t("Drawings")} <span>{drawings.length}/12</span></h3>
        <Button disabled={locked || drawings.length >= 12} onClick={onDrawing}>{t("＋ Drawing")}</Button>
      </header>
      <p className="ps-source-description">{t("Only the current drawing is shared with Muse.")}</p>
      <ul className="ps-source-list">
        {visibleDrawings.map(source => <li key={source.id} data-current={source.id === activeDrawingId || undefined}>
          <div className="ps-source-row">
            <button className="ps-source-preview-button" onClick={() => setPreview(source.id)}>
              <span className="ps-source-thumbnail" aria-hidden="true"><img src={source.document.preview} alt="" loading="lazy"/></span>
              <span className="ps-source-identity"><strong>{source.document.source.name}</strong><small>{t("DRAWING")} · {t("Page {page} of {pages}", { page: source.document.source.page, pages: source.document.source.pages })}</small></span>
            </button>
            <div className="ps-source-row-actions">
              {source.id === activeDrawingId ? <Badge>{t("Current drawing")}</Badge> : <Button disabled={locked} onClick={() => onSwitchDrawing(source.id)}>{t("Open drawing")}</Button>}
              {source.id === activeDrawingId && <Field orientation="horizontal" className="ps-source-selection"><FieldLabel htmlFor="source-drawing-toggle">{t("Use with Muse")}</FieldLabel><Switch id="source-drawing-toggle" checked={library.drawingSelected} disabled={locked} onCheckedChange={checked => onChange(current => ({ ...current, drawingSelected: checked }))}/></Field>}
            </div>
          </div>
        </li>)}
      </ul>
      {!drawings.length && !term && <p className="ps-source-empty">{t("Add a drawing to start designing your space.")}</p>}
    </section>
    <section className="ps-source-group" aria-labelledby="source-references-heading">
      <header className="ps-source-group-heading">
        <h3 id="source-references-heading">{t("References")} <span>{library.items.length}/12</span></h3>
        <div className="ps-source-actions">
          <Button disabled={uploading || locked || referencesFull} onClick={() => concept.current?.click()}>{t("＋ Concept image")}</Button>
          <Button disabled={locked || referencesFull} aria-expanded={addingBrand} aria-controls="source-brand-form" onClick={event => { brandTrigger.current = event.currentTarget; setAddingBrand(value => !value); }}>{t("＋ Brand URL")}</Button>
          <Button disabled={uploading || locked || referencesFull} onClick={() => brief.current?.click()}>{t("＋ Brief")}</Button>
        </div>
      </header>
      <p className="ps-source-description">{t("Images, brand links and briefs shared across drawings.")}</p>
      {addingBrand && <form id="source-brand-form" className="ps-source-form" onSubmit={event => {
        event.preventDefault();
        if (locked || referencesFull) return;
        setError(null);
        try {
          const parsed = new URL(url);
          if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(t("Use an http or https URL without credentials."));
          add({ id: createSourceId(), kind: "brand", name: brandName.trim() || parsed.hostname, url: parsed.href, selected: false, text: "", notes: brandNotes, images: [] });
          closeBrandForm(); setUrl(""); setBrandName(""); setBrandNotes(""); setQuery("");
        } catch (error) { setError(error instanceof Error ? error.message : t("Check this URL.")); }
      }}>
        <h4>{t("Add brand")}</h4>
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
              <span className="ps-source-identity"><strong>{source.name}</strong><small>{source.kind === "concept" ? t("CONCEPT IMAGE") : source.kind === "brand" ? t("BRAND LINK") : t("PLANNING DOCUMENT")} · {source.url ? new URL(source.url).hostname : source.images.length ? t("{count} previews", { count: source.images.length }) : t("{count} characters", { count: source.text.length })}</small></span>
            </button>
            <div className="ps-source-row-actions">
              <Field orientation="horizontal" className="ps-source-selection"><FieldLabel htmlFor={`source-${source.id}`}>{t("Use with Muse")}</FieldLabel><Switch id={`source-${source.id}`} checked={source.selected} disabled={locked} onCheckedChange={selected => updateItem(source.id, { selected })}/></Field>
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
      <p className="ps-source-description ps-source-limits">{t("20 MB/file · PDF up to 12 pages")}</p>
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
          <Field orientation="horizontal"><FieldLabel htmlFor="preview-reference">{t("Use with Muse")}</FieldLabel><Switch id="preview-reference" disabled={locked} checked={item.selected} onCheckedChange={selected => updateItem(item.id, { selected })}/></Field>
        </div>}
      </div>
    </dialog>
  </section>;
}
