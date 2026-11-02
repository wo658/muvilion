"use client";
import type { MuviOperation } from "@/lib/muvi/operations";
import { MuviAvatar } from "@/components/muvi/muvi-avatar";

import { NativeSelect } from "../ui/native-select";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import dynamic from "next/dynamic";
import { localizeMessage } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";
import { AppSettings } from "../app-settings";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { cropPlan } from "@/lib/plans/crop";
import { boothExample } from "@/lib/booths/example";
import { Badge, Button } from "../ui";
import { PlanCanvas } from "./plan-canvas";
import { StudioChat } from "./studio-chat";
import { activateDrawing, addDrawing, drawingSources, saveDrawing } from "@/lib/projects/drawings";
import { SourcesPanel } from "./sources-panel";
import { SourceLibrarySchema, type SourceLibrary } from "@/lib/sources/schema";
import { ProjectWorkspace, RailButton, type ProjectControls } from "./project-workspace";
import { ProjectDialog } from "./project-dialog";
import { createPortal } from "react-dom";
import type { Project } from "@/lib/projects/schema";
import { PlanningArtifactPanel } from "./planning-artifact-panel";
import { usePlanningArtifact } from "./use-planning-artifact";
import { planningIsStale, refreshPlanningArtifact, revisePlanningArtifact, type PlanningArtifact } from "@/lib/plans/planning-artifact";
import { FolderCogIcon, SettingsIcon } from "lucide-react";


import { usabilityWarnings } from "@/lib/plans/usability";
import { designWarnings } from "@/lib/plans/design";
import "./studio.css";
import "./spatial-design.css";
import "./sources.css";
import { TOKENS } from "@/lib/ui/tokens";
const SceneView = dynamic(() => import("./scene-view"), { ssr: false, loading: SceneLoading });
type Point = {
    x: number;
    y: number;
};

