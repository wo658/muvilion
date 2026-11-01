import { planningBooths, SECTION_LABELS, type PlanningArtifact } from "./planning-artifact";
import { PlanDocumentSchema, type PlanDocument } from "./schema";
import { PhotoCandidateSchema } from "./photography";
import type { PhotoShot } from "./photography";
import { SourceLibrarySchema, type SourceLibrary } from "@/lib/sources/schema";
import { createSourceId } from "@/lib/sources/files";
import { translate, type Locale, type MessageKey } from "@/lib/i18n/messages";
import { TOKENS } from "@/lib/ui/tokens";

export type PlanningSnapshot = Readonly<{
  id: string;
  capturedAt: string;
  document: PlanDocument;
  sources: SourceLibrary;
  photo: { shot: PhotoShot; image: string };
}>;
export type PlanningReportOptions = { title: string; intent: string; locale: Locale };

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Validate and copy just the public design inputs; no store/configuration metadata can enter the output. */
export function createPlanningSnapshot(document: PlanDocument, sources: SourceLibrary, photo: PlanningSnapshot["photo"], capturedAt = new Date().toISOString(), id: string = createSourceId()): PlanningSnapshot {
  return freeze({ id, capturedAt, document: PlanDocumentSchema.parse(document), sources: SourceLibrarySchema.parse(sources), photo: PhotoCandidateSchema.parse(photo) });
}

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const safeImage = (value: string) => /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : "";
const imageTag = (image: string, title: string, className = "") => `<img class="${className}" src="${safeImage(image)}" alt="${escapeHtml(title)}">`;

