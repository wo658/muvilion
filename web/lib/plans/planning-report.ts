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

/** Self-contained printable HTML. Bookmarks are named only; no remote resources are requested. */
export function planningReportHtml(snapshot: PlanningSnapshot, options: PlanningReportOptions, artifact?: PlanningArtifact): string {
  if (!options.title.trim()) throw new Error("Title is required.");
  const t = (key: MessageKey) => escapeHtml(translate(options.locale, key));
  const { document: plan, sources, photo } = snapshot;
  const title = escapeHtml(options.title.trim().slice(0, 200));
  const intent = options.intent.trim().slice(0, 6000);
  const dimensions = plan.widthMeters && plan.heightMeters ? `${plan.widthMeters} × ${plan.heightMeters} m` : "—";
  const references = sources.items.map(source => `<article class="reference"><h3>${escapeHtml(source.name)}</h3>${source.url ? `<p class="note">${t("Bookmark only · content was not fetched.")}</p>` : ""}${source.text ? `<p class="prose">${escapeHtml(source.text)}</p>` : ""}${source.notes ? `<p class="prose">${escapeHtml(source.notes)}</p>` : ""}${source.images.map(image => imageTag(image, source.name, "reference-image")).join("")}</article>`).join("");
  const installations = (plan.objects ?? []).map(object => `<tr><td>${escapeHtml(object.label)}</td><td>${object.width} × ${object.depth} × ${object.height}</td></tr>`).join("");
  const participation = artifact ? `<section class="page"><h2>${t("Participation guide")}</h2><p class="note">${t("Planning estimates only · fees are not confirmed offers; circulation is not a traffic simulation.")}</p>${planningBooths(artifact.basis.document).map(booth => {
    const copy = artifact.content.booths.find(b => b.id === booth.id);
    const capture = artifact.photos.find(p => p.targetId === booth.id);
    const fee = copy?.fee.amount == null ? t("Not estimated") : escapeHtml(new Intl.NumberFormat(options.locale, { style: "currency", currency: copy.fee.currency, maximumFractionDigits: 0 }).format(copy.fee.amount));
    return `<article><h3>${escapeHtml(booth.label)}</h3><p>${booth.width} × ${booth.depth} m · ${Math.round(booth.width * booth.depth * 100) / 100} m²</p>${capture ? `<figure>${imageTag(capture.image, booth.label)}<figcaption>${t("Actual 3D capture")} · ${t("Automatically framed · review composition")}${capture.shot.cutaway ? ` · ${t("Cutaway view")}` : ""}</figcaption></figure>` : `<p class="note">${t("No photo yet. Ask Muse to photograph this view.")}</p>`}<p class="prose">${escapeHtml(copy?.description ?? "")}</p><h3>${t("Planned circulation")}</h3><p class="prose">${escapeHtml(copy?.circulation || translate(options.locale, "To be reviewed"))}</p><h3>${t("Estimated participation fee")}: ${fee}</h3><p class="prose">${t("Estimate basis")}: ${escapeHtml(copy?.fee.basis ?? "")}</p><p class="prose">${t("Included provisions")}: ${escapeHtml(copy?.fee.includes ?? "")}</p><p>${t("Tax")}: ${t(copy?.fee.tax === "included" ? "Included" : copy?.fee.tax === "excluded" ? "Excluded" : "To be reviewed")}</p></article>`;
  }).join("") || `<p>${t("No booth or assignable zone in this drawing. Ask Muse to design booths first.")}</p>`}</section>` : "";
  const narrative = artifact ? artifact.content.sections.filter(s => s.id !== "intent").map(section => `<section><h2>${t(SECTION_LABELS[section.id])}</h2><p class="prose">${escapeHtml(section.text)}</p></section>`).join("") : "";
  const warnings = [
    translate(options.locale, plan.scaleConfirmed ? "Scale confirmed by the user" : "Illustrative scale · dimensions not confirmed"),
    ...(!plan.floorBoundary ? [translate(options.locale, "Floor outline not reviewed")] : []),
    ...(!plan.ceiling ? [translate(options.locale, "Ceiling height not set")] : []),
    ...(photo.shot.cutaway ? [translate(options.locale, "Cutaway view · walls are shown at reduced height.")] : []),
    ...(photo.shot.ceilingMode === "hidden" ? [translate(options.locale, "Ceiling hidden in this capture.")] : []),
    ...(!photo.shot.showStructure ? [translate(options.locale, "Structural elements hidden in this capture.")] : []),
    ...(!photo.shot.showOverhead ? [translate(options.locale, "Overhead installations hidden in this capture.")] : []),
    ...plan.warnings,
  ];
  return `<!doctype html><html lang="${options.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${title}</title><style>
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; background: ${TOKENS.surface}; color: ${TOKENS.ink}; font: 11pt/1.6 system-ui, -apple-system, "Malgun Gothic", sans-serif; overflow-wrap: anywhere; }
main { max-width: 178mm; margin: 0 auto; }
h1 { font-size: 28pt; line-height: 1.25; margin: 14mm 0 6mm; }
h2 { font-size: 17pt; margin: 10mm 0 4mm; break-after: avoid; }
h3 { font-size: 12pt; margin: 5mm 0 2mm; break-after: avoid; }
p { margin: 0 0 4mm; orphans: 3; widows: 3; }
.prose { white-space: pre-wrap; }
.note, footer { color: ${TOKENS.muted}; font-size: 9pt; }
.page { break-before: page; }
figure { margin: 5mm 0; break-inside: avoid; }
img { display: block; max-width: 100%; max-height: 220mm; object-fit: contain; margin: 3mm auto; }
.capture { width: 100%; }
.reference-image { max-height: 140mm; }
figcaption { color: ${TOKENS.muted}; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; margin: 4mm 0; }
th, td { text-align: left; padding: 3mm 2mm; border-bottom: 1px solid ${TOKENS.hairline}; vertical-align: top; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
footer { margin-top: 10mm; }
@media screen { body { padding: 24px; background: ${TOKENS.bg}; } main { padding: 12mm; background: ${TOKENS.surface}; } .screen-only { padding: 12px; background: ${TOKENS.sunken}; } }
@media print { .screen-only { display: none; } }
</style></head><body data-report-snapshot="${escapeHtml(snapshot.id)}"><main><p class="screen-only">${t(artifact ? "Document photos are saved with the project. Choose Save as PDF in the print dialog." : "In the print dialog, choose Save as PDF. Captures are kept only while this panel is open.")}</p><p class="note">muvilion · ${t("Planning report")}</p><h1>${title}</h1><p class="note">${t("Captured on")}: ${escapeHtml(snapshot.capturedAt)}<br>${t("Snapshot")}: ${escapeHtml(snapshot.id)}</p><h2>${t("Project overview")}</h2><p>${t("Drawing source")}: ${escapeHtml(plan.source.name)} · ${plan.source.page}/${plan.source.pages}<br>${escapeHtml(dimensions)}</p><h2>${t("Design intent")}</h2><p class="prose">${intent ? escapeHtml(intent) : t("No design intent supplied.")}</p><figure>${photo.image ? imageTag(photo.image, translate(options.locale, "Actual 3D capture"), "capture") : `<p>${t("No photo yet. Ask Muse to photograph this view.")}</p>`}<figcaption>${t("Actual 3D capture")}</figcaption></figure>${narrative}${participation}<section class="page"><h2>${t("Brand references")}</h2>${references || `<p>${t("No brand references supplied.")}</p>`}</section><section class="page"><h2>${t("Source drawing · reference image")}</h2><figure>${imageTag(plan.preview, plan.source.name)}<figcaption>${escapeHtml(plan.source.name)} · ${plan.source.page}/${plan.source.pages}</figcaption></figure><h2>${t("Installations")}</h2>${installations ? `<table><thead><tr><th>${t("Item")}</th><th>${t("Dimensions (m)")}</th></tr></thead><tbody>${installations}</tbody></table>` : `<p>${t("No installations in this design.")}</p>`}</section><section class="page"><h2>${t("Assumptions & items to review")}</h2><ul>${warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>${plan.ceiling ? `<p>${t("Ceiling")}: ${plan.ceiling.height} m · ${t(plan.ceiling.status)}</p>` : ""}<p>${t("Wall height (m)")}: ${plan.wallHeight ?? 3} · ${t("estimated")}</p><p>${t("Planning material only · not a construction drawing or safety certification.")}</p></section><footer>muvilion · ${title} · ${escapeHtml(snapshot.id)}</footer></main></body></html>`;
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
