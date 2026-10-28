"use client";
import { MuviAvatar } from "@/components/muvi/muvi-avatar";
import type { PublicBoothProject } from "@/lib/booths/schema";
import type { PricingContext } from "@/lib/booths/pricing";

import { NativeSelect } from "../ui/native-select";
import { Input } from "../ui/input";
import dynamic from "next/dynamic";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
import { AppSettings } from "../app-settings";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { cropPlan } from "@/lib/plans/crop";
import { boothExample } from "@/lib/booths/example";
import { Badge, Button, Segmented } from "../ui";
import { PlanCanvas } from "./plan-canvas";
import { StudioChat } from "./studio-chat";
import { SourcesPanel } from "./sources-panel";
import { SourceLibrarySchema, type SourceLibrary } from "@/lib/sources/schema";
import { ProjectWorkspace, RailButton, type ProjectControls } from "./project-workspace";
import { ProjectDialog } from "./project-dialog";
import { createPortal } from "react-dom";
import type { Project } from "@/lib/projects/schema";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { EllipsisIcon, FileImageIcon, SettingsIcon, StoreIcon } from "lucide-react";


import { designWarnings } from "@/lib/plans/design";
import "./studio.css";
import "./spatial-design.css";
import "./sources.css";
import { TOKENS } from "@/lib/ui/tokens";
const SceneView = dynamic(() => import("./scene-view"), { ssr: false, loading: SceneLoading });
const OrganizerBooths = dynamic(() => import("../booths/organizer-booths").then(module => module.OrganizerBooths), { ssr: false, loading: BoothsLoading });
const ParticipantPortal = dynamic(() => import("../booths/participant-portal").then(module => module.ParticipantPortal), { ssr: false });
type Point = {
    x: number;
    y: number;
};

