"use client";
import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { CircleAlertIcon, FolderIcon, PanelLeftIcon, PlusIcon } from "lucide-react";
import { Button } from "../ui";
import { Input } from "../ui/input";
import { ProjectState, ProjectExport, emptyProject, type Project, type ProjectSummary } from "@/lib/projects/schema";
import { createProject, exportProject, listProjects, loadProject, uploadOriginal } from "@/lib/projects/client";
import { ProjectSession } from "@/lib/projects/session";
import { PlanDocumentSchema } from "@/lib/plans/schema";

import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage } from "@/lib/i18n/messages";
import "./project-workspace.css";

export type ProjectControls = {
  change: (state: ProjectState) => void;
  upload: (file: File) => Promise<string>;
  import: (raw: string) => Promise<void>;
  export: () => Promise<void>;
  navigate: (href: string) => void;
  /** Sidebar slot for editor actions; render `RailButton`s into it with a portal. */
  sidebar: HTMLElement | null;
};
/** Sidebar item: icon always, label only while the rail is expanded. */
export function RailButton({ icon, label, ...props }: { icon: ReactNode; label: string } & Omit<ComponentProps<"button">, "children">) {
  return <button type="button" className="pw-rail-button" aria-label={label} title={label} {...props}>{icon}<span className="pw-label">{label}</span></button>;
}
function Mark() {
  return <svg width={24} height={24} viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 29V13L18 6l13 7v16M5 13l13 7 13-7M18 20v15M11 16v16M25 16v16" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>;
}
function download(value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "muvilion-project.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ProjectWorkspace({ editor: Editor }: { editor: ComponentType<{ project: Project; controls: ProjectControls }> }) {
  const { t, locale } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Opening local projects…");
  const [switching, setSwitching] = useState(false);
  const session = useRef<ProjectSession | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const initial = useRef<Promise<Project> | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  function activate(next: Project) {
    session.current = new ProjectSession(next, undefined, summary => setProjects(items => [summary, ...items.filter(item => item.id !== summary.id)]));
    setProject(next); setName(next.name); setStatus("Saved to SQLite"); setError("");
    const url = new URL(window.location.href); url.searchParams.set("project", next.id); window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    let alive = true;
    // Keep one initialization promise under StrictMode so first open cannot create duplicates.
    initial.current ??= (async () => {
      const items = await listProjects();
      const id = new URL(window.location.href).searchParams.get("project");
      if (id) return loadProject(id);
      if (items.length) return loadProject(items[0].id);
      return createProject("Untitled project");
    })();
    void initial.current.then(async next => {
      const items = await listProjects();
      if (alive) { setProjects(items); activate(next); }
    }).catch(error => { if (alive) { setError(error.message); setStatus("Could not open the project."); initial.current = null; } });
    return () => { alive = false; };
  }, [attempt]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (session.current?.pending) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", leave);
    return () => { window.removeEventListener("beforeunload", leave); if (timer.current) clearTimeout(timer.current); };
  }, []);
  async function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try { await session.current?.flush(); setStatus("Saved to SQLite"); setError(""); }
    catch (error) { setStatus("Not saved"); setError(error instanceof Error ? error.message : "Could not save project."); throw error; }
  }
  function changed(state: ProjectState, nextName?: string) {
    session.current?.update(state, nextName);
    setStatus("Unsaved changes");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush().catch(() => {}); }, 400);
  }
  async function switchProject(id?: string) {
    setSwitching(true);
    try { await flush(); const next = id ? await loadProject(id) : await createProject("Untitled project"); await flush(); activate(next); setProjects(await listProjects()); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not open project."); }
    finally { setSwitching(false); }
  }
  if (!project) return <main className="p-6"><h1>muvilion</h1><p role="status">{localizeMessage(locale, status)}</p>{error && <><p role="alert">{localizeMessage(locale, error)}</p><Button onClick={() => setAttempt(value => value + 1)}>{t("Retry opening projects")}</Button><Button onClick={() => { initial.current = null; const url = new URL(window.location.href); url.searchParams.delete("project"); window.history.replaceState(null, "", url); setAttempt(value => value + 1); }}>{t("Open the latest project")}</Button></>}</main>;
  function navigate(href: string) { void flush().then(() => window.location.assign(href)).catch(() => {}); }
  const controls: ProjectControls = {
    change: state => { if (session.current?.project.id === project.id) changed(state); },
    navigate,
    sidebar: slot,
    upload: file => uploadOriginal(project.id, file),
    import: async raw => {
      const parsed = JSON.parse(raw);
      const bundle = parsed.projectVersion === 2 ? ProjectExport.parse(parsed) : null;
      const state = bundle?.state ?? (parsed.projectVersion === 1 ? ProjectState.parse(parsed) : { ...emptyProject(), document: PlanDocumentSchema.parse(parsed) });
      await flush();
      const imported = await createProject(bundle?.name ?? "Imported project", state, bundle?.assets ?? []);
      await flush(); activate(imported); setProjects(await listProjects());
    },
    export: async () => {
      // Export the current editor snapshot even after a failed save/conflict.
      const current = session.current!;
      const bundle = await exportProject(project.id);
      const ids = [...new Set([current.state.originalDrawingId, ...current.state.sources.items.map(item => item.originalAssetId)].filter((id): id is string => Boolean(id)))];
      for (const id of ids) if (!bundle.assets.some(file => file.id === id)) {
        const response = await fetch(`/api/projects/${project.id}/assets/${id}`);
        if (!response.ok) throw new Error("Could not export an original file.");
        const blob = await response.blob();
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
        bundle.assets.push({ id, name: current.state.sources.items.find(item => item.originalAssetId === id)?.name ?? current.state.document?.source.name ?? "original", mimeType: blob.type, data });
      }
      download({ ...bundle, name: current.name, state: current.state, assets: bundle.assets.filter(file => ids.includes(file.id)) });
    },
  };
  return <div className="pw-shell" data-collapsed={collapsed || undefined}>
    <nav className="pw-projects" aria-label={t("Local projects")}>
      <div className="pw-projects-head">
        <Link href="/" className="pw-brand" aria-label={t("muvilion home")} onClick={event => { event.preventDefault(); navigate("/"); }}><Mark/></Link>
        <button type="button" className="pw-rail-button pw-toggle" aria-expanded={!collapsed} aria-label={collapsed ? t("Show projects") : t("Hide projects")} title={collapsed ? t("Show projects") : t("Hide projects")} onClick={() => setCollapsed(value => !value)}><PanelLeftIcon/></button>
      </div>
      <RailButton icon={<PlusIcon/>} label={t("New project")} disabled={switching} onClick={() => void switchProject()}/>
      {collapsed
        ? <RailButton icon={<FolderIcon/>} label={t("Projects")} aria-expanded={false} onClick={() => setCollapsed(false)}/>
        : <>
          <h2 className="pw-heading">{t("Projects")}</h2>
          <ul className="pw-list">{projects.map(item => <li key={item.id}>
            {item.id === project.id
              ? <Input aria-label={t("Project name")} aria-current="page" value={name} maxLength={100} onBlur={() => { if (!name.trim()) setName(session.current!.name); }} onChange={event => { setName(event.target.value); if (event.target.value.trim()) changed(session.current!.state, event.target.value.trim()); }} />
              : <button type="button" disabled={switching} onClick={() => void switchProject(item.id)}>{item.name}</button>}
          </li>)}</ul>
        </>}
      <div ref={setSlot} className="pw-actions"/>
      {collapsed
        ? error && <RailButton icon={<CircleAlertIcon/>} label={localizeMessage(locale, error)} className="pw-rail-button pw-rail-alert" onClick={() => setCollapsed(false)}/>
        : <div className="pw-status">
          <span role="status">{localizeMessage(locale, status)}</span>
          {error && <><span role="alert">{localizeMessage(locale, error)}</span><Button onClick={() => { if (session.current) session.current.failure = null; void flush().catch(() => {}); }}>{t("Retry save")}</Button></>}
        </div>}
    </nav>
    <div className="pw-editor" inert={switching || undefined}><Editor key={project.id} project={project} controls={controls}/></div>
  </div>;
}