export function Studio() {
    return <ProjectWorkspace editor={StudioEditor}/>;
}
function StudioEditor({ project, controls }: { project: Project; controls: ProjectControls }) {
    const { t, locale } = useI18n();
    const [settings, setSettings] = useState<string | null>(null);
    // Start with Muse docked on phones so the plan stays visible; the editor only renders client-side.
    const [photoRequest, setPhotoRequest] = useState<{ base: PlanDocument; sources: SourceLibrary; request: import("@/lib/plans/photography-client").PhotoRequest } | null>(null);
    const [chatOpen, setChatOpen] = useState(() => window.matchMedia("(min-width: 800px)").matches);
    const [planningArtifacts, setPlanningArtifacts] = useState(project.state.planningArtifacts ?? []);
    const [sources, setSources] = useState<SourceLibrary>(project.state.sources);
    const sourcesRef = useRef(sources);
    const projectState = useRef(project.state);
    const [drawings, setDrawings] = useState(() => drawingSources(project.state));
    const [activeDrawingId, setActiveDrawingId] = useState<string | undefined>(project.state.activeDrawingId ?? drawings[0]?.id);
    const drawingEdits = useRef(new Map<string, { history: PlanDocument[]; width: string; height: string }>());
    const sourcesReady = true;
    const originalDrawing = useRef(project.state.originalDrawingId);
    const [sourceError, setSourceError] = useState<string | null>(null);
    const [markingEntrance, setMarkingEntrance] = useState(false);
    const [document, setDocument] = useState<PlanDocument | null>(project.state.document);
    const planningArtifact = planningArtifacts.find(a => a.drawingId === (activeDrawingId ?? "legacy-drawing")) ?? null;
    const changePlanning = (next: PlanningArtifact) => {
        const items = [...(projectState.current.planningArtifacts ?? []).filter(a => a.drawingId !== next.drawingId), next];
        projectState.current = { ...projectState.current, planningArtifacts: items };
        setPlanningArtifacts(items); controls.change(projectState.current);
    };
    const planning = usePlanningArtifact({ document, sources, drawingId: activeDrawingId ?? "legacy-drawing", artifact: planningArtifact, onChange: changePlanning, locale });
    const planningStale = useMemo(() => Boolean(planningArtifact && document && planningIsStale(planningArtifact, document, sources)), [planningArtifact, document, sources]);

    const [muviActivity, setMuviActivity] = useState<{ base: PlanDocument; sources: SourceLibrary; operation: MuviOperation } | null>(null);
    const activeOperation = muviActivity?.base === document && muviActivity?.sources === sources ? muviActivity.operation : null;
    const [designPreview, setDesignPreview] = useState<{ base: PlanDocument; sources: SourceLibrary; document: PlanDocument; label: string } | null>(null);
    const activePreview = designPreview?.base === document && designPreview?.sources === sources ? designPreview : null;
    const [details, setDetails] = useState(false);
    const [projectSettings, setProjectSettings] = useState<"sources" | null>(null);
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const projectMenuTrigger = useRef<HTMLButtonElement>(null);
    const openProjectDialog = (section: "sources") => {
        // Native dialogs restore focus to this persistent trigger, not the closing popover.
        projectMenuTrigger.current?.focus();
        setProjectMenuOpen(false);
        setProjectSettings(section);
    };
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
    const revisePlanning = async (brief: string, signal?: AbortSignal) => {
        if (activePreview) throw new Error(t("Apply or discard the spatial draft before revising the planning document."));
        setDetails(false); setDrawing(false); setCalibrating(false); setCropping(false); setMarkingEntrance(false); setFloorDraft(null); setPhotoRequest(null);
        return planning.revise(brief, signal);
    };
    const changeSources = (update: (current: SourceLibrary) => SourceLibrary) => {
        try {
            const next = SourceLibrarySchema.parse(update(sourcesRef.current));
            sourcesRef.current = next; setSources(next); setSourceError(null);
            projectState.current = saveDrawing({ ...projectState.current, sources: next, originalDrawingId: originalDrawing.current }, planRef.current);
            controls.change(projectState.current);
        } catch (error) { setSourceError(error instanceof Error ? error.message : "Could not update sources."); }
    };
    useEffect(() => {
        return () => request.current?.abort();
    }, []);
    const save = useCallback((next: PlanDocument | null) => {
        projectState.current = saveDrawing({ ...projectState.current, sources: sourcesRef.current, originalDrawingId: originalDrawing.current }, next);
        controls.change(projectState.current);
    }, [controls]);
    const extractRef = useRef<typeof extract | null>(null);
    const activeOriginalId = drawings.find(item => item.id === activeDrawingId)?.originalAssetId ?? (drawings.length ? null : project.state.originalDrawingId);
    useEffect(() => {
        if (!activeOriginalId) return;
        const controller = new AbortController();
        void fetch(`/api/projects/${project.id}/assets/${activeOriginalId}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error("Could not restore the original drawing file.");
                const blob = await response.blob();
                const stored = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
                const file = new File([blob], (stored ? decodeURIComponent(stored) : "drawing.pdf"), { type: blob.type });
                if (controller.signal.aborted || originalDrawing.current !== activeOriginalId) return;
                // Seeded samples keep only the original; read it the first time the project opens.
                if (!planRef.current) void extractRef.current?.(file, project.state.originalDrawingPage ?? 1, activeOriginalId);
                else setSourceFile(file);
            }).catch(error => { if (!controller.signal.aborted) setNotice(error.message); });
        return () => controller.abort();
    }, [project.id, activeOriginalId, activeDrawingId, project.state.originalDrawingPage]);
    const change = useCallback((next: PlanDocument) => {
        // Ignore work completed by a drawing's controls after switching sources.
        if ((projectState.current.activeDrawingId ?? drawingSources(projectState.current)[0]?.id) !== activeDrawingId) return;
        const previous = planRef.current;
        if (previous)
            setHistory((items) => [...items.slice(-19), previous]);
        planRef.current = next;
        setDocument(next);
        save(next);
    }, [save, activeDrawingId]);
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
    const rememberEdits = () => {
        if (activeDrawingId) drawingEdits.current.set(activeDrawingId, { history, width, height });
    };
    const showDrawing = (next: Project["state"]) => {
        projectState.current = next;
        originalDrawing.current = next.originalDrawingId;
        sourcesRef.current = next.sources; setSources(next.sources);
        setDrawings(drawingSources(next)); setActiveDrawingId(next.activeDrawingId);
        setSourceFile(null); setError(null); setNotice(null);
        setProjectSettings(null);
        openDocument(next.document!);
        const edits = next.activeDrawingId && drawingEdits.current.get(next.activeDrawingId);
        if (edits) { setHistory(edits.history); setWidth(edits.width); setHeight(edits.height); }
    };
    const switchDrawing = (id: string) => {
        if (busy || id === activeDrawingId) return;
        planning.cancel(); planning.setTarget(null);
        rememberEdits();
        showDrawing(activateDrawing(projectState.current, id));
    };
    const extract = async (file: File, page = 1, storedAssetId?: string) => {
        const existing = storedAssetId && drawingSources(projectState.current).find(item => item.originalAssetId === storedAssetId && item.document.source.page === page);
        if (existing) { switchDrawing(existing.id); return; }
        if (drawingSources(projectState.current).length >= 12) {
            setError(t("A project supports up to 12 drawings.")); return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setError(t("Please choose a file smaller than 20 MB."));
            return;
        }
        if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
            setError(t("Choose a PDF, PNG or JPG drawing. Export CAD drawings to PDF first."));
            return;
        }
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError(null);
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
                rememberEdits();
                showDrawing(addDrawing(projectState.current, { id: crypto.randomUUID(), document: plan, originalAssetId: assetId, selected: true }));
                setSourceFile(file);
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
    const issues = useMemo(() => document ? [...designWarnings(document, locale), ...usabilityWarnings(document, locale)] : [], [document, locale]);
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
    const visibleDocument = activePreview?.document ?? document;
    const museCollapsed = Boolean(document) && !chatOpen;
    // The workspace is 3D; the 2D plan appears only while a drawing setup tool needs it.
    const planTools = (details || markingEntrance || drawing || calibrating || cropping || floorDraft !== null);
    // Discard the request, rather than reactivating it if an old drawing is reopened.
    if (photoRequest && (photoRequest.base !== document || photoRequest.sources !== sources || activePreview || planTools)) setPhotoRequest(null);
    const [toolbarEnd, setToolbarEnd] = useState<HTMLDivElement | null>(null);
    return <main className={`ps-studio ${details ? "ps-detail-view" : "ps-simple-view"} ${document ? "ps-has-plan" : "ps-conversation-only"}${museCollapsed ? " ps-muse-collapsed" : ""}`}>

    {controls.sidebar && createPortal(<>
      <RailButton icon={<SettingsIcon/>} label={t("Settings")} onClick={() => setSettings("general")}/>
    </>, controls.sidebar)}
    <AppSettings section={settings} onSectionChange={setSettings} sections={[


      { id: "project", label: t("Project"), content: <div className="flex flex-col gap-6">
        <section className="settings-row"><div className="flex flex-col gap-2"><h4 className="font-medium">{t("Export project")}</h4><p className="settings-description">{t("Download this project and its original files as one JSON bundle.")}</p></div><Button className="self-start" variant="primary" onClick={exportPlan} disabled={busy || !sourcesReady}>{t("Export")}</Button></section>
        <section className="settings-row"><div className="flex flex-col gap-2"><h4 className="font-medium">{t("Import project")}</h4><p className="settings-description">{t("Open an exported JSON bundle as a new project. The current project is kept.")}</p></div><Button className="self-start" disabled={!sourcesReady} onClick={() => { setSettings(null); restoreInput.current?.click(); }}>{t("Import project")}</Button></section>
      </div> },
    ]}/>

    <ProjectDialog open={projectSettings !== null} title={t("Sources")} onClose={() => setProjectSettings(null)}>
      <div hidden={projectSettings !== "sources"}>
        <SourcesPanel drawings={drawings} activeDrawingId={activeDrawingId} onSwitchDrawing={id => { switchDrawing(id); setProjectSettings(null); }} onUploadOriginal={controls.upload} library={sources} ready={sourcesReady} document={document} busy={busy} onChange={changeSources} onDrawing={() => { setProjectSettings(null); input.current?.click(); }}/>
        {sourceError && <p role="alert" className="p-4 text-sm text-bad">{localizeMessage(locale, sourceError)}</p>}
      </div>

    </ProjectDialog>
    <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file)
        void extract(file); e.target.value = ""; }}/>
    <input ref={restoreInput} type="file" accept=".json" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file && file.size <= 400 * 1024 * 1024)
        restore(await file.text());
    else if (file)
        setError(t("Plan file must be smaller than 32 MB.")); e.target.value = ""; }}/>
    <div className="ps-workspace">
      <aside className="ps-sidebar" hidden={!details}>
        <div id="drawing-details" className="ps-drawing-controls" hidden={!details}>
        <section className="ps-section"><div className="ps-section-heading"><h2>{t("Drawing setup")}</h2><Button variant="ghost" onClick={() => { setDetails(false); setFloorDraft(null); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }}>{t("Close")}</Button></div>
          {document && document.source.pages > 1 && <label className="ps-field">{t("Drawing page")}<NativeSelect value={document.source.page} disabled={busy || !sourceFile} onChange={(e) => { if (sourceFile)
        void extract(sourceFile, Number(e.target.value), originalDrawing.current ?? undefined); }}>{Array.from({ length: document.source.pages }, (_, i) => <option key={i} value={i + 1}>{t("Page {page}", { page: i + 1 })}</option>)}</NativeSelect>{!sourceFile && <small>{t("Re-upload the source to change pages.")}</small>}</label>}
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
          {document && <>
            <NativeSelect aria-label={t("Switch drawing")} className="min-w-0 max-w-64 flex-1" value={activeDrawingId ?? drawings[0]?.id ?? ""} disabled={busy} onChange={event => switchDrawing(event.target.value)}>
              {drawings.map(item => <option key={item.id} value={item.id}>{item.document.source.name}{item.document.source.pages > 1 ? ` · ${t("Page {page}", { page: item.document.source.page })}` : ""}</option>)}
            </NativeSelect>
            <Popover open={projectMenuOpen} onOpenChange={setProjectMenuOpen}>
              <PopoverTrigger ref={projectMenuTrigger} render={<Button variant="ghost" className="ps-icon-button" aria-label={t("Project settings")} title={t("Project settings")}/>}>
                <FolderCogIcon/>
              </PopoverTrigger>
              <PopoverContent align="start" aria-label={t("Project settings")} finalFocus={projectSettings === null}>
                <Button variant="ghost" className="justify-start" onClick={() => { setProjectMenuOpen(false); setDetails(true); }}>{t("Drawing settings")}</Button>
                <Button variant="ghost" className="justify-start" onClick={() => openProjectDialog("sources")}>{t("Sources")}</Button>
              </PopoverContent>
            </Popover>
          </>}
          <div ref={setToolbarEnd} className="ps-toolbar-end"/>
        </div>

        {error && <div className="ps-alert" role="alert"><span>{localizeMessage(locale, error)}</span><Button onClick={() => setError(null)} aria-label={t("Dismiss error")}>×</Button></div>}
        {notice && <div className="ps-notice" role="status">{localizeMessage(locale, notice)}</div>}
        <div className="ps-canvas-area">
          {activePreview && <p role="status" className="pointer-events-none absolute left-3 right-3 top-16 z-10 max-w-md line-clamp-2 rounded bg-surface px-3 py-2 text-xs text-ink">{t("Live draft · not saved")} · {activePreview.label}</p>}
          {document ? !planTools ? <><SceneView onPlanningOpen={() => { planning.setOpen(true); setChatOpen(true); }} onPlanningCaptureReady={planning.onCaptureReady} sources={sources} exportDisabled={Boolean(activePreview)} photoRequest={photoRequest?.base === document && photoRequest?.sources === sources && !activePreview ? photoRequest.request : null} onPhotoClose={() => setPhotoRequest(null)} muviOperation={activeOperation} key={activeDrawingId ?? "empty"} toolbar={toolbarEnd} document={visibleDocument!} wallHeight={visibleDocument?.wallHeight ?? wallHeight} selected={selected} onSelect={activePreview ? () => {} : setSelected}/>{details && <div className="ps-scene-note">{calibrated ? t("Scale confirmed") : t("Illustrative scale · confirm dimensions")} {t("· ceiling")}{document.ceiling ? `${document.ceiling.height} m (${t(document.ceiling.status)})` : t("not set")} {t("· wall thickness inferred")}</div>}</> : <PlanCanvas key={`${chatKey}-${drawing}-${calibrating}-${cropping}`} document={visibleDocument!} onEntrancePoint={markingEntrance ? point => { const id = crypto.randomUUID(); change({ ...document, entrances: [...(document.entrances ?? []), { id, label: t("Entrance {count}", { count: (document.entrances?.length ?? 0) + 1 }), ...point, rotation: 0 }] }); setMarkingEntrance(false); setSelected(id); } : undefined} floorDraft={floorDraft} onBoundaryPoint={floorDraft ? (point) => setFloorDraft([...floorDraft, point].slice(0, 128)) : undefined} selected={selected} onSelect={activePreview ? () => {} : setSelected} sourceOnly={false} showOriginal={false} showSourceFallback drawing={(drawing || calibrating || cropping)} rectangle={cropping} onDraw={cropping ? (a, b) => void cropSpace(a, b) : calibrating ? (a, b) => setMeasure([a, b]) : drawWall} measurement={measure}/> : null}
          {planning.open && document && <PlanningArtifactPanel artifact={planningArtifact} busy={planning.busy} progress={planning.progress} error={planning.error} stale={planningStale} target={planning.target}
            onTarget={id => { planning.setTarget(id); setChatOpen(true); }} onClose={() => { planning.setOpen(false); planning.setTarget(null); requestAnimationFrame(() => window.document.querySelector<HTMLButtonElement>("[data-planning-trigger]")?.focus()); }}
            onCreate={() => { setChatOpen(true); void revisePlanning(t("Create the complete planning document and participation guide, with photos of the space and each booth.")).catch(() => {}); }}
            onRefresh={() => { if (planningArtifact) { const next = refreshPlanningArtifact(planningArtifact, document, sources); changePlanning({ ...next, history: [] }); } }}
            onUndo={() => { const previous = planningArtifact?.history.at(-1); if (planningArtifact && previous) { const next = revisePlanningArtifact(planningArtifact, previous.content); changePlanning({ ...next, history: planningArtifact.history.slice(0, -1) }); } }} onCancel={planning.cancel}/>}
          {busy && <div className="ps-loading" role="status"><div className="ps-spinner"/><strong>{cropping ? t("Cropping your space") : t("Reading your drawing")}</strong><span>{cropping ? t("Keeping geometry inside the selected area.") : t("Extracting geometry and preparing the source preview.")}</span>{!cropping && <Button onClick={() => { request.current?.abort(); setBusy(false); }}>{t("Cancel")}</Button>}</div>}
        </div>
        <div className="ps-bottom-toolbar"><div className="ps-tool-buttons" hidden={!details}><Button variant={drawing ? "primary" : "ghost"} disabled={!document || !planTools || busy || (document.lines.length >= 100000)} onClick={() => { setMarkingEntrance(false); setFloorDraft(null); setDrawing((v) => !v); setCalibrating(false); setCropping(false); setMeasure(null); }}>{drawing ? t("Finish drawing") : t("+ Draw wall")}</Button><Button variant="ghost" disabled={!history.length || busy} onClick={undo}>{t("↶ Undo")}</Button></div><span>{floorDraft ? t("Click the interior corners, then Use floor outline") : cropping ? t("Click opposite corners of the space to keep") : calibrating ? t("Click two points along a known dimension") : drawing ? t("Click two endpoints · Esc cancels the segment") : !planTools ? t("Drag to orbit · scroll to zoom") : document ? t("Select an item and ask Muse") : t("Start with a drawing or explore the demo")}</span></div>

        {details && document?.warnings.length ? <details className="ps-warnings"><summary>{t("{count} source notes to review", { count: document.warnings.length })}</summary><ul>{document.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details> : null}
      </section>
      <aside id="muse-panel" className="ps-right-panel" aria-label="Muse" data-collapsed={museCollapsed ? "" : undefined} onKeyDown={event => { if (event.key === "Escape" && document) setChatOpen(false); }}>
        {museCollapsed && <button type="button" className="ps-muse-launcher" aria-expanded={false} aria-controls="muse-panel" aria-label={t("Talk to Muse")} title={selection ? selection.label : t("Talk to Muse")} onClick={() => setChatOpen(true)}><MuviAvatar size={40}/></button>}
        <div className="ps-chat-panel">
          {!document && <div className="p-5"><Button onClick={() => showDrawing(addDrawing(projectState.current, { id: crypto.randomUUID(), document: boothExample(), originalAssetId: null, selected: true }))}>{t("Start with the booth design example")}</Button></div>}
          <StudioChat planningBusy={planning.busy} onPlanning={revisePlanning} onPlanningCancel={planning.cancel} planningContext={planning.open || planningArtifact ? { open: planning.open, target: planning.open ? planning.target : null, title: planningArtifact?.content.title ?? null, content: planningArtifact?.content ?? null } : null} onPhotography={request => { if (document) { setDetails(false); setMarkingEntrance(false); setDrawing(false); setCalibrating(false); setCropping(false); setFloorDraft(null); setPhotoRequest({ base: document, sources, request }); setChatOpen(false); } }} onMuviOperation={setMuviActivity} onDesignPreview={setDesignPreview} key={activeDrawingId ?? "empty"} sources={sources} document={document} onDocumentChange={change} onSources={() => setProjectSettings("sources")} selection={selection} onClearSelection={() => setSelected(null)} onCollapse={document ? () => setChatOpen(false) : undefined}/>
        </div>



      </aside>

    </div>
    {document && <div className="ps-simple-summary">{issues.length > 0 && calibrated ? <details className="ps-design-issues"><summary>{t("Items to review")}{issues.length}{t("items")}</summary>{issues.map((issue, i) => <p key={i}>{issue}</p>)}</details> : null}</div>}


  </main>;
}

function SceneLoading() {
  const { t } = useI18n(); return <div className="ps-canvas-message">{t("Opening the 3D workspace…")}</div>; }