export function Studio() {
    return <ProjectWorkspace editor={StudioEditor}/>;
}
function StudioEditor({ project, controls }: { project: Project; controls: ProjectControls }) {
    const [designRole, setDesignRole] = useState<"space" | "booth">("space");
    const [publishedId, setPublishedId] = useState<string | null>(null);
    const [publicProject, setPublicProject] = useState<PublicBoothProject | null>(null);
    const [boothDocument, setBoothDocument] = useState<PlanDocument | null>(null);
    const [boothSelection, setBoothSelection] = useState<string | null>(null);
    const [focusBooth, setFocusBooth] = useState(true);
    const [boothPricing, setBoothPricing] = useState<PricingContext>([]);
    const spaceMode = designRole === "space";
    const { t, locale } = useI18n();
    const [settings, setSettings] = useState<string | null>(null);
    // Start with Muse docked on phones so the plan stays visible; the editor only renders client-side.
    const [chatOpen, setChatOpen] = useState(() => window.matchMedia("(min-width: 800px)").matches);
    const [sources, setSources] = useState<SourceLibrary>(project.state.sources);
    const sourcesRef = useRef(sources);
    const sourcesReady = true;
    const originalDrawing = useRef(project.state.originalDrawingId);
    const [sourceError, setSourceError] = useState<string | null>(null);
    const [markingEntrance, setMarkingEntrance] = useState(false);
    const [document, setDocument] = useState<PlanDocument | null>(project.state.document);
    const [details, setDetails] = useState(false);
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const [boothsOpen, setBoothsOpen] = useState(false);
    const [floorDraft, setFloorDraft] = useState<Point[] | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [history, setHistory] = useState<PlanDocument[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [width, setWidth] = useState(project.state.document?.widthMeters?.toString() ?? "");
    const [height, setHeight] = useState(project.state.document?.heightMeters?.toString() ?? "");
    const wallHeight = document?.wallHeight ?? 3;
    const [drawing, setDrawing] = useState(false);
    const [calibrating, setCalibrating] = useState(false);
    const [cropping, setCropping] = useState(false);
    const [measure, setMeasure] = useState<[
        Point,
        Point
    ] | null>(null);
    const [distance, setDistance] = useState("");
    const [chatKey, setChatKey] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const restoreInput = useRef<HTMLInputElement>(null);
    const request = useRef<AbortController | null>(null);
    const planRef = useRef(document);
    const changeSources = (update: (current: SourceLibrary) => SourceLibrary) => {
        try {
            const next = SourceLibrarySchema.parse(update(sourcesRef.current));
            sourcesRef.current = next; setSources(next); setSourceError(null);
            controls.change({ projectVersion: 1, document: planRef.current, sources: next, originalDrawingId: originalDrawing.current });
        } catch (error) { setSourceError(error instanceof Error ? error.message : "Could not update sources."); }
    };
    useEffect(() => {
        return () => request.current?.abort();
    }, []);
    const save = useCallback((next: PlanDocument | null) => {
        controls.change({ projectVersion: 1, document: next, sources: sourcesRef.current, originalDrawingId: originalDrawing.current });
    }, [controls]);
    const extractRef = useRef<typeof extract | null>(null);
    useEffect(() => {
        if (!project.state.originalDrawingId) return;
        const controller = new AbortController();
        void fetch(`/api/projects/${project.id}/assets/${project.state.originalDrawingId}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error("Could not restore the original drawing file.");
                const blob = await response.blob();
                const stored = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
                const file = new File([blob], project.state.document?.source.name ?? (stored ? decodeURIComponent(stored) : "drawing.pdf"), { type: blob.type });
                if (controller.signal.aborted || originalDrawing.current !== project.state.originalDrawingId) return;
                // Seeded samples keep only the original; read it the first time the project opens.
                if (!project.state.document) void extractRef.current?.(file, project.state.originalDrawingPage ?? 1, project.state.originalDrawingId!);
                else setSourceFile(file);
            }).catch(error => { if (!controller.signal.aborted) setNotice(error.message); });
        return () => controller.abort();
    }, [project.id, project.state.originalDrawingId, project.state.document, project.state.originalDrawingPage]);
    const change = useCallback((next: PlanDocument) => {
        const previous = planRef.current;
        if (previous)
            setHistory((items) => [...items.slice(-19), previous]);
        planRef.current = next;
        setDocument(next);
        save(next);
    }, [save]);
    const openDocument = (next: PlanDocument) => {
        planRef.current = next;
        setDocument(next);
        setFloorDraft(null);
        setHistory([]);
        setSelected(null);
        setDrawing(false);
        setCalibrating(false);
        setCropping(false);
        setMeasure(null);
        setWidth(next.widthMeters?.toString() ?? "");
        setHeight(next.heightMeters?.toString() ?? "");
        setMarkingEntrance(false);
        setChatKey((k) => k + 1);
        save(next);
    };
    const extract = async (file: File, page = 1, storedAssetId?: string) => {
        if (file.size > 20 * 1024 * 1024) {
            setError(t("Please choose a file smaller than 20 MB."));
            return;
        }
        if (!/\.(pdf|png|jpe?g|dxf)$/i.test(file.name)) {
            setError(t("Choose a PDF, PNG, JPG or DXF drawing."));
            return;
        }
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError(null);
        setSourceFile(file);
        try {
            const assetId = storedAssetId ?? await controls.upload(file);
            if (controller.signal.aborted) return;
            const form = new FormData();
            form.set("file", file);
            form.set("page", String(page));
            const response = await fetch("/api/plans/extract", { method: "POST", body: form, signal: controller.signal });
            const data = await response.json();
            if (!response.ok)
                throw new Error(typeof data.message === "string" ? data.message : typeof data.detail === "string" ? data.detail : typeof data.error === "string" ? data.error : "We could not read this drawing. Please try another file.");
            if (!controller.signal.aborted) {
                const plan = PlanDocumentSchema.parse(data);
                originalDrawing.current = assetId;
                openDocument(plan);
            }
        }
        catch (err) {
            if (!controller.signal.aborted)
                setError(err instanceof Error ? err.message : t("Could not read the drawing."));
        }
        finally {
            if (request.current === controller) {
                setBusy(false);
                request.current = null;
            }
        }
    };
    useEffect(() => { extractRef.current = extract; });
    const undo = () => {
        const previous = history[history.length - 1];
        if (!previous)
            return;
        setHistory((items) => items.slice(0, -1));
        planRef.current = previous;
        setDocument(previous);
        save(previous);
        setWidth(previous.widthMeters?.toString() ?? "");
        setHeight(previous.heightMeters?.toString() ?? "");
    };
    const exportPlan = () => { void controls.export().catch(error => setError(error.message)); };
    const restore = (raw: string) => { void controls.import(raw).catch(error => setError(error instanceof Error ? error.message : "Could not import project. Your current work has been kept.")); };
    const selectedLine = document?.lines.find((line) => line.id === selected);
    const selectedItem = document?.objects?.find(item => item.id === selected)
        ?? document?.zones?.find(item => item.id === selected)
        ?? document?.entrances?.find(item => item.id === selected);
    const selection = selectedItem ? { id: selectedItem.id, label: selectedItem.label }
        : selectedLine ? { id: selectedLine.id, label: selectedLine.kind === "wall" ? t("Wall") : t("Drawing element") } : null;
    const issues = document ? designWarnings(document, locale) : [];
    const removeSelection = () => {
        if (!document || !selected) return;
        change({ ...document,
            lines: document.lines.filter(line => line.id !== selected),
            entrances: document.entrances?.filter(item => item.id !== selected),
            zones: document.zones?.filter(item => item.id !== selected),
            objects: document.objects?.filter(item => item.id !== selected).map(item => item.zoneId === selected ? { ...item, zoneId: undefined } : item),
        });
        setSelected(null);
    };
    const cropSpace = async (a: Point, b: Point) => {
        if (!document || busy)
            return;
        setBusy(true);
        setError(null);
        try {
            const next = await cropPlan(document, a, b);
            change(next);
            setSelected(null);
            setMeasure(null);
            setWidth(next.widthMeters?.toString() ?? "");
            setHeight(next.heightMeters?.toString() ?? "");
            setChatKey((k) => k + 1);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("Could not crop this space."));
        }
        finally {
            setBusy(false);
            setCropping(false);
        }
    };
    const drawWall = (a: Point, b: Point) => {
        if (!document)
            return;
        change({ ...document, lines: [...document.lines, { id: `manual-${crypto.randomUUID()}`, a, b, kind: "wall", origin: "manual", confidence: 1 }] });
    };
    const calibrate = () => {
        if (!document || !measure || !(Number(distance) > 0))
            return;
        const pixels = Math.hypot((measure[1].x - measure[0].x) * document.source.width, (measure[1].y - measure[0].y) * document.source.height);
        if (pixels < 3) {
            setError(t("Choose a longer segment for reliable calibration."));
            return;
        }
        const w = document.source.width / pixels * Number(distance), h = document.source.height / pixels * Number(distance);
        if (w > 2000 || h > 2000) {
            setError(t("The resulting extent is too large. Check the segment and its distance."));
            return;
        }
        change({ ...document, widthMeters: w, heightMeters: h, scaleConfirmed: true });
        setWidth(w.toFixed(2));
        setHeight(h.toFixed(2));
        setCalibrating(false);
        setMeasure(null);
    };
    const finishFloor = () => {
        if (!document || !floorDraft)
            return;
        const result = PlanDocumentSchema.safeParse({ ...document, floorBoundary: floorDraft, walkStart: undefined });
        if (!result.success) {
            setError(t("Trace at least three corners around the interior without crossing the outline."));
            return;
        }
        change(result.data);
        setFloorDraft(null);
    };
    const calibrated = document?.scaleConfirmed && document.widthMeters && document.heightMeters;
    const editingBooth = !spaceMode && focusBooth && !!boothDocument;
    const canvasSelection = editingBooth ? boothSelection : selected;
    const selectCanvas = editingBooth ? setBoothSelection : setSelected;
    const visibleDocument = !spaceMode && focusBooth && boothDocument ? boothDocument : !spaceMode && publicProject && publicProject.id === publishedId ? publicProject.space : document;
    const museCollapsed = Boolean(document) && !chatOpen;
    // The workspace is 3D; the 2D plan appears only while a drawing setup tool needs it.
    const planTools = spaceMode && (details || markingEntrance || drawing || calibrating || cropping || floorDraft !== null);
    const [toolbarEnd, setToolbarEnd] = useState<HTMLDivElement | null>(null);
    const roleToggle = <Segmented options={[{ id: "space", label: t("Organize") }, { id: "booth", label: t("Participate") }]} value={designRole} onChange={role => { setDesignRole(role); setChatOpen(true); setMarkingEntrance(false); setFloorDraft(null); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }} label={t("Design mode")}/>;
    return <main className={`ps-studio ${spaceMode && details ? "ps-detail-view" : "ps-simple-view"} ${document ? "ps-has-plan" : "ps-conversation-only"}${museCollapsed ? " ps-muse-collapsed" : ""}`}>

    {controls.sidebar && createPortal(<>
      <RailButton icon={<SettingsIcon/>} label={t("Settings")} onClick={() => setSettings("general")}/>
    </>, controls.sidebar)}
    {!document && <div className="ps-design-mode-bar">{roleToggle}</div>}
    <AppSettings section={settings} onSectionChange={setSettings} sections={spaceMode ? [


      { id: "project", label: t("Project"), content: <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2"><h3 className="font-semibold">{t("Export project")}</h3><p className="ps-help">{t("Download this project and its original files as one JSON bundle.")}</p><Button className="self-start" variant="primary" onClick={exportPlan} disabled={busy || !sourcesReady}>{t("Export")}</Button></section>
        <section className="flex flex-col gap-2"><h3 className="font-semibold">{t("Import project")}</h3><p className="ps-help">{t("Open an exported JSON bundle as a new project. The current project is kept.")}</p><Button className="self-start" disabled={!sourcesReady} onClick={() => { setSettings(null); restoreInput.current?.click(); }}>{t("Import project")}</Button></section>
      </div> },
    ] : []}/>

    <ProjectDialog open={sourcesOpen} title={t("Sources")} onClose={() => setSourcesOpen(false)}>
      <SourcesPanel onUploadOriginal={controls.upload} library={sources} ready={sourcesReady} document={document} busy={busy} onChange={changeSources} onDrawing={() => { setSourcesOpen(false); input.current?.click(); }}/>
      {sourceError && <p role="alert" className="p-4 text-sm text-bad">{localizeMessage(locale, sourceError)}</p>}
    </ProjectDialog>
    {spaceMode && document && <ProjectDialog open={boothsOpen} title={t("Booth pricing · applications")} onClose={() => setBoothsOpen(false)}>
      <OrganizerBooths document={document} onDocumentChange={change} onPublished={setPublishedId} onPricing={setBoothPricing}/>
    </ProjectDialog>}
    <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file)
        void extract(file); e.target.value = ""; }}/>
    <input ref={restoreInput} type="file" accept=".json" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file && file.size <= 400 * 1024 * 1024)
        restore(await file.text());
    else if (file)
        setError(t("Plan file must be smaller than 32 MB.")); e.target.value = ""; }}/>
    <div className="ps-workspace">
      <aside className="ps-sidebar" hidden={!details || !spaceMode}>
        <div id="drawing-details" className="ps-drawing-controls" hidden={!details || !spaceMode}>
        <section className="ps-section"><div className="ps-section-heading"><h2>{t("Drawing setup")}</h2><Button variant="ghost" onClick={() => { setDetails(false); setFloorDraft(null); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }}>{t("Close")}</Button></div>
          {document && document.source.pages > 1 && <label className="ps-field">{t("Drawing page")}<NativeSelect value={document.source.page} disabled={busy || !sourceFile} onChange={(e) => { if (sourceFile)
        void extract(sourceFile, Number(e.target.value)); }}>{Array.from({ length: document.source.pages }, (_, i) => <option key={i} value={i + 1}>{t("Page {page}", { page: i + 1 })}</option>)}</NativeSelect>{!sourceFile && <small>{t("Re-upload the source to change pages.")}</small>}</label>}
          {document && <><Button variant={cropping ? "primary" : "secondary"} disabled={busy} onClick={() => { setMarkingEntrance(false); setFloorDraft(null); setCropping((v) => !v); setCalibrating(false); setDrawing(false); setMeasure(null); }}>{cropping ? t("Cancel crop") : t("Crop to space")}</Button>{cropping && <p className="ps-help" style={{ marginTop: 9 }}>{t("Click opposite corners of one space. Cropping clears design objects; use Undo to restore.")}</p>}</>}
        </section>
        <section className="ps-section"><div className="ps-section-heading"><h2>{t("Real-world scale")}</h2>{calibrated ? <Badge tone="ok">{t("Confirmed")}</Badge> : <span className="ps-small-muted">{t("Needs review")}</span>}</div><p className="ps-help">{t("Pick a known distance on the drawing to set its scale.")}</p>
          <Button disabled={!document || busy} variant={calibrating ? "primary" : "secondary"} onClick={() => { setMarkingEntrance(false); setFloorDraft(null); setCalibrating((v) => !v); setDrawing(false); setCropping(false); setMeasure(null); }}>{calibrating ? t("Cancel measurement") : t("Measure two points")}</Button>
          {calibrating && <div className="ps-calibration"><p className="ps-help">{measure ? t("Enter the real distance between your two points.") : t("Click both ends of a known dimension on the plan.")}</p><label className="ps-field">{t("Known distance (m)")}<Input type="number" min="0.01" step="0.01" value={distance} onChange={(e) => setDistance(e.target.value)}/></label><Button variant="primary" disabled={!measure || !(Number(distance) > 0)} onClick={calibrate}>{t("Apply scale")}</Button></div>}
          <p className="ps-help" style={{ marginTop: 15 }}>{t("Or enter the full drawing extent:")}</p>
          <div className="ps-dimensions"><label className="ps-field">{t("Width")}<Input aria-label={t("Drawing width in metres")} type="number" min="0.1" max="2000" step="0.01" value={width} placeholder="—" disabled={!document || busy} onChange={(e) => { setWidth(e.target.value); if (document?.scaleConfirmed)
        change({ ...document, scaleConfirmed: false }); }}/><span>m</span></label><label className="ps-field">{t("Depth")}<Input aria-label={t("Drawing depth in metres")} type="number" min="0.1" max="2000" step="0.01" value={height} placeholder="—" disabled={!document || busy} onChange={(e) => { setHeight(e.target.value); if (document?.scaleConfirmed)
        change({ ...document, scaleConfirmed: false }); }}/><span>m</span></label></div>
          <Button disabled={!document || busy || !(Number(width) > 0 && Number(width) <= 2000 && Number(height) > 0 && Number(height) <= 2000)} onClick={() => { if (document)
        change({ ...document, widthMeters: Number(width), heightMeters: Number(height), scaleConfirmed: true }); }}>{t("Confirm dimensions")}<span>✓</span></Button>
        </section>
        {document && <section className="ps-section"><div className="ps-section-heading"><h2>{t("Interior floor outline")}</h2></div><p className="ps-help">{document.floorBoundary ? t("{count} corners reviewed. This boundary defines the floor, not walls.", { count: document.floorBoundary.length }) : t("Trace the interior footprint to define usable floor and ceiling surfaces.")}</p><Button disabled={busy} onClick={() => { setMarkingEntrance(false); setFloorDraft(floorDraft ? null : []); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }}>{floorDraft ? t("Cancel outline") : t("Trace floor outline")}</Button>{floorDraft && <><p className="ps-help">{t("Click corners in order around the inside perimeter.")}{floorDraft.length} {t("points selected.")}</p><Button disabled={floorDraft.length < 3} onClick={finishFloor}>{t("Use floor outline")}</Button><Button variant="ghost" disabled={!floorDraft.length} onClick={() => setFloorDraft(floorDraft.slice(0, -1))}>{t("Undo point")}</Button></>}{document.floorBoundary && !floorDraft && <Button variant="ghost" onClick={() => change({ ...document, floorBoundary: undefined, walkStart: undefined })}>{t("Clear outline")}</Button>}</section>}

        {document && <section className="ps-section"><div className="ps-section-heading"><h2>{t("Space height")}</h2></div><p className="ps-help">{t("Enter a measured height. A drawing alone cannot confirm it.")}</p>
          <label className="ps-field">{t("Wall height (m)")}<Input type="number" min="0.5" max="30" step="0.1" value={wallHeight} onChange={event => { const n = event.target.valueAsNumber; if (n >= 0.5 && n <= 30) change({ ...document, wallHeight: n }); }}/></label>
          {document.ceiling ? <><label className="ps-field">{t("Ceiling height (m)")}<Input type="number" min="0.1" max="30" step="0.1" value={document.ceiling.height} onChange={event => { const n = event.target.valueAsNumber; if (n >= 0.1 && n <= 30) change({ ...document, ceiling: { ...document.ceiling!, height: n, status: "estimated" } }); }}/></label><Button disabled={document.ceiling.status === "confirmed"} onClick={() => change({ ...document, ceiling: { ...document.ceiling!, status: "confirmed" } })}>{document.ceiling.status === "confirmed" ? t("Ceiling height confirmed") : t("Confirm measured ceiling height")}</Button></> : <Button disabled={!calibrated} onClick={() => change({ ...document, ceiling: { height: 4, status: "estimated", color: TOKENS.modelShade } })}>{t("Set ceiling height")}</Button>}
        </section>}
        </div>
      </aside>
      <section className="ps-center" aria-label={t("Drawing workspace")} hidden={!document}>
        <div className="ps-canvas-toolbar">
          {roleToggle}
          {!spaceMode && boothDocument && <><span className="ps-toolbar-divider" aria-hidden/><Segmented options={[{ id: "booth", label: t("My booth") }, { id: "venue", label: t("Whole venue") }]} value={focusBooth ? "booth" : "venue"} onChange={value => setFocusBooth(value === "booth")} label={t("Booth work scope")}/></>}
          {spaceMode && document && <Popover>
            <PopoverTrigger render={<Button variant="ghost" className="ps-icon-button" aria-label={t("More tools")} title={t("More tools")}/>}><EllipsisIcon/></PopoverTrigger>
            <PopoverContent align="end" className="ps-tools-menu">
              <Button variant="ghost" disabled={!history.length || busy} onClick={undo}>{t("Undo")}</Button>
              <Button variant="ghost" aria-expanded={details} aria-controls="drawing-details" onClick={() => { setDetails(value => !value); setFloorDraft(null); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }}>{calibrated ? t("Drawing settings") : t("Confirm scale")}</Button>
              <Button variant={markingEntrance ? "primary" : "ghost"} disabled={busy || (document.entrances?.length ?? 0) >= 30} onClick={() => { setMarkingEntrance(value => !value); setDrawing(false); setCalibrating(false); setCropping(false); setFloorDraft(null); }}>{markingEntrance ? t("Choose position · cancel") : t("Mark entrance")}</Button>
            </PopoverContent>
          </Popover>}
          {spaceMode && document && <>
            <Button variant="ghost" onClick={() => setSourcesOpen(true)}><FileImageIcon/><span>{t("Sources")}</span></Button>
            <Button variant="ghost" onClick={() => setBoothsOpen(true)}><StoreIcon/><span>{t("Booth pricing · applications")}</span></Button>
          </>}
          <div ref={setToolbarEnd} className="ps-toolbar-end"/>
        </div>

        {error && <div className="ps-alert" role="alert"><span>{localizeMessage(locale, error)}</span><Button onClick={() => setError(null)} aria-label={t("Dismiss error")}>×</Button></div>}
        {notice && <div className="ps-notice" role="status">{localizeMessage(locale, notice)}</div>}
        <div className="ps-canvas-area">
          {document ? !planTools ? <><SceneView toolbar={toolbarEnd} document={visibleDocument!} wallHeight={visibleDocument?.wallHeight ?? wallHeight} selected={canvasSelection} onSelect={selectCanvas}/>{spaceMode && details && <div className="ps-scene-note">{calibrated ? t("Scale confirmed") : t("Illustrative scale · confirm dimensions")} {t("· ceiling")}{document.ceiling ? `${document.ceiling.height} m (${t(document.ceiling.status)})` : t("not set")} {t("· wall thickness inferred")}</div>}</> : <PlanCanvas key={`${chatKey}-${drawing}-${calibrating}-${cropping}`} document={visibleDocument!} onEntrancePoint={markingEntrance ? point => { const id = crypto.randomUUID(); change({ ...document, entrances: [...(document.entrances ?? []), { id, label: t("Entrance {count}", { count: (document.entrances?.length ?? 0) + 1 }), ...point, rotation: 0 }] }); setMarkingEntrance(false); setSelected(id); } : undefined} floorDraft={floorDraft} onBoundaryPoint={floorDraft ? (point) => setFloorDraft([...floorDraft, point].slice(0, 128)) : undefined} selected={canvasSelection} onSelect={selectCanvas} sourceOnly={false} showOriginal={false} showSourceFallback={spaceMode} drawing={spaceMode && (drawing || calibrating || cropping)} rectangle={cropping} onDraw={!spaceMode ? () => {} : cropping ? (a, b) => void cropSpace(a, b) : calibrating ? (a, b) => setMeasure([a, b]) : drawWall} measurement={measure}/> : null}
          {busy && <div className="ps-loading" role="status"><div className="ps-spinner"/><strong>{cropping ? t("Cropping your space") : t("Reading your drawing")}</strong><span>{cropping ? t("Keeping geometry inside the selected area.") : t("Extracting geometry and preparing the source preview.")}</span>{!cropping && <Button onClick={() => { request.current?.abort(); setBusy(false); }}>{t("Cancel")}</Button>}</div>}
        </div>
        <div className="ps-bottom-toolbar"><div className="ps-tool-buttons" hidden={!details || !spaceMode}><Button variant={drawing ? "primary" : "ghost"} disabled={!document || !planTools || busy || (document.lines.length >= 100000)} onClick={() => { setMarkingEntrance(false); setFloorDraft(null); setDrawing((v) => !v); setCalibrating(false); setCropping(false); setMeasure(null); }}>{drawing ? t("Finish drawing") : t("+ Draw wall")}</Button><Button variant="ghost" disabled={!history.length || busy} onClick={undo}>{t("↶ Undo")}</Button></div><span>{floorDraft ? t("Click the interior corners, then Use floor outline") : cropping ? t("Click opposite corners of the space to keep") : calibrating ? t("Click two points along a known dimension") : drawing ? t("Click two endpoints · Esc cancels the segment") : !planTools ? t("Drag to orbit · scroll to zoom") : document ? t("Select an item and ask Muse") : t("Start with a drawing or explore the demo")}</span></div>

        {spaceMode && details && document?.warnings.length ? <details className="ps-warnings"><summary>{t("{count} source notes to review", { count: document.warnings.length })}</summary><ul>{document.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details> : null}
      </section>
      <aside id="muse-panel" className="ps-right-panel" aria-label="Muse" data-collapsed={museCollapsed ? "" : undefined} onKeyDown={event => { if (event.key === "Escape" && document) setChatOpen(false); }}>
        {museCollapsed && <button type="button" className="ps-muse-launcher" aria-expanded={false} aria-controls="muse-panel" aria-label={t("Talk to Muse")} title={selection ? selection.label : t("Talk to Muse")} onClick={() => setChatOpen(true)}><MuviAvatar size={40}/></button>}
        <div hidden={!spaceMode} className="ps-role-panel">
          {!document && <div className="p-5"><Button onClick={() => openDocument(boothExample())}>{t("Start with the booth design example")}</Button></div>}
          <StudioChat boothPricing={boothPricing} sources={sources} document={document} onDocumentChange={change} onSources={() => setSourcesOpen(true)} selection={selection} onClearSelection={() => setSelected(null)} onRemoveSelection={busy ? undefined : removeSelection} onCollapse={document ? () => setChatOpen(false) : undefined}/>
        </div>
        <div hidden={spaceMode} className="ps-role-panel">
          {document && <div className="ps-panel-head"><Button variant="ghost" onClick={() => setChatOpen(false)} aria-controls="muse-panel">{t("Minimize Muse")}</Button></div>}
          {publishedId ? <ParticipantPortal key={publishedId} projectId={publishedId} embedded active={!spaceMode} selectedZoneId={selected} onSelect={setSelected} onProject={setPublicProject} onDesignPreview={setBoothDocument} selectedObjectId={boothSelection} onObjectSelect={setBoothSelection}/> : <section className="p-5"><h2 className="font-semibold">{t("Muse · Booth designer")}</h2><p className="mt-3 text-sm text-muted">{t("No booths are published yet. Once you set prices with Muse and publish booths in organizer mode, you can get recommendations and apply here.")}</p><Button className="mt-4" onClick={() => setDesignRole("space")}>{t("Back to organizer mode")}</Button></section>}
        </div>


      </aside>

    </div>
    {spaceMode && document && <div className="ps-simple-summary">{issues.length > 0 && calibrated ? <details className="ps-design-issues"><summary>{t("Items to review")}{issues.length}{t("items")}</summary>{issues.map((issue, i) => <p key={i}>{issue}</p>)}</details> : null}</div>}


  </main>;
}

function BoothsLoading() {
  const { t } = useI18n(); return <p role="status">{t("Opening booth management…")}</p>; }

function SceneLoading() {
  const { t } = useI18n(); return <div className="ps-canvas-message">{t("Opening the 3D workspace…")}</div>; }