/** Self-contained printable HTML. Empty appendices do not consume a page. */
export function planningReportHtml(snapshot: PlanningSnapshot, options: PlanningReportOptions, artifact?: PlanningArtifact): string {
  if (!options.title.trim()) throw new Error("Title is required.");
  const t = (key: MessageKey) => escapeHtml(translate(options.locale, key));
  const { document: plan, sources, photo } = snapshot;
  const title = escapeHtml(options.title.trim().slice(0, 200));
  const dimensions = plan.widthMeters && plan.heightMeters ? `${plan.widthMeters} × ${plan.heightMeters} m` : "—";
  const text = (id: keyof typeof SECTION_LABELS) => artifact?.content.sections.find(s => s.id === id)?.text ?? (id === "intent" ? options.intent.trim().slice(0, 6000) : "");
  const prose = (value: string) => `<p class="prose">${escapeHtml(value)}</p>`;
  const section = (id: keyof typeof SECTION_LABELS) => text(id) ? `<section class="narrative"><h2>${t(SECTION_LABELS[id])}</h2>${prose(text(id))}</section>` : "";
  const metric = (label: string, value: string) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const caption = (capture: PlanningSnapshot["photo"]) => `${t("Actual 3D capture")} · ${t("Automatically framed · review composition")}${capture.shot.cutaway ? ` · ${t("Cutaway view")}` : ""}`;
  const captureFigure = (capture: PlanningSnapshot["photo"] | undefined, label: string, className: string) => capture?.image
    ? `<figure class="${className}">${imageTag(capture.image, label)}<figcaption>${caption(capture)}</figcaption></figure>`
    : `<p class="missing-photo">${t("No photo yet. Ask Muse to photograph this view.")}</p>`;
  const date = new Date(snapshot.capturedAt);
  const capturedDate = Number.isNaN(date.valueOf()) ? snapshot.capturedAt : new Intl.DateTimeFormat(options.locale, { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(date);
  const booths = artifact ? planningBooths(artifact.basis.document) : [];
  const participation = artifact ? (booths.length ? booths.map((booth, index) => {
    const copy = artifact.content.booths.find(b => b.id === booth.id);
    const capture = artifact.photos.find(p => p.targetId === booth.id);
    const fee = copy?.fee.amount == null ? t("Not estimated") : escapeHtml(new Intl.NumberFormat(options.locale, { style: "currency", currency: copy.fee.currency, maximumFractionDigits: 0 }).format(copy.fee.amount));
    return `<section class="page booth-page">${index === 0 ? `<h2 class="eyebrow">${t("Participation guide")}</h2>` : `<p class="eyebrow">${t("Participation guide")}</p>`}
      <h2 class="page-title">${escapeHtml(booth.label)}</h2>
      <dl class="facts">${metric(t("Dimensions (m)"), `${booth.width} × ${booth.depth} m · ${Math.round(booth.width * booth.depth * 100) / 100} m²`)}${metric(t("Estimated participation fee"), fee)}</dl>
      <div class="booth-intro">${captureFigure(capture, booth.label, "booth-photo")}<div>${copy?.description ? prose(copy.description) : ""}</div></div>
      <section class="narrative"><h3>${t("Planned circulation")}</h3>${prose(copy?.circulation || translate(options.locale, "To be reviewed"))}</section>
      <section class="terms"><h3>${t("Estimate basis")}</h3>${prose(copy?.fee.basis || translate(options.locale, "To be reviewed"))}<h3>${t("Included provisions")}</h3>${prose(copy?.fee.includes || translate(options.locale, "To be reviewed"))}<p class="note">${t("Tax")}: ${t(copy?.fee.tax === "included" ? "Included" : copy?.fee.tax === "excluded" ? "Excluded" : "To be reviewed")}</p></section>
      <p class="note">${t("Planning estimates only · fees are not confirmed offers; circulation is not a traffic simulation.")}</p></section>`;
  }).join("") : `<section class="page"><h2>${t("Participation guide")}</h2><p>${t("No booth or assignable zone in this drawing. Ask Muse to design booths first.")}</p></section>`) : "";
  const references = sources.items.length ? `<section class="page"><p class="eyebrow">muvilion · ${t("Planning report")}</p><h2 class="page-title">${t("Brand references")}</h2>${sources.items.map(source => `<article class="reference"><h3>${escapeHtml(source.name)}</h3>${source.url ? `<p class="note">${t("Bookmark only · content was not fetched.")}</p>` : ""}${source.text ? prose(source.text) : ""}${source.notes ? prose(source.notes) : ""}${source.images.map(image => imageTag(image, source.name, "reference-image")).join("")}</article>`).join("")}</section>` : "";
  const installations = (plan.objects ?? []).map(object => `<tr><td>${escapeHtml(object.label)}</td><td>${object.width} × ${object.depth} × ${object.height}</td></tr>`).join("");
  const warnings = [
    translate(options.locale, plan.scaleConfirmed ? "Scale confirmed by the user" : "Illustrative scale · dimensions not confirmed"),
    ...(!plan.floorBoundary ? [translate(options.locale, "Floor outline not reviewed")] : []),
    ...(!plan.ceiling ? [translate(options.locale, "Ceiling height not set")] : []),
    ...(photo.image && photo.shot.cutaway ? [translate(options.locale, "Cutaway view · walls are shown at reduced height.")] : []),
    ...(photo.image && photo.shot.ceilingMode === "hidden" ? [translate(options.locale, "Ceiling hidden in this capture.")] : []),
    ...(photo.image && !photo.shot.showStructure ? [translate(options.locale, "Structural elements hidden in this capture.")] : []),
    ...(photo.image && !photo.shot.showOverhead ? [translate(options.locale, "Overhead installations hidden in this capture.")] : []),
    ...plan.warnings,
  ];
  const narrative = section("intent") + section("circulation") + section("operations");
  return `<!doctype html><html lang="${options.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${title}</title><style>
@page { size: A4; margin: 16mm 16mm 19mm; @bottom-left { content: "muvilion"; font: 8pt system-ui; color: ${TOKENS.muted}; } @bottom-right { content: counter(page); font: 8pt system-ui; color: ${TOKENS.muted}; } }
* { box-sizing: border-box; }
body { margin: 0; background: ${TOKENS.surface}; color: ${TOKENS.ink}; font: 10pt/1.5 system-ui, -apple-system, "Malgun Gothic", sans-serif; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
main { max-width: 178mm; margin: 0 auto; }
h1 { font-size: 30pt; letter-spacing: -.035em; line-height: 1.18; margin: 9mm 0 5mm; }
h2 { font-size: 16pt; line-height: 1.3; margin: 7mm 0 3mm; break-after: avoid; }
h3 { font-size: 10pt; line-height: 1.4; margin: 4mm 0 1.5mm; break-after: avoid; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
.prose { white-space: pre-wrap; text-wrap: pretty; }
:lang(ko) .prose, :lang(ko) h1, :lang(ko) h2 { word-break: keep-all; overflow-wrap: anywhere; }
h1, h2 { text-wrap: balance; }
.note, figcaption, footer, dt { color: ${TOKENS.muted}; font-size: 8pt; }
.eyebrow { color: ${TOKENS.accent}; font-size: 8pt; font-weight: 650; letter-spacing: .02em; margin: 0 0 3mm; }
.page { break-before: page; }
.page-title { font-size: 23pt; letter-spacing: -.025em; margin: 0 0 5mm; }
figure { margin: 4mm 0 5mm; break-inside: avoid; }
img { display: block; max-width: 100%; object-fit: contain; }
figure img { width: 100%; border-radius: 2mm; background: ${TOKENS.sunken}; }
.hero img { height: 88mm; }
.masthead { display: flex; justify-content: space-between; align-items: baseline; gap: 8mm; padding-bottom: 4mm; border-bottom: 1.5pt solid ${TOKENS.ink}; color: ${TOKENS.muted}; font-size: 9pt; }
.wordmark { color: ${TOKENS.ink}; font-size: 15pt; font-weight: 750; letter-spacing: -.04em; }
.cover > .facts { border-top: 0; padding-top: 1mm; }
.cover > .narrative { border-left: 2pt solid ${TOKENS.accent}; padding-left: 5mm; margin-top: 7mm; }
.cover > .narrative h2 { font-size: 12pt; margin-top: 0; }
.design-narrative > .narrative { margin: 8mm 0 0; padding-top: 5mm; border-top: 1px solid ${TOKENS.hairline}; }
.design-narrative h2 { margin-top: 0; font-size: 18pt; }
.design-narrative .prose { max-width: 145mm; }
.booth-page > .facts { background: ${TOKENS.sunken}; border: 0; border-radius: 2mm; padding: 5mm; }
.booth-page > .facts dd { font-variant-numeric: tabular-nums; }
.booth-page > .facts > div + div { border-left: 1px solid ${TOKENS.hairlineStrong}; padding-left: 5mm; }
.booth-intro { display: grid; grid-template-columns: 1.15fr 1fr; gap: 6mm; align-items: start; margin: 5mm 0; }
.booth-intro figure { margin: 0; }
.booth-intro .prose { font-size: 9pt; }
.booth-photo img { height: auto; aspect-ratio: 16 / 9; }
.drawing img { max-height: 100mm; }
.reference-image { max-height: 110mm; margin: 3mm 0; }
figcaption { margin-top: 1.5mm; line-height: 1.4; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 5mm 0; padding: 4mm 0; border-top: 1px solid ${TOKENS.hairline}; border-bottom: 1px solid ${TOKENS.hairline}; break-inside: avoid; }
dt { margin: 0 0 1.5mm; } dd { margin: 0; font-size: 14pt; font-weight: 600; line-height: 1.3; }
.terms { border-top: 1px solid ${TOKENS.hairline}; margin: 4mm 0; padding-top: 1mm; }
.missing-photo { padding: 8mm; background: ${TOKENS.sunken}; color: ${TOKENS.muted}; }
table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9pt; }
th, td { text-align: left; padding: 2.5mm 2mm; border-bottom: 1px solid ${TOKENS.hairline}; vertical-align: top; }
th { color: ${TOKENS.inkSoft}; background: ${TOKENS.sunken}; font-weight: 600; }
tbody tr:nth-child(even) { background: ${TOKENS.bg}; }
td:last-child { font-variant-numeric: tabular-nums; } thead { display: table-header-group; } tr { break-inside: avoid; }
li { margin-bottom: 1.5mm; } footer { margin-top: 8mm; font-size: 7pt; }
@media screen { body { padding: 24px; background: ${TOKENS.bg}; } main { padding: 12mm; background: ${TOKENS.surface}; } .screen-only { padding: 12px; background: ${TOKENS.sunken}; } .page { margin-top: 20mm; padding-top: 10mm; border-top: 1px solid ${TOKENS.hairline}; } }
@media print { .screen-only { display: none; } }
</style></head><body data-report-snapshot="${escapeHtml(snapshot.id)}"><main>
<p class="screen-only">${t(artifact ? "Document photos are saved with the project. Choose Save as PDF in the print dialog." : "In the print dialog, choose Save as PDF. Captures are kept only while this panel is open.")}</p>
<section class="cover"><header class="masthead"><span class="wordmark">muvilion</span><span>${t("Planning report")}</span></header><h1>${title}</h1><p class="note">${escapeHtml(capturedDate)}${artifact ? ` · ${t("Planning document revision")} ${artifact.revision}` : ""}</p>
<dl class="facts">${metric(t("Dimensions (m)"), escapeHtml(dimensions))}${metric(t("Drawing source"), escapeHtml(plan.source.name))}</dl>
${captureFigure(photo, translate(options.locale, "Actual 3D capture"), "hero")}
${text("overview") ? section("overview") : `<p class="note">${t(plan.scaleConfirmed ? "Scale confirmed by the user" : "Illustrative scale · dimensions not confirmed")}</p>`}</section>
${narrative ? `<section class="page design-narrative"><p class="eyebrow">muvilion · ${t("Planning report")}</p>${narrative}</section>` : ""}
${participation}${references}
<section class="page"><p class="eyebrow">muvilion · ${t("Planning report")}</p><h2 class="page-title">${t("Source drawing · reference image")}</h2><figure class="drawing">${imageTag(plan.preview, plan.source.name)}<figcaption>${escapeHtml(plan.source.name)} · ${plan.source.page}/${plan.source.pages}</figcaption></figure><h2>${t("Installations")}</h2>${installations ? `<table><thead><tr><th>${t("Item")}</th><th>${t("Dimensions (m)")}</th></tr></thead><tbody>${installations}</tbody></table>` : `<p>${t("No installations in this design.")}</p>`}</section>
<section class="page"><p class="eyebrow">muvilion · ${t("Planning report")}</p><h2 class="page-title">${t("Assumptions & items to review")}</h2>${text("notes") ? prose(text("notes")) : ""}<ul>${warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>${plan.ceiling ? `<p>${t("Ceiling")}: ${plan.ceiling.height} m · ${t(plan.ceiling.status)}</p>` : ""}<p>${t("Wall height (m)")}: ${plan.wallHeight ?? 3} · ${t("estimated")}</p><p class="note">${t("Planning material only · not a construction drawing or safety certification.")}</p><footer>${t("Snapshot")}: ${escapeHtml(snapshot.id)} · ${t("Captured on")}: ${escapeHtml(snapshot.capturedAt)}</footer></section>
</main></body></html>`;
}

/** Called after opening the popup synchronously in a click handler. Keep it available for review/reprint. */
export async function printPlanningReport(popup: Window, html: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    await Promise.race([
      Promise.all([popup.document.fonts.ready, ...Array.from(popup.document.images).map(image => image.decode())]),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Report images could not load. Capture again and retry.")), 20_000); }),
      new Promise<never>((_, reject) => { onAbort = () => reject(signal.reason); signal.addEventListener("abort", onAbort, { once: true }); }),
    ]);
    signal.throwIfAborted();
    if (popup.closed) throw new Error("The planning PDF could not be prepared. Please try again.");
    popup.focus();
    popup.print();
  } catch (cause) {
    popup.close();
    if (signal.aborted) throw cause;
    throw new Error("Report images could not load. Capture again and retry.", { cause });
  } finally {
    if (timeout) clearTimeout(timeout);
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}
