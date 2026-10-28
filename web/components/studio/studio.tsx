"use client";
import { NativeSelect } from "../ui/native-select";
import { Input } from "../ui/input";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { cropPlan } from "@/lib/plans/crop";
import { Badge, Button, Segmented } from "../ui";
import { PlanCanvas } from "./plan-canvas";
import { StudioChat } from "./studio-chat";
import { SourcesPanel } from "./sources-panel";
import { emptySources, SourceLibrarySchema, type SourceLibrary } from "@/lib/sources/schema";
import { readSources, writeSources } from "@/lib/sources/storage";
import { Switch } from "../ui/switch";
import { DesignPanel } from "./design-panel";
import "./studio.css";
import "./spatial-design.css";
import "./sources.css";
const SceneView = dynamic(() => import("./scene-view"), { ssr: false, loading: () => <div className="ps-canvas-message">Opening the 3D workspace…</div> });
const STORAGE = "pavilion.plan-studio.v1";
type Mode = "plan" | "scene";
type Point = {
    x: number;
    y: number;
};
function Mark({ small = false }: {
    small?: boolean;
}) {
    return <svg width={small ? 25 : 44} height={small ? 25 : 44} viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 29V13L18 6l13 7v16M5 13l13 7 13-7M18 20v15M11 16v16M25 16v16" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>;
}
function EmptyPlan({ onUpload, onDemo, busy }: {
    onUpload: () => void;
    onDemo: () => void;
    busy: boolean;
}) {
    return <div className="ps-empty">
    <div className="ps-empty-drawing" aria-hidden="true"><svg viewBox="0 0 420 230" fill="none"><path d="M65 177L210 94l145 83-145 83z" fill="#e9eff7" transform="translate(0 -45)"/><g stroke="#a2b7ca" strokeWidth="1.3"><path d="M65 132V72l145-83 145 83v60M65 72l145 83 145-83M210 155v60" transform="translate(0 25)"/><path d="M112 184v-58l48-28 49 28v59M257 185v-58l49-28"/><path d="M161 98v57l48 28M257 127l49 28v57"/></g><path d="M65 157l145 83 145-83M210 155v85" stroke="#0064e0" strokeWidth="2"/><circle cx="210" cy="155" r="4" fill="#0064e0"/></svg><span className="ps-drawing-label">A space, waiting to take shape.</span></div>
    <span className="eyebrow">YOUR NEXT SPACE STARTS HERE</span><h1>From a floor plan<br />to your next space.</h1><p>Bring your drawing. Find its structure.<br />Shape the space together with Muse.</p>
    <div className="ps-empty-actions"><Button variant="primary" onClick={onUpload} disabled={busy}>Upload a floor plan <span aria-hidden="true">↗</span></Button><Button variant="ghost" onClick={onDemo} disabled={busy}>Explore Fort Mason <span aria-hidden="true">→</span></Button></div>
    <div className="ps-format-note">PDF, PNG, JPG or DXF <span>·</span> Up to 20 MB</div>
  </div>;
}
export function Studio() {
    const sourceManager = useRef<HTMLDialogElement>(null);
    const [sources, setSources] = useState<SourceLibrary>(emptySources);
    const sourcesRef = useRef(sources);
    const [sourcesReady, setSourcesReady] = useState(false);
    const [sourceError, setSourceError] = useState<string | null>(null);
    const [markingEntrance, setMarkingEntrance] = useState(false);
    const [showOriginal, setShowOriginal] = useState(true);
    const saveQueue = useRef(Promise.resolve());
    useEffect(() => {
        let alive = true;
        readSources().then(saved => { if (alive && saved) { sourcesRef.current = saved; setSources(saved); } })
            .catch(() => { if (alive) setSourceError("Saved sources could not be loaded. Import a project backup to recover them."); })
            .finally(() => { if (alive) setSourcesReady(true); });
        return () => { alive = false; };
    }, []);
    const changeSources = (update: (current: SourceLibrary) => SourceLibrary) => {
        try {
            const next = SourceLibrarySchema.parse(update(sourcesRef.current));
            sourcesRef.current = next; setSources(next); setSourceError(null);
            saveQueue.current = saveQueue.current.then(() => writeSources(next)).catch(() => setSourceError("Sources could not be saved in this browser. Export project to keep a backup."));
        } catch (error) { setSourceError(error instanceof Error ? error.message : "Could not update sources."); }
    };
    const [document, setDocument] = useState<PlanDocument | null>(null);
    const [details, setDetails] = useState(false);
    const [designOpen, setDesignOpen] = useState(false);
    const [mode, setMode] = useState<Mode>("plan");
    const [floorDraft, setFloorDraft] = useState<Point[] | null>(null);
    const [lineQuery, setLineQuery] = useState("");
    const [selected, setSelected] = useState<string | null>(null);
    const [history, setHistory] = useState<PlanDocument[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [width, setWidth] = useState("");
    const [height, setHeight] = useState("");
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
    useEffect(() => {
        return () => request.current?.abort();
    }, []);
    const save = useCallback((next: PlanDocument) => {
        try {
            localStorage.setItem(STORAGE, JSON.stringify(next));
            setNotice(null);
        }
        catch {
            setNotice("Browser storage is full. Export your plan to keep this work.");
        }
    }, []);
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
        setMode("plan");
        setChatKey((k) => k + 1);
        save(next);
    };
    const extract = async (file: File, page = 1) => {
        if (file.size > 20 * 1024 * 1024) {
            setError("Please choose a file smaller than 20 MB.");
            return;
        }
        if (!/\.(pdf|png|jpe?g|dxf)$/i.test(file.name)) {
            setError("Choose a PDF, PNG, JPG or DXF drawing.");
            return;
        }
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError(null);
        setSourceFile(file);
        try {
            const form = new FormData();
            form.set("file", file);
            form.set("page", String(page));
            const response = await fetch("/api/plans/extract", { method: "POST", body: form, signal: controller.signal });
            const data = await response.json();
            if (!response.ok)
                throw new Error(typeof data.message === "string" ? data.message : typeof data.detail === "string" ? data.detail : typeof data.error === "string" ? data.error : "We could not read this drawing. Please try another file.");
            if (!controller.signal.aborted)
                openDocument(PlanDocumentSchema.parse(data));
        }
        catch (err) {
            if (!controller.signal.aborted)
                setError(err instanceof Error ? err.message : "Could not read the drawing.");
        }
        finally {
            if (request.current === controller) {
                setBusy(false);
                request.current = null;
            }
        }
    };
    const loadDemo = async (venue: "mcenery" | "coex" | "fort-mason" = "mcenery") => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/plans/demo?venue=${venue}`, { signal: controller.signal });
            if (!response.ok)
                throw new Error("The demo PDF is unavailable. Upload a drawing to continue.");
            const file = new File([await response.blob()], venue === "fort-mason" ? "Fort Mason Ground Floor.pdf" : venue === "coex" ? "COEX Hall A 2024.pdf" : "McEnery Convention Center.pdf", { type: "application/pdf" });
            if (!controller.signal.aborted)
                await extract(file);
        }
        catch (err) {
            if (!controller.signal.aborted)
                setError(err instanceof Error ? err.message : "Could not load the demo.");
        }
        finally {
            if (request.current === controller) {
                setBusy(false);
                request.current = null;
            }
        }
    };
    const loadReviewedDemo = async (artifact: "reviewed" | "spatial" | "showcase" = "reviewed") => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/plans/demo?venue=fort-mason&artifact=${artifact}`, { signal: controller.signal });
            if (!response.ok)
                throw new Error("The saved Fort Mason review is unavailable. Load the source drawing instead.");
            const next = PlanDocumentSchema.parse(await response.json());
            if (!controller.signal.aborted) {
                openDocument(next);
                setSourceFile(null);
            }
        }
        catch (err) {
            if (!controller.signal.aborted)
                setError(err instanceof Error ? err.message : "Could not load saved review.");
        }
        finally {
            if (request.current === controller) {
                setBusy(false);
                request.current = null;
            }
        }
    };
    const openExample = (value: string) => {
        if (value === "fort-mason-showcase")
            void loadReviewedDemo("showcase");
        else if (value === "fort-mason-spatial")
            void loadReviewedDemo("spatial");
        else if (value === "fort-mason-reviewed")
            void loadReviewedDemo();
        else if (value === "mcenery" || value === "coex" || value === "fort-mason")
            void loadDemo(value);
    };
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
    const exportPlan = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify({ projectVersion: 1, document, sources: sourcesRef.current }, null, 2)], { type: "application/json" }));
        const a = window.document.createElement("a");
        a.href = url;
        a.download = "muvilion-project.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const restore = (raw: string) => {
        try {
            const parsed = JSON.parse(raw);
            if (parsed.projectVersion === 1) {
                const library = SourceLibrarySchema.parse(parsed.sources);
                const plan = parsed.document === null ? null : PlanDocumentSchema.parse(parsed.document);
                if (plan) openDocument(plan);
                else { planRef.current = null; setDocument(null); setHistory([]); setChatKey(k => k + 1); localStorage.removeItem(STORAGE); }
                changeSources(() => library);
            } else openDocument(PlanDocumentSchema.parse(parsed));
            setSourceFile(null);
            setError(null);
        }
        catch {
            setError("This is not a supported muvilion plan. Your current drawing has been kept.");
        }
    };
    const selectedLine = document?.lines.find((line) => line.id === selected);
    const wallCount = document?.lines.filter((line) => line.kind === "wall").length ?? 0;
    const unknownCount = document?.lines.filter((line) => line.kind === "unknown").length ?? 0;
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
            setError(err instanceof Error ? err.message : "Could not crop this space.");
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
    const classify = (kind: "wall" | "dimension" | "unknown") => {
        if (!document || !selectedLine)
            return;
        change({ ...document, lines: document.lines.map((line) => line.id === selected ? { ...line, kind } : line) });
    };
    const calibrate = () => {
        if (!document || !measure || !(Number(distance) > 0))
            return;
        const pixels = Math.hypot((measure[1].x - measure[0].x) * document.source.width, (measure[1].y - measure[0].y) * document.source.height);
        if (pixels < 3) {
            setError("Choose a longer segment for reliable calibration.");
            return;
        }
        const w = document.source.width / pixels * Number(distance), h = document.source.height / pixels * Number(distance);
        if (w > 2000 || h > 2000) {
            setError("The resulting extent is too large. Check the segment and its distance.");
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
            setError("Trace at least three corners around the interior without crossing the outline.");
            return;
        }
        change(result.data);
        setFloorDraft(null);
    };
    const calibrated = document?.scaleConfirmed && document.widthMeters && document.heightMeters;
    return <main className={`ps-studio ${details ? "ps-detail-view" : "ps-simple-view"}`}>
    <header className="ps-header">
      <Link href="/" className="ps-brand" aria-label="muvilion home"><Mark small/><span>muvilion</span></Link>
      <NativeSelect className="ps-venue-picker" aria-label="Example drawing" value="" disabled={busy} onChange={(e) => openExample(e.target.value)}><option value="">{document ? document.source.name.replace(/\.[^.]+$/, "") : "Choose an example"}</option><option value="fort-mason-showcase">Meta / Muse · exhibition concept</option><option value="fort-mason-spatial">Fort Mason · space design demo</option><option value="fort-mason-reviewed">Fort Mason · reviewed space</option><option value="fort-mason">Fort Mason · source drawing</option><option value="mcenery">Facebook F8 · San Jose</option><option value="coex">COEX Hall A · detailed plan</option></NativeSelect>
      <div className="ps-header-actions">
        <Button variant="ghost" onClick={() => sourceManager.current?.showModal()}>Sources · {sources.items.length + Number(Boolean(document))}</Button>
        <Button variant="ghost" aria-expanded={details} aria-controls="drawing-details" onClick={() => { setDetails((value) => !value); setFloorDraft(null); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }}>{details ? "← Simple view" : "Details"}</Button>
        {document && <Button variant="ghost" aria-expanded={designOpen} aria-controls="space-designer" onClick={() => setDesignOpen(v => !v)}>Design space</Button>}
        <Button variant="ghost" onClick={exportPlan} disabled={busy || !sourcesReady}>Export project</Button>
        <Button variant="primary" onClick={() => input.current?.click()} disabled={busy}>{document ? "Replace drawing" : "Upload a floor plan"}</Button>
      </div>
    </header>
    <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file)
        void extract(file); e.target.value = ""; }}/>
    <input ref={restoreInput} type="file" accept=".json" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file && file.size <= 32 * 1024 * 1024)
        restore(await file.text());
    else if (file)
        setError("Plan file must be smaller than 32 MB."); e.target.value = ""; }}/>
    <dialog ref={sourceManager} className="ps-source-manager" aria-labelledby="sources-manager-title">
      <header><h2 id="sources-manager-title">Sources</h2><Button onClick={() => sourceManager.current?.close()} aria-label="Close Sources">Close</Button></header>
        <SourcesPanel library={sources} ready={sourcesReady} document={document} busy={busy} onChange={changeSources} onDrawing={() => { sourceManager.current?.close(); input.current?.click(); }}/>
        {sourceError && <p role="alert" className="p-4 text-sm text-bad">{sourceError}</p>}
        <div className="ps-section"><Button disabled={!sourcesReady} onClick={() => restoreInput.current?.click()}>Import project</Button></div>

    </dialog>
    <div className="ps-workspace">
      <aside className="ps-sidebar" hidden={!details}>
        <div id="drawing-details" className="ps-drawing-controls" hidden={!details}>
        <section className="ps-section"><div className="ps-section-heading"><h2>Project source</h2><span className="ps-step-icon">↗</span></div>
          <Button disabled={busy} onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy && e.dataTransfer.files[0])
        void extract(e.dataTransfer.files[0]); }}><span className="ps-file-icon">＋</span><strong>{document ? "Replace drawing" : "Upload a floor plan"}</strong><span>Drop a file or browse</span><small>PDF · PNG · JPG · DXF</small></Button>
          {document && <div className="ps-source-card"><span className="ps-file-type">{document.source.format.toUpperCase()}</span><strong title={document.source.name}>{document.source.name}</strong><span>{document.source.width} × {document.source.height} · page {document.source.page}</span></div>}
          {document && document.source.pages > 1 && <label className="ps-field">Drawing page<NativeSelect value={document.source.page} disabled={busy || !sourceFile} onChange={(e) => { if (sourceFile)
        void extract(sourceFile, Number(e.target.value)); }}>{Array.from({ length: document.source.pages }, (_, i) => <option key={i} value={i + 1}>Page {i + 1}</option>)}</NativeSelect>{!sourceFile && <small>Re-upload the source to change pages.</small>}</label>}
          {document && <><Button variant={cropping ? "primary" : "secondary"} disabled={busy} onClick={() => { setMarkingEntrance(false); setFloorDraft(null); setCropping((v) => !v); setCalibrating(false); setDrawing(false); setMeasure(null); setMode("plan"); }}>{cropping ? "Cancel crop" : "Crop to space"}</Button>{cropping && <p className="ps-help" style={{ marginTop: 9 }}>Click opposite corners of one space. Cropping clears design objects; use Undo to restore.</p>}</>}
          <Button onClick={() => void loadDemo("fort-mason")} disabled={busy}><span className="ps-demo-plan">▱</span><span><strong>Fort Mason ground floor</strong><small>Dimensioned venue plan · San Francisco</small></span><span>→</span></Button>
          <Button disabled={busy} onClick={() => void loadReviewedDemo()}><span><strong>Open reviewed Fort Mason</strong><small>Saved recognition, scale and floor outline</small></span><span>→</span></Button>
          <Button onClick={() => void loadDemo()} disabled={busy}><span className="ps-demo-plan">▱</span><span><strong>Explore a real venue</strong><small>Facebook F8 · San Jose</small></span><span>→</span></Button>
          <Button onClick={() => void loadDemo("coex")} disabled={busy}><span className="ps-demo-plan">▱</span><span><strong>Explore a detailed plan</strong><small>COEX Hall A · dimensions included</small></span><span>→</span></Button>
          <div className="ps-source-links"><Button onClick={() => restoreInput.current?.click()} disabled={busy}>Open saved JSON</Button>{!document && <Button onClick={() => { try {
        const raw = localStorage.getItem(STORAGE);
        if (raw)
            restore(raw);
        else
            setNotice("No saved plan yet. Upload a drawing to start.");
    }
    catch {
        setError("Browser storage is unavailable.");
    } }}>Restore last plan</Button>}</div>
        </section>
        <section className="ps-section"><div className="ps-section-heading"><h2>Real-world scale</h2>{calibrated ? <Badge tone="ok">Confirmed</Badge> : <span className="ps-small-muted">Needs review</span>}</div><p className="ps-help">Pick a known distance on the drawing to set its scale.</p>
          <Button disabled={!document || busy} variant={calibrating ? "primary" : "secondary"} onClick={() => { setMarkingEntrance(false); setFloorDraft(null); setCalibrating((v) => !v); setDrawing(false); setCropping(false); setMeasure(null); setMode("plan"); }}>{calibrating ? "Cancel measurement" : "Measure two points"}</Button>
          {calibrating && <div className="ps-calibration"><p className="ps-help">{measure ? "Enter the real distance between your two points." : "Click both ends of a known dimension on the plan."}</p><label className="ps-field">Known distance (m)<Input type="number" min="0.01" step="0.01" value={distance} onChange={(e) => setDistance(e.target.value)}/></label><Button variant="primary" disabled={!measure || !(Number(distance) > 0)} onClick={calibrate}>Apply scale</Button></div>}
          <p className="ps-help" style={{ marginTop: 15 }}>Or enter the full drawing extent:</p>
          <div className="ps-dimensions"><label className="ps-field">Width<Input aria-label="Drawing width in metres" type="number" min="0.1" max="2000" step="0.01" value={width} placeholder="—" disabled={!document || busy} onChange={(e) => { setWidth(e.target.value); if (document?.scaleConfirmed)
        change({ ...document, scaleConfirmed: false }); }}/><span>m</span></label><label className="ps-field">Depth<Input aria-label="Drawing depth in metres" type="number" min="0.1" max="2000" step="0.01" value={height} placeholder="—" disabled={!document || busy} onChange={(e) => { setHeight(e.target.value); if (document?.scaleConfirmed)
        change({ ...document, scaleConfirmed: false }); }}/><span>m</span></label></div>
          <Button disabled={!document || busy || !(Number(width) > 0 && Number(width) <= 2000 && Number(height) > 0 && Number(height) <= 2000)} onClick={() => { if (document)
        change({ ...document, widthMeters: Number(width), heightMeters: Number(height), scaleConfirmed: true }); }}>Confirm dimensions <span>✓</span></Button>
        </section>
        {document && <section className="ps-section"><div className="ps-section-heading"><h2>Interior floor outline</h2></div><p className="ps-help">{document.floorBoundary ? `${document.floorBoundary.length} corners reviewed. Only this area becomes the floor; the outline does not create walls.` : "Trace the interior footprint to define usable floor and ceiling surfaces."}</p><Button disabled={busy} onClick={() => { setMarkingEntrance(false); setFloorDraft(floorDraft ? null : []); setMode("plan"); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }}>{floorDraft ? "Cancel outline" : "Trace floor outline"}</Button>{floorDraft && <><p className="ps-help">Click corners in order around the inside perimeter. {floorDraft.length} points selected.</p><Button disabled={floorDraft.length < 3} onClick={finishFloor}>Use floor outline</Button><Button variant="ghost" disabled={!floorDraft.length} onClick={() => setFloorDraft(floorDraft.slice(0, -1))}>Undo point</Button></>}{document.floorBoundary && !floorDraft && <Button variant="ghost" onClick={() => change({ ...document, floorBoundary: undefined, walkStart: undefined })}>Clear outline</Button>}</section>}

        <section className="ps-section ps-elements"><div className="ps-section-heading"><h2>Drawing elements</h2><span className="ps-small-muted">{document?.lines.length ?? 0}</span></div><div className="ps-element-row"><span><i className="ps-dot wall"/> Wall lines</span><strong>{wallCount}</strong></div><div className="ps-element-row"><span><i className="ps-dot unknown"/> Unclassified</span><strong>{unknownCount}</strong></div><div className="ps-element-row"><span><i className="ps-dot dimension"/> Dimension lines</span><strong>{document?.lines.filter((line) => line.kind === "dimension").length ?? 0}</strong></div><p className="ps-help">Select a line to review its role. Muse can help classify the drawing.</p>{document && document.lines.length > 0 && <label className="ps-field">Inspect element<Input aria-label="Find drawing element" placeholder="Filter by ID or kind" value={lineQuery} onChange={e => setLineQuery(e.target.value)}/><NativeSelect value={selected ?? ""} onChange={(e) => setSelected(e.target.value || null)}><option value="">Choose a line</option>{[...(selectedLine ? [selectedLine] : []), ...document.lines.filter(line => line.id !== selected && `${line.id} ${line.kind}`.includes(lineQuery)).slice(0, 199)].map((line) => <option key={line.id} value={line.id}>{line.id} · {line.kind}</option>)}</NativeSelect><small>Up to 200 matches. Filter by ID or click the plan to inspect any line.</small></label>}</section>
        <div className="ps-sidebar-footer"><span className="ps-status-dot"/> {document ? "Working on your drawing" : "Ready for your drawing"}</div>
        </div>
      </aside>
      <section className="ps-center" aria-label="Drawing workspace">
        <div className="ps-canvas-toolbar"><div className="ps-canvas-title"><span className="eyebrow">{document ? "DRAWING WORKSPACE" : "NEW PROJECT"}</span><strong>{document ? document.source.name.replace(/\.[^.]+$/, "") : "Untitled space"}</strong></div><Segmented<Mode> options={[{ id: "plan", label: "2D 편집" }, { id: "scene", label: "3D 공간" }]} value={mode} onChange={(next) => { setMode(next); setMarkingEntrance(false); setFloorDraft(null); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }} label="Workspace view"/></div>
        {mode === "plan" && document && <div className="ps-original-toggle"><label className="flex items-center gap-2"><Switch checked={showOriginal} onCheckedChange={setShowOriginal}/>원본 도면</label><Button variant={markingEntrance ? "primary" : "ghost"} disabled={busy || (document.entrances?.length ?? 0) >= 30} onClick={() => { setMarkingEntrance(value => !value); setDrawing(false); setCalibrating(false); setCropping(false); setFloorDraft(null); }}>{markingEntrance ? "위치 선택 · 취소" : "입구 표시"}</Button></div>}
        {error && <div className="ps-alert" role="alert"><span>{error}</span><Button onClick={() => setError(null)} aria-label="Dismiss error">×</Button></div>}
        {notice && <div className="ps-notice" role="status">{notice}</div>}
        <div className="ps-canvas-area">
          {document ? mode === "scene" ? <><SceneView document={document} wallHeight={wallHeight} selected={selected} onSelect={(id) => { setSelected(id); if (document?.entrances?.some(e => e.id === id) || document?.objects?.some(o => o.id === id) || document?.zones?.some(z => z.id === id))
        setDesignOpen(true); }}/>{details && <div className="ps-scene-note">{calibrated ? "Scale confirmed" : "Illustrative scale · confirm dimensions"} · ceiling {document.ceiling ? `${document.ceiling.height} m (${document.ceiling.status})` : "not set"} · wall thickness inferred</div>}{wallCount === 0 && <div className="ps-scene-empty">Classify wall lines in 2D or ask Muse to review your drawing.</div>}</> : <PlanCanvas key={`${chatKey}-${drawing}-${calibrating}-${cropping}`} document={document} onEntrancePoint={markingEntrance ? point => { const id = crypto.randomUUID(); change({ ...document, entrances: [...(document.entrances ?? []), { id, label: `입구 ${(document.entrances?.length ?? 0) + 1}`, ...point, rotation: 0 }] }); setMarkingEntrance(false); setSelected(id); setDesignOpen(true); } : undefined} floorDraft={floorDraft} onBoundaryPoint={floorDraft ? (point) => setFloorDraft([...floorDraft, point].slice(0, 128)) : undefined} selected={selected} onSelect={(id) => { setSelected(id); if (document?.entrances?.some(e => e.id === id) || document?.objects?.some(o => o.id === id) || document?.zones?.some(z => z.id === id))
        setDesignOpen(true); }} sourceOnly={false} showOriginal={showOriginal} drawing={drawing || calibrating || cropping} rectangle={cropping} onDraw={cropping ? (a, b) => void cropSpace(a, b) : calibrating ? (a, b) => setMeasure([a, b]) : drawWall} measurement={measure}/> : <EmptyPlan onUpload={() => input.current?.click()} onDemo={() => void loadDemo("fort-mason")} busy={busy}/>}
          {busy && <div className="ps-loading" role="status"><div className="ps-spinner"/><strong>{cropping ? "Cropping your space" : "Reading your drawing"}</strong><span>{cropping ? "Keeping geometry inside the selected area." : "Extracting geometry and preparing the source preview."}</span>{!cropping && <Button onClick={() => { request.current?.abort(); setBusy(false); }}>Cancel</Button>}</div>}
        </div>
        <div className="ps-bottom-toolbar"><div className="ps-tool-buttons" hidden={!details}><Button variant={drawing ? "primary" : "ghost"} disabled={!document || mode !== "plan" || busy || (document.lines.length >= 100000)} onClick={() => { setMarkingEntrance(false); setFloorDraft(null); setDrawing((v) => !v); setCalibrating(false); setCropping(false); setMeasure(null); }}>{drawing ? "Finish drawing" : "+ Draw wall"}</Button><Button variant="ghost" disabled={!history.length || busy} onClick={undo}>↶ Undo</Button></div><span>{floorDraft ? "Click the interior corners, then Use floor outline" : cropping ? "Click opposite corners of the space to keep" : calibrating ? "Click two points along a known dimension" : drawing ? "Click two endpoints · Esc cancels the segment" : mode === "scene" ? "Drag to orbit · scroll to zoom" : document ? "Click a line to inspect" : "Start with a drawing or explore the demo"}</span></div>
        {designOpen && document && <aside id="space-designer" className="ps-design-drawer"><header><strong>Space designer</strong><Button onClick={() => setDesignOpen(false)} aria-label="Close space designer">×</Button></header><DesignPanel document={document} onDocumentChange={change} selected={selected} onSelect={setSelected}/><div className="ps-section"><Button disabled={!history.length || busy} onClick={undo}>Undo last edit</Button></div></aside>}
        {details && document?.warnings.length ? <details className="ps-warnings"><summary>{document.warnings.length} source note{document.warnings.length === 1 ? "" : "s"} to review</summary><ul>{document.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details> : null}
      </section>
      <aside className="ps-right-panel">
        {details && selectedLine && document && <section className="ps-inspector"><div className="ps-section-heading"><h2>Selected element</h2><Button onClick={() => setSelected(null)} aria-label="Close element inspector">×</Button></div><span className="ps-small-muted">{selectedLine.id} · {selectedLine.origin}</span><div className="ps-classify">{(["wall", "dimension", "unknown"] as const).map((kind) => <Button key={kind} aria-pressed={selectedLine.kind === kind} onClick={() => classify(kind)}>{kind === "unknown" ? "Unclassified" : kind === "wall" ? "Wall" : "Dimension"}</Button>)}</div><div className="ps-endpoints"><span>Start <b>{selectedLine.a.x.toFixed(3)}, {selectedLine.a.y.toFixed(3)}</b></span><span>End <b>{selectedLine.b.x.toFixed(3)}, {selectedLine.b.y.toFixed(3)}</b></span></div><Button variant="danger" onClick={() => { change({ ...document, lines: document.lines.filter((line) => line.id !== selected) }); setSelected(null); }}>Remove line</Button></section>}
        {details && mode === "scene" && document && <section className="ps-inspector"><label className="ps-field">Preview wall height <div className="ps-height-control"><Input type="number" min="0.5" max="30" step="0.1" value={wallHeight} onChange={(e) => { const n = Number(e.target.value); if (n >= 0.5 && n <= 30)
        change({ ...document, wallHeight: n }); }}/><span>m</span></div></label><p className="ps-help">Wall height is saved with this space. Verify it against supplied measurements.</p></section>}
        <StudioChat key={chatKey} sources={sources} document={document} onDocumentChange={change} simple={!details}/>
      </aside>
    </div>
    {!details && (!document || !calibrated) && <div className="ps-simple-summary"><p>{!document ? "Bring a floor plan. Shape your space with Muse." : !calibrated ? "Your drawing is ready. Confirm a known distance before planning your layout." : `${document.objects?.length ?? 0} objects in your concept · Scale confirmed`}</p>{document && <Button variant="ghost" onClick={() => calibrated ? setDesignOpen(true) : setDetails(true)}>{calibrated ? "Design your space →" : "Review drawing & scale →"}</Button>}{!document && <Button onClick={() => restoreInput.current?.click()}>Open saved plan</Button>}</div>}
    <footer className="ps-footer"><span>muvilion <span> / </span> Make room for your ideas.</span><span>Editable geometry · Human-reviewed dimensions</span></footer>
  </main>;
}
