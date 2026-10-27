"use client";

import Image from "next/image";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Draft, newProject, projectInput, STEP_LABELS, type ProjectDraft, type StoredProject } from "@/lib/projects/model";
import { deleteProject, exportProject, importProject, listProjects, saveProject } from "@/lib/projects/storage";
import { AccountDialog } from "./account-dialog";
import { Brand, GoogleMark, Icon } from "./primitives";
import { Illustration, ProjectWizard } from "./project-wizard";
import "./workspace.css";

const ReviewConsole = dynamic(() => import("../review-console").then((m) => m.ReviewConsole), { loading: () => <div className="ws-loading">분석 화면을 준비하고 있어요…</div> });
type SaveState = "saved" | "saving" | "error" | "invalid";
const SAVE_LABELS: Record<SaveState, string> = { saved: "이 브라우저에 저장됨", saving: "저장 중…", error: "저장 실패 · 백업을 내려받으세요", invalid: "입력값을 확인해 주세요" };

export function Workspace() {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [active, setActive] = useState<StoredProject | null>(null);
  const [ready, setReady] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedRevisions, setSavedRevisions] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  const pending = useRef(0);
  useEffect(() => {
    let cancelled = false;
    void listProjects().then((rows) => {
      if (!cancelled) { setProjects(rows); setSavedRevisions(Object.fromEntries(rows.map((p) => [p.draft.id, p.draft.updatedAt]))); setReady(true); }
    }).catch(() => {
      if (!cancelled) { setError("브라우저의 프로젝트를 불러오지 못했습니다. 저장 권한을 확인하거나 백업 파일을 가져와 주세요."); setReady(true); }
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => { if (pending.current || saveState === "error" || saveState === "invalid") e.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [saveState]);

  const persist = (project: StoredProject) => {
    const seq = ++revision.current;
    if (!Draft.safeParse(project.draft).success) { setSaveState("invalid"); return; }
    setSaveState("saving"); pending.current++;
    // Serialize writes so a slower earlier save cannot replace newer input.
    writes.current = writes.current.then(async () => {
      try {
        await saveProject(project);
        setSavedRevisions((saved) => ({ ...saved, [project.draft.id]: project.draft.updatedAt }));
        if (revision.current === seq) setSaveState("saved");
      }
      catch { if (revision.current === seq) setSaveState("error"); }
      finally { pending.current--; }
    });
  };
  const update = (draft: ProjectDraft, file?: Blob | null) => {
    const next = { draft: { ...draft, updatedAt: new Date().toISOString() }, file: file === undefined ? active?.file ?? null : file };
    setActive(next); setProjects((all) => [next, ...all.filter((p) => p.draft.id !== draft.id)]); persist(next);
  };
  const create = () => { const next = { draft: newProject(), file: null }; setActive(next); setProjects((all) => [next, ...all]); persist(next); setError(""); };
  const home = () => {
    if ((saveState === "invalid" || saveState === "error") && !window.confirm("아직 저장되지 않은 변경이 있습니다. 프로젝트 홈으로 이동할까요?")) return;
    setActive(null); setAnalyzing(false); setError("");
  };
  const backup = async (project: StoredProject) => { try { await exportProject(project); } catch { setError("백업 파일을 만들지 못했습니다. 다시 시도해 주세요."); } };
  const restore = async (file?: File) => {
    if (!file) return;
    try { const project = await importProject(file); setActive(project); setProjects((all) => [project, ...all]); persist(project); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "백업을 읽지 못했습니다."); }
  };
  const remove = async (id: string) => {
    try { await writes.current; await deleteProject(id); setProjects((all) => all.filter((p) => p.draft.id !== id)); setConfirmDelete(null); }
    catch { setError("프로젝트를 삭제하지 못했습니다. 다시 시도해 주세요."); }
  };
  const analyze = () => { if (!active) return; try { projectInput(active.draft); setAnalyzing(true); } catch (err) { setError((err as Error).message); } };
  const visible = projects.filter((p) => p.draft.name.toLowerCase().includes(query.toLowerCase()));

  if (analyzing && active) return <div className="ws-app"><div className="ws-analysis-bar"><button className="ws-text-button" onClick={() => setAnalyzing(false)}><Icon name="back" width="16" />프로젝트 설정</button><span>{active.draft.name}</span><span className="ws-storage-pill"><Icon name="check" width="14" />{SAVE_LABELS[saveState]}</span></div><ReviewConsole key={active.draft.id} project={projectInput(active.draft)} scenario={active.draft.scenario} /></div>;
  return <div className="ws-app">
    <header className="ws-header"><button className="ws-home-button" onClick={home} aria-label="프로젝트 홈"><Brand /></button><div className="ws-breadcrumb"><span>/</span>{active ? active.draft.name : "워크스페이스"}</div><div className="ws-header-actions"><span className="ws-storage-pill"><span className="ws-status-dot" />{active ? SAVE_LABELS[saveState] : "로컬 워크스페이스"}</span><button className="ws-button ws-google-header" onClick={() => setAccountOpen(true)}><GoogleMark />Google로 계속하기</button><button className="ws-avatar" aria-label="게스트 계정 옵션" onClick={() => setAccountOpen(true)}>G</button></div></header>
    {active ? <><div className="ws-project-bar"><button className="ws-text-button" onClick={home}><Icon name="back" width="16" />모든 프로젝트</button><span>게스트 프로젝트</span><button className="ws-text-button ml-auto" onClick={() => void backup(active)}><Icon name="download" width="16" />백업 내보내기</button></div><ProjectWizard key={active.draft.id} project={active} onChange={update} onAnalyze={analyze} onBackup={() => void backup(active)} saveState={SAVE_LABELS[saveState]} /></> : <div className="ws-home-layout">
      <aside className="ws-sidebar"><span className="ws-eyebrow">WORKSPACE</span><button className="ws-side-link active"><Icon name="grid" />내 프로젝트<span>{projects.length}</span></button><Link href="/demo" className="ws-side-link"><Icon name="play" />샘플 분석 보기<Icon name="arrow" width="14" /></Link><button className="ws-side-link" onClick={() => importInput.current?.click()}><Icon name="upload" />백업 가져오기</button><div className="ws-sidebar-bottom"><div className="ws-guest-tag"><span className="ws-avatar">G</span><div>게스트 워크스페이스<small>이 기기 · 이 브라우저</small></div></div><p>브라우저 데이터를 삭제하면 작업이 사라질 수 있어요. 중요한 프로젝트는 백업해 두세요.</p><button className="ws-text-button" onClick={() => setAccountOpen(true)}>계정으로 이어가기 <Icon name="arrow" width="14" /></button></div></aside>
      <main className="ws-home-content">
        <div className="ws-home-heading"><div><span className="ws-eyebrow">YOUR NEXT EVENT, BETTER PLANNED</span><h1>공간의 가능성을 계획하세요.</h1><p>도면에서 배치까지, 다음 행사를 위한 나만의 워크스페이스.</p></div><button className="ws-button ws-primary" onClick={create} disabled={!ready}><Icon name="plus" width="18" />새 프로젝트</button></div>
        <section className="ws-hero"><div><span className="ws-hero-badge"><span />도면 한 장으로 시작하기</span><h2>공간을 이해하고,<br />사람의 흐름을 설계하세요.</h2><p>부지 도면과 행사 조건을 입력하고<br />여러 배치안의 동선과 혼잡도를 비교하세요.</p><div className="ws-hero-actions"><button className="ws-button ws-primary" disabled={!ready} onClick={create}>게스트로 프로젝트 만들기 <Icon name="arrow" width="17" /></button><Link href="/demo" className="ws-text-button">샘플 둘러보기</Link></div><span className="ws-hero-note">설치 없이 · 로그인 없이 · 브라우저에 자동 저장</span></div><Illustration /><div className="ws-hero-caption"><span className="ws-eyebrow">A CLEARER VIEW OF YOUR EVENT</span><span>도면 → 공간 → 조건 → 분석</span></div></section>
        <section className="ws-project-section"><div className="ws-section-heading"><h2>내 프로젝트 <span>{projects.length}</span></h2><label className="ws-search"><Icon name="search" width="16" /><input aria-label="프로젝트 검색" placeholder="프로젝트 검색" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
          {!ready ? <div className="ws-empty">저장된 프로젝트를 불러오고 있어요…</div> : visible.length === 0 ? <div className="ws-empty"><span className="ws-empty-icon"><Icon name={query ? "search" : "file"} width="27" height="27" /></span><h3>{query ? "검색 결과가 없어요" : "첫 프로젝트를 시작해 보세요"}</h3><p>{query ? "다른 이름으로 검색해 주세요." : "PDF 도면을 올리거나 빈 공간에서 시작할 수 있어요."}</p>{!query && <button className="ws-text-button" onClick={create}>새 프로젝트 만들기 <Icon name="plus" width="16" /></button>}</div> : <div className="ws-project-grid">{visible.map((p) => <article key={p.draft.id} className="ws-project-card"><button className="ws-project-open" onClick={() => { setActive(p); setSaveState(savedRevisions[p.draft.id] === p.draft.updatedAt ? "saved" : "error"); }}><div className="ws-project-thumbnail">{p.draft.source ? <Image src={p.draft.source.preview} alt="" width={p.draft.source.width} height={p.draft.source.height} unoptimized /> : <Illustration />}<span className="ws-card-badge">{p.draft.setting === "indoor" ? "실내" : "야외"}</span></div><div className="ws-project-card-body"><h3>{p.draft.name || "이름 없는 프로젝트"}</h3><p>{STEP_LABELS[p.draft.step]}<span>·</span>{p.draft.booths}개 부스</p><div className="ws-progress"><span style={{ width: `${(p.draft.step + 1) * 25}%` }} /></div><small><Icon name="clock" width="12" />{new Date(p.draft.updatedAt).toLocaleDateString("ko-KR")} 수정<span>이어하기 →</span></small></div></button><div className="ws-card-actions"><span><span className="ws-status-dot" />{savedRevisions[p.draft.id] === p.draft.updatedAt ? "브라우저 저장" : "저장 대기 · 백업 권장"}</span><button className="ws-icon-button" aria-label={`${p.draft.name} 백업`} onClick={() => void backup(p)}><Icon name="download" width="16" /></button><button className="ws-icon-button" aria-label={`${p.draft.name} 삭제`} onClick={() => setConfirmDelete(p.draft.id)}><Icon name="trash" width="16" /></button></div>{confirmDelete === p.draft.id && <div className="ws-delete-confirm"><p>이 브라우저에서 프로젝트를 삭제할까요?</p><div><button className="ws-button ws-secondary" onClick={() => setConfirmDelete(null)}>취소</button><button className="ws-button ws-secondary" onClick={() => void remove(p.draft.id)}>삭제</button></div></div>}</article>)}</div>}
        </section>
        <div className="ws-home-footer"><span><Icon name="user" width="15" />게스트 작업은 이 브라우저에 보관됩니다.</span><button className="ws-text-button" onClick={() => setAccountOpen(true)}>Google 계정 연결 안내 <Icon name="arrow" width="14" /></button></div>
      </main>
    </div>}
    <input ref={importInput} type="file" accept=".json" hidden onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ""; }} />
    {error && <div className="ws-global-error" role="alert"><span>{error}</span><button className="ws-icon-button" aria-label="안내 닫기" onClick={() => setError("")}><Icon name="close" /></button></div>}
    {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
  </div>;
}
