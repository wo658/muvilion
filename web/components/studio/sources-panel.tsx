"use client";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
/* Local data URLs are already resized; no image optimization server is needed. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Switch } from "../ui/switch";
import type { PlanDocument } from "@/lib/plans/schema";
import { SourceLibrarySchema, type SourceLibrary, type ReferenceSource } from "@/lib/sources/schema";
import { readReference } from "@/lib/sources/files";

type Props = {
  library: SourceLibrary; ready: boolean; document: PlanDocument | null; busy: boolean;
  onChange: (update: (current: SourceLibrary) => SourceLibrary) => void;
  onDrawing: () => void;
  onUploadOriginal: (file: File) => Promise<string>;
};
export function SourcesPanel({ library, ready, document, busy, onChange, onDrawing, onUploadOriginal }: Props) {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const { t, locale } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [url, setUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandNotes, setBrandNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const concept = useRef<HTMLInputElement>(null), brief = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const item = library.items.find(item => item.id === preview);
  useEffect(() => { if (preview) dialog.current?.showModal(); else dialog.current?.close(); }, [preview]);
  const selectedCount = library.items.filter(item => item.selected).length + Number(Boolean(document && library.drawingSelected));
  const updateItem = (id: string, update: Partial<ReferenceSource>) => onChange(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...update } : item) }));
  const add = (item: ReferenceSource) => {
    onChange(current => {
      const next = SourceLibrarySchema.parse({ ...current, items: [...current.items, item] });
      return next;
    });
  };
  async function upload(file: File, kind: "concept" | "brief") {
    setUploading(true); setError(null);
    try {
      const item = await readReference(file, kind);
      const originalAssetId = await onUploadOriginal(file);
      if (alive.current) add({ ...item, originalAssetId });
    }
    catch (error) { setError(error instanceof Error ? error.message : "Could not add this source."); }
    finally { setUploading(false); }
  }
  return <section className="ps-sources" aria-label={t("Project sources")}>
    <header><span>{library.items.length + Number(Boolean(document))} {t("materials")}</span><span>{selectedCount} {t("selected for Muse")}</span></header>
    <div className="ps-source-actions">
      <Button disabled={busy || !ready} onClick={onDrawing}>{t("＋ Drawing")}</Button>
      <Button disabled={uploading || !ready || library.items.length >= 12} onClick={() => concept.current?.click()}>{t("＋ Concept image")}</Button>
      <Button disabled={!ready || library.items.length >= 12} onClick={() => setAddingBrand(value => !value)}>{t("＋ Brand URL")}</Button>
      <Button disabled={uploading || !ready || library.items.length >= 12} onClick={() => brief.current?.click()}>{t("＋ Brief")}</Button>
    </div>
    <input ref={concept} type="file" accept=".png,.jpg,.jpeg,.webp" hidden aria-label={t("Add concept image")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, "concept"); }}/>
    <input ref={brief} type="file" accept=".pdf,.txt,.md" hidden aria-label={t("Add planning document")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, "brief"); }}/>
    <p className="ps-help">{t("20 MB/file · PDF up to 12 pages")}</p>
    {uploading && <p role="status">{t("Preparing source preview…")}</p>}
    {error && <p role="alert" className="text-sm text-bad">{localizeMessage(locale, error)}</p>}
    {addingBrand && <form className="ps-source-form" onSubmit={event => {
      event.preventDefault(); setError(null);
      try {
        const parsed = new URL(url);
        if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(t("Use an http or https URL without credentials."));
        add({ id: crypto.randomUUID(), kind: "brand", name: brandName.trim() || parsed.hostname, url: parsed.href, selected: false, text: "", notes: brandNotes, images: [] });
        setAddingBrand(false); setUrl(""); setBrandName(""); setBrandNotes("");
      } catch (error) { setError(error instanceof Error ? error.message : t("Check this URL.")); }
    }}><FieldGroup><Field><FieldLabel htmlFor="source-brand-name">{t("Brand name")}</FieldLabel><Input id="source-brand-name" value={brandName} maxLength={255} onChange={event => setBrandName(event.target.value)}/></Field><Field><FieldLabel htmlFor="source-brand-url">{t("Brand URL")}</FieldLabel><Input id="source-brand-url" type="url" placeholder="https://brand.com" required value={url} maxLength={2000} onChange={event => setUrl(event.target.value)}/></Field><Field><FieldLabel htmlFor="source-brand-notes">{t("Brand notes")}</FieldLabel><Textarea id="source-brand-notes" placeholder={t("Colours, tone, guidelines to reference…")} maxLength={6000} value={brandNotes} onChange={event => setBrandNotes(event.target.value)}/></Field></FieldGroup><p className="ps-help">{t("Link only. Add brand details in notes.")}</p><Button type="submit">{t("Add brand")}</Button> <Button type="button" variant="ghost" onClick={() => setAddingBrand(false)}>{t("Cancel")}</Button></form>}
    <ul className="ps-source-list">
      {document && <li><button className="ps-source-preview-button" onClick={() => setPreview("drawing")}><span>{t("DRAWING")}</span><strong>{document.source.name}</strong><small>{t("Page {page} of {pages}", { page: document.source.page, pages: document.source.pages })}</small></button><Field orientation="horizontal"><FieldLabel htmlFor="source-drawing-toggle">{t("Use with Muse")}</FieldLabel><Switch id="source-drawing-toggle" checked={library.drawingSelected} disabled={!ready} onCheckedChange={checked => onChange(current => ({ ...current, drawingSelected: checked }))}/></Field></li>}
      {library.items.map(source => <li key={source.id}><button className="ps-source-preview-button" onClick={() => setPreview(source.id)}><span>{source.kind === "concept" ? t("CONCEPT IMAGE") : source.kind === "brand" ? t("BRAND LINK") : t("PLANNING DOCUMENT")}</span><strong>{source.name}</strong><small>{source.url ? new URL(source.url).hostname : source.images.length ? t("{count} previews", { count: source.images.length }) : t("{count} characters", { count: source.text.length })}</small></button><Field orientation="horizontal"><FieldLabel htmlFor={`source-${source.id}`}>{t("Use with Muse")}</FieldLabel><Switch id={`source-${source.id}`} checked={source.selected} disabled={!ready} onCheckedChange={selected => updateItem(source.id, { selected })}/></Field><Button variant="ghost" aria-label={t("Remove {name}", { name: source.name })} onClick={() => { onChange(current => ({ ...current, items: current.items.filter(item => item.id !== source.id) })); if (preview === source.id) setPreview(null); }}>{t("Remove")}</Button></li>)}
    </ul>
    {!document && !library.items.length && <p className="ps-help">{t("Add a drawing, image, link or brief.")}</p>}
    <dialog ref={dialog} className="ps-source-dialog" onCancel={() => setPreview(null)} onClose={() => setPreview(null)} aria-labelledby="source-preview-title">
      <header><h2 id="source-preview-title">{preview === "drawing" ? document?.source.name : item?.name}</h2><Button onClick={() => setPreview(null)} aria-label={t("Close source preview")}>{t("Close")}</Button></header>
      {preview === "drawing" && document && <><p>{t("Original drawing preview · page")}{document.source.page}</p><img src={document.preview} alt={t("Original drawing: {name}", { name: document.source.name })}/></>}
      {item && <div className="ps-source-preview-content">
        {item.url && <><a href={item.url} target="_blank" rel="noopener noreferrer" className="text-accent break-all">{item.url} ↗</a><p>{t("Muse uses the link and notes; webpage content is not imported.")}</p></>}
        {item.images.map((image, i) => <figure key={i}><img src={image} alt={t("{name} — page {page}", { name: item.name, page: i + 1 })}/><figcaption>{item.images.length > 1 ? t("Page {page}", { page: i + 1 }) : item.name}</figcaption></figure>)}
        {item.text && <details open={!item.images.length}><summary>{t("Document text")}</summary><pre>{item.text}</pre></details>}
        <Field><FieldLabel htmlFor="source-notes">{t("Notes for Muse")}</FieldLabel><Textarea id="source-notes" value={item.notes} maxLength={6000} onChange={event => updateItem(item.id, { notes: event.target.value })}/></Field>
        <Field orientation="horizontal"><FieldLabel htmlFor="preview-reference">{t("Use with Muse")}</FieldLabel><Switch id="preview-reference" checked={item.selected} onCheckedChange={selected => updateItem(item.id, { selected })}/></Field>
      </div>}
    </dialog>
  </section>;
}
