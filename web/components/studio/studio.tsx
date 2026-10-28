"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { cropPlan } from "@/lib/plans/crop";
import { Badge, Button, Segmented } from "../ui";
import { PlanCanvas } from "./plan-canvas";
import { StudioChat } from "./studio-chat";
import { DesignPanel } from "./design-panel";
import "./studio.css";

const SceneView = dynamic(() => import("./scene-view"), { ssr: false, loading: () => <div className="ps-canvas-message">Opening the 3D workspace…</div> });
const STORAGE = "pavilion.plan-studio.v1";
type Mode = "source" | "plan" | "scene";
type Point = { x: number; y: number };

function Mark({ small = false }: { small?: boolean }) {
  return <svg width={small ? 25 : 44} height={small ? 25 : 44} viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 29V13L18 6l13 7v16M5 13l13 7 13-7M18 20v15M11 16v16M25 16v16" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

function EmptyPlan({ onUpload, onDemo, busy }: { onUpload: () => void; onDemo: () => void; busy: boolean }) {
  return <div className="ps-empty">
    <div className="ps-empty-drawing" aria-hidden="true"><svg viewBox="0 0 420 230" fill="none"><path d="M65 177L210 94l145 83-145 83z" fill="#e9eff7" transform="translate(0 -45)" /><g stroke="#a2b7ca" strokeWidth="1.3"><path d="M65 132V72l145-83 145 83v60M65 72l145 83 145-83M210 155v60" transform="translate(0 25)" /><path d="M112 184v-58l48-28 49 28v59M257 185v-58l49-28" /><path d="M161 98v57l48 28M257 127l49 28v57" /></g><path d="M65 157l145 83 145-83M210 155v85" stroke="#0064e0" strokeWidth="2" /><circle cx="210" cy="155" r="4" fill="#0064e0" /></svg><span className="ps-drawing-label">A space, waiting to take shape.</span></div>
    <span className="eyebrow">YOUR NEXT SPACE STARTS HERE</span><h1>From a floor plan<br />to a place of possibility.</h1><p>Bring your drawing. Find its structure.<br />Shape the space together with Muse.</p>
    <div className="ps-empty-actions"><Button variant="primary" onClick={onUpload} disabled={busy}>Upload a floor plan <span aria-hidden="true">↗</span></Button><Button variant="ghost" onClick={onDemo} disabled={busy}>Explore the F8 venue <span aria-hidden="true">→</span></Button></div>
    <div className="ps-format-note">PDF, PNG, JPG or DXF <span>·</span> Up to 20 MB</div>
  </div>;
}

export function Studio() {
  const [document, setDocument] = useState<PlanDocument | null>(null);
  const [mode, setMode] = useState<Mode>("plan");
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<PlanDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [wallHeight, setWallHeight] = useState(3);
  const [drawing, setDrawing] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [measure, setMeasure] = useState<[Point, Point] | null>(null);
  const [distance, setDistance] = useState("");
  const [chatKey, setChatKey] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const restoreInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const current = useRef(document);

  useEffect(() => {
    return () => request.current?.abort();
  }, []);

  const save = useCallback((next: PlanDocument) => {
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setNotice(null); }
    catch { setNotice("Browser storage is full. Export your plan to keep this work."); }
  }, []);
  const change = useCallback((next: PlanDocument) => {
    const previous = current.current;
    if (previous) setHistory((items) => [...items.slice(-19), previous]);
    current.current = next;
    setDocument(next);
    save(next);
  }, [save]);
  const openDocument = (next: PlanDocument) => {
    current.current = next; setDocument(next); setHistory([]); setSelected(null); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null);
    setWidth(next.widthMeters?.toString() ?? ""); setHeight(next.heightMeters?.toString() ?? "");
    setMode("plan"); setChatKey((k) => k + 1); save(next);
  };

  const extract = async (file: File, page = 1) => {
    if (file.size > 20 * 1024 * 1024) { setError("Please choose a file smaller than 20 MB."); return; }
    if (!/\.(pdf|png|jpe?g|dxf)$/i.test(file.name)) { setError("Choose a PDF, PNG, JPG or DXF drawing."); return; }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(null); setSourceFile(file);
    try {
      const form = new FormData(); form.set("file", file); form.set("page", String(page));
      const response = await fetch("/api/plans/extract", { method: "POST", body: form, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : typeof data.detail === "string" ? data.detail : typeof data.error === "string" ? data.error : "We could not read this drawing. Please try another file.");
      if (!controller.signal.aborted) openDocument(PlanDocumentSchema.parse(data));
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not read the drawing."); }
    finally { if (request.current === controller) { setBusy(false); request.current = null; } }
  };
  const loadDemo = async (venue: "mcenery" | "coex" = "mcenery") => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/plans/demo?venue=${venue}`, { signal: controller.signal });
      if (!response.ok) throw new Error("The demo PDF is unavailable. Upload a drawing to continue.");
      const file = new File([await response.blob()], venue === "coex" ? "COEX Hall A 2024.pdf" : "McEnery Convention Center.pdf", { type: "application/pdf" });
      if (!controller.signal.aborted) await extract(file);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load the demo."); }
    finally { if (request.current === controller) { setBusy(false); request.current = null; } }
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((items) => items.slice(0, -1)); current.current = previous; setDocument(previous); save(previous);
    setWidth(previous.widthMeters?.toString() ?? ""); setHeight(previous.heightMeters?.toString() ?? "");
  };
  const exportPlan = () => {
    if (!document) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
    const a = window.document.createElement("a"); a.href = url; a.download = "muvilion-plan.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restore = (raw: string) => {
    try { openDocument(PlanDocumentSchema.parse(JSON.parse(raw))); setSourceFile(null); setError(null); }
    catch { setError("This is not a supported muvilion plan. Your current drawing has been kept."); }
  };
  const selectedLine = document?.lines.find((line) => line.id === selected);
  const wallCount = document?.lines.filter((line) => line.kind === "wall").length ?? 0;
  const unknownCount = document?.lines.filter((line) => line.kind === "unknown").length ?? 0;
  const cropSpace = async (a: Point, b: Point) => {
    if (!document || busy) return;
    setBusy(true); setError(null);
    try {
      const next = await cropPlan(document, a, b);
      change(next); setSelected(null); setMeasure(null); setWidth(next.widthMeters?.toString() ?? ""); setHeight(next.heightMeters?.toString() ?? ""); setChatKey((k) => k + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not crop this space."); }
    finally { setBusy(false); setCropping(false); }
  };
  const drawWall = (a: Point, b: Point) => {
    if (!document) return;
    change({ ...document, lines: [...document.lines, { id: `manual-${crypto.randomUUID()}`, a, b, kind: "wall", origin: "manual", confidence: 1 }] });
  };
  const classify = (kind: "wall" | "dimension" | "unknown") => {
    if (!document || !selectedLine) return;
    change({ ...document, lines: document.lines.map((line) => line.id === selected ? { ...line, kind } : line) });
  };
  const calibrate = () => {
    if (!document || !measure || !(Number(distance) > 0)) return;
    const pixels = Math.hypot((measure[1].x - measure[0].x) * document.source.width, (measure[1].y - measure[0].y) * document.source.height);
    if (pixels < 3) { setError("Choose a longer segment for reliable calibration."); return; }
    const w = document.source.width / pixels * Number(distance), h = document.source.height / pixels * Number(distance);
    if (w > 2000 || h > 2000) { setError("The resulting extent is too large. Check the segment and its distance."); return; }
    change({ ...document, widthMeters: w, heightMeters: h, scaleConfirmed: true });
    setWidth(w.toFixed(2)); setHeight(h.toFixed(2)); setCalibrating(false); setMeasure(null);
  };
  const calibrated = document?.scaleConfirmed && document.widthMeters && document.heightMeters;

  return <main className="ps-studio">
    <header className="ps-header"><Link href="/" className="ps-brand" aria-label="muvilion home"><Mark small /><span>muvilion</span><span className="ps-brand-divider" /><span className="ps-brand-caption">Spatial design studio</span></Link><div className="ps-header-actions"><span className="ps-private-note">Your space. Your canvas.</span><Button onClick={exportPlan} disabled={!document || busy}>Export plan <span aria-hidden="true">↗</span></Button></div></header>
    <div className="ps-workflow"><div className={!document ? "is-active" : "is-complete"}><span>01</span> Import a drawing</div><i /><div className={document && !calibrated ? "is-active" : calibrated ? "is-complete" : ""}><span>02</span> Review the space</div><i /><div className={calibrated ? "is-active" : ""}><span>03</span> Shape your design</div><span className="ps-workflow-note">With Muse</span></div>
    <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void extract(file); e.target.value = ""; }} />
    <input ref={restoreInput} type="file" accept=".json" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file && file.size <= 20 * 1024 * 1024) restore(await file.text()); else if (file) setError("Plan file must be smaller than 20 MB."); e.target.value = ""; }} />
    <div className="ps-workspace">
      <aside className="ps-sidebar">
        <section className="ps-section"><div className="ps-section-heading"><h2>Project source</h2><span className="ps-step-icon">↗</span></div>
          <button className="ps-upload" disabled={busy} onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy && e.dataTransfer.files[0]) void extract(e.dataTransfer.files[0]); }}><span className="ps-file-icon">＋</span><strong>{document ? "Replace drawing" : "Upload a floor plan"}</strong><span>Drop a file or browse</span><small>PDF · PNG · JPG · DXF</small></button>
          {document && <div className="ps-source-card"><span className="ps-file-type">{document.source.format.toUpperCase()}</span><strong title={document.source.name}>{document.source.name}</strong><span>{document.source.width} × {document.source.height} · page {document.source.page}</span></div>}
          {document && document.source.pages > 1 && <label className="ps-field">Drawing page<select value={document.source.page} disabled={busy || !sourceFile} onChange={(e) => { if (sourceFile) void extract(sourceFile, Number(e.target.value)); }}>{Array.from({ length: document.source.pages }, (_, i) => <option key={i} value={i + 1}>Page {i + 1}</option>)}</select>{!sourceFile && <small>Re-upload the source to change pages.</small>}</label>}
          {document && <><Button className="ps-full-button" variant={cropping ? "primary" : "secondary"} disabled={busy} onClick={() => { setCropping((v) => !v); setCalibrating(false); setDrawing(false); setMeasure(null); setMode("plan"); }}>{cropping ? "Cancel crop" : "Crop to space"}</Button>{cropping && <p className="ps-help" style={{ marginTop: 9 }}>Click opposite corners of one space. Cropping clears design objects; use Undo to restore.</p>}</>}
          <button className="ps-demo" onClick={() => void loadDemo()} disabled={busy}><span className="ps-demo-plan">▱</span><span><strong>Explore a real venue</strong><small>Facebook F8 · San Jose</small></span><span>→</span></button>
          <button className="ps-demo" onClick={() => void loadDemo("coex")} disabled={busy}><span className="ps-demo-plan">▱</span><span><strong>Explore a detailed plan</strong><small>COEX Hall A · dimensions included</small></span><span>→</span></button>
          <div className="ps-source-links"><button onClick={() => restoreInput.current?.click()} disabled={busy}>Open saved JSON</button>{!document && <button onClick={() => { try { const raw = localStorage.getItem(STORAGE); if (raw) restore(raw); else setNotice("No saved plan yet. Upload a drawing to start."); } catch { setError("Browser storage is unavailable."); } }}>Restore last plan</button>}</div>
        </section>
        <section className="ps-section"><div className="ps-section-heading"><h2>Real-world scale</h2>{calibrated ? <Badge tone="ok">Confirmed</Badge> : <span className="ps-small-muted">Needs review</span>}</div><p className="ps-help">Pick a known distance on the drawing to set its scale.</p>
          <Button className="ps-full-button" disabled={!document || busy} variant={calibrating ? "primary" : "secondary"} onClick={() => { setCalibrating((v) => !v); setDrawing(false); setCropping(false); setMeasure(null); setMode("plan"); }}>{calibrating ? "Cancel measurement" : "Measure two points"}</Button>
          {calibrating && <div className="ps-calibration"><p className="ps-help">{measure ? "Enter the real distance between your two points." : "Click both ends of a known dimension on the plan."}</p><label className="ps-field">Known distance (m)<input type="number" min="0.01" step="0.01" value={distance} onChange={(e) => setDistance(e.target.value)} /></label><Button className="ps-full-button" variant="primary" disabled={!measure || !(Number(distance) > 0)} onClick={calibrate}>Apply scale</Button></div>}
          <p className="ps-help" style={{ marginTop: 15 }}>Or enter the full drawing extent:</p>
          <div className="ps-dimensions"><label className="ps-field">Width<input aria-label="Drawing width in metres" type="number" min="0.1" max="2000" step="0.01" value={width} placeholder="—" disabled={!document || busy} onChange={(e) => { setWidth(e.target.value); if (document?.scaleConfirmed) change({ ...document, scaleConfirmed: false }); }} /><span>m</span></label><label className="ps-field">Depth<input aria-label="Drawing depth in metres" type="number" min="0.1" max="2000" step="0.01" value={height} placeholder="—" disabled={!document || busy} onChange={(e) => { setHeight(e.target.value); if (document?.scaleConfirmed) change({ ...document, scaleConfirmed: false }); }} /><span>m</span></label></div>
          <Button className="ps-full-button" disabled={!document || busy || !(Number(width) > 0 && Number(width) <= 2000 && Number(height) > 0 && Number(height) <= 2000)} onClick={() => { if (document) change({ ...document, widthMeters: Number(width), heightMeters: Number(height), scaleConfirmed: true }); }}>Confirm dimensions <span>✓</span></Button>
        </section>
        {document && <DesignPanel document={document} onDocumentChange={change} />}
        <section className="ps-section ps-elements"><div className="ps-section-heading"><h2>Drawing elements</h2><span className="ps-small-muted">{document?.lines.length ?? 0}</span></div><div className="ps-element-row"><span><i className="ps-dot wall" /> Wall lines</span><strong>{wallCount}</strong></div><div className="ps-element-row"><span><i className="ps-dot unknown" /> Unclassified</span><strong>{unknownCount}</strong></div><div className="ps-element-row"><span><i className="ps-dot dimension" /> Dimension lines</span><strong>{document?.lines.filter((line) => line.kind === "dimension").length ?? 0}</strong></div><p className="ps-help">Select a line to review its role. Muse can help classify the drawing.</p>{document && document.lines.length > 0 && <label className="ps-field">Inspect element<select value={selected ?? ""} onChange={(e) => setSelected(e.target.value || null)}><option value="">Choose a line</option>{document.lines.map((line) => <option key={line.id} value={line.id}>{line.id} · {line.kind}</option>)}</select></label>}</section>
        <div className="ps-sidebar-footer"><span className="ps-status-dot" /> {document ? "Working on your drawing" : "Ready for your drawing"}</div>
      </aside>
      <section className="ps-center" aria-label="Drawing workspace">
        <div className="ps-canvas-toolbar"><div className="ps-canvas-title"><span className="eyebrow">{document ? "DRAWING WORKSPACE" : "NEW PROJECT"}</span><strong>{document ? document.source.name.replace(/\.[^.]+$/, "") : "Untitled space"}</strong></div><Segmented<Mode> options={[{ id: "source", label: "Source" }, { id: "plan", label: "2D plan" }, { id: "scene", label: "3D space" }]} value={mode} onChange={(next) => { setMode(next); setDrawing(false); setCalibrating(false); setCropping(false); setMeasure(null); }} label="Workspace view" /></div>
        {error && <div className="ps-alert" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
        {notice && <div className="ps-notice" role="status">{notice}</div>}
        <div className="ps-canvas-area">
          {document ? mode === "scene" ? <><SceneView document={document} wallHeight={wallHeight} selected={selected} onSelect={setSelected} /><div className="ps-scene-note">{calibrated ? "Scale confirmed" : "Illustrative scale · confirm dimensions"} · walls shown as 0.16 m thick</div>{wallCount === 0 && <div className="ps-scene-empty">Classify wall lines in 2D or ask Muse to review your drawing.</div>}</> : <PlanCanvas key={`${chatKey}-${drawing}-${calibrating}-${cropping}`} document={document} selected={selected} onSelect={setSelected} sourceOnly={mode === "source"} drawing={drawing || calibrating || cropping} rectangle={cropping} onDraw={cropping ? (a, b) => void cropSpace(a, b) : calibrating ? (a, b) => setMeasure([a, b]) : drawWall} measurement={measure} /> : <EmptyPlan onUpload={() => input.current?.click()} onDemo={() => void loadDemo()} busy={busy} />}
          {busy && <div className="ps-loading" role="status"><div className="ps-spinner" /><strong>{cropping ? "Cropping your space" : "Reading your drawing"}</strong><span>{cropping ? "Keeping geometry inside the selected area." : "Extracting geometry and preparing the source preview."}</span>{!cropping && <button onClick={() => { request.current?.abort(); setBusy(false); }}>Cancel</button>}</div>}
        </div>
        <div className="ps-bottom-toolbar"><div className="ps-tool-buttons"><Button variant={drawing ? "primary" : "ghost"} disabled={!document || mode !== "plan" || busy || (document.lines.length >= 1200)} onClick={() => { setDrawing((v) => !v); setCalibrating(false); setCropping(false); setMeasure(null); }}>{drawing ? "Finish drawing" : "+ Draw wall"}</Button><Button variant="ghost" disabled={!history.length || busy} onClick={undo}>↶ Undo</Button></div><span>{cropping ? "Click opposite corners of the space to keep" : calibrating ? "Click two points along a known dimension" : drawing ? "Click two endpoints · Esc cancels the segment" : mode === "scene" ? "Drag to orbit · scroll to zoom" : document ? "Click a line to inspect" : "Start with a drawing or explore the demo"}</span></div>
        {document?.warnings.length ? <details className="ps-warnings"><summary>{document.warnings.length} source note{document.warnings.length === 1 ? "" : "s"} to review</summary><ul>{document.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details> : null}
      </section>
      <aside className="ps-right-panel">
        {selectedLine && document && <section className="ps-inspector"><div className="ps-section-heading"><h2>Selected element</h2><button className="ps-close" onClick={() => setSelected(null)} aria-label="Close element inspector">×</button></div><span className="ps-small-muted">{selectedLine.id} · {selectedLine.origin}</span><div className="ps-classify">{(["wall", "dimension", "unknown"] as const).map((kind) => <button key={kind} aria-pressed={selectedLine.kind === kind} onClick={() => classify(kind)}>{kind === "unknown" ? "Unclassified" : kind === "wall" ? "Wall" : "Dimension"}</button>)}</div><div className="ps-endpoints"><span>Start <b>{selectedLine.a.x.toFixed(3)}, {selectedLine.a.y.toFixed(3)}</b></span><span>End <b>{selectedLine.b.x.toFixed(3)}, {selectedLine.b.y.toFixed(3)}</b></span></div><Button variant="danger" onClick={() => { change({ ...document, lines: document.lines.filter((line) => line.id !== selected) }); setSelected(null); }}>Remove line</Button></section>}
        {mode === "scene" && document && <section className="ps-inspector"><label className="ps-field">Preview wall height <div className="ps-height-control"><input type="number" min="0.5" max="30" step="0.1" value={wallHeight} onChange={(e) => { const n = Number(e.target.value); if (n >= 0.5 && n <= 30) setWallHeight(n); }} /><span>m</span></div></label><p className="ps-help">Height is a preview setting, not a measurement from your drawing.</p></section>}
        <StudioChat key={chatKey} document={document} onDocumentChange={change} />
      </aside>
    </div>
    <footer className="ps-footer"><span>muvilion <span> / </span> Make room for your ideas.</span><span>Editable geometry · Human-reviewed dimensions</span></footer>
  </main>;
}
