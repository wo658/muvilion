import { describe, expect, it, vi } from "vitest";
import { createPlanningSnapshot, planningReportHtml, printPlanningReport } from "@/lib/plans/planning-report";
import type { PlanDocument } from "@/lib/plans/schema";
import type { SourceLibrary } from "@/lib/sources/schema";
import type { PhotoShot } from "@/lib/plans/photography";

const image = "data:image/png;base64,aGVsbG8=";
const document = (): PlanDocument => ({ schemaVersion: 1, source: { name: "venue.png", format: "image", page: 1, pages: 1, width: 100, height: 80 }, preview: image, widthMeters: 10, heightMeters: 8, scaleConfirmed: true, lines: [], texts: [], warnings: ["Check ceiling dimensions"], method: "opencv", objects: [] });
const sources = (): SourceLibrary => ({ version: 1, drawingSelected: true, items: [{ id: "brand", kind: "brand", name: "Brand guide", selected: false, text: "A welcoming space", notes: "Use a clear entry", images: [image], url: "https://example.com/brand" }] });
const shot: PhotoShot = { id: "manual", eye: [1, 2, 3], target: [0, 0, 0], fov: 45, zoom: 1, aspect: 16 / 9, cutaway: true, ceilingMode: "hidden", showStructure: true, showOverhead: true };
const photo = { shot, image: "data:image/jpeg;base64,aGVsbG8=" };
function snapshot() { return createPlanningSnapshot(document(), sources(), photo, "2026-11-01T00:00:00.000Z", "snapshot-one"); }

describe("기획서 스냅샷과 출력", () => {
  it("일반 HTTP 미리보기에서도 캡처에 고유한 스냅샷 ID를 부여한다", () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    try {
      // HTTP origins expose getRandomValues but do not expose randomUUID.
      const first = createPlanningSnapshot(document(), sources(), photo);
      const second = createPlanningSnapshot(document(), sources(), photo);
      expect(first.id).toMatch(/^[a-f0-9]{32}$/);
      expect(second.id).not.toBe(first.id);
      expect(first.photo.image).toBe(photo.image);
    } finally { vi.unstubAllGlobals(); }
  });
  it("캡처 이후 편집이 기존 도면·브랜드·카메라 스냅샷을 바꾸지 않는다", () => {
    const plan = document(); const library = sources(); const captured = structuredClone(photo);
    const report = createPlanningSnapshot(plan, library, captured, "2026-11-01T00:00:00.000Z", "snapshot-one");
    plan.source.name = "changed.png"; library.items[0].notes = "changed"; captured.shot.eye[0] = 99;
    const html = planningReportHtml(report, { title: "My project", intent: "Visitor welcome", locale: "en" });
    expect(html).toContain("venue.png"); expect(html).toContain("Use a clear entry");
    expect(report.photo.shot.eye[0]).toBe(1); expect(html).not.toContain("changed.png");
  });
  it("도면·캡처·브랜드 근거·미확인 조건과 설치물 크기를 한 보고서로 출력한다", () => {
    const plan = document(); plan.scaleConfirmed = false;
    plan.objects = [{ id: "desk", kind: "furniture", label: "Welcome desk", x: .5, y: .5, width: 2, depth: 1, height: 1.2, rotation: 0, color: "#123456" }];
    const report = createPlanningSnapshot(plan, sources(), photo, "2026-11-01T00:00:00.000Z", "snapshot-one");
    const html = planningReportHtml(report, { title: "Welcome", intent: "Show the brand", locale: "en" });
    for (const text of ["Actual 3D capture", photo.image, image, "Brand guide", "Bookmark only", "Welcome desk", "2 × 1 × 1.2", "dimensions not confirmed", "Floor outline not reviewed", "Check ceiling dimensions", "not a construction drawing"]) expect(html).toContain(text);
    expect(html).toContain('data-report-snapshot="snapshot-one"'); expect(html).toContain("@page");
  });
  it("사용자 입력을 HTML로 실행하지 않고 외부 자료를 자동 요청하지 않는다", () => {
    const library = sources(); library.items[0].name = '<img src=x onerror="alert(1)">'; library.items[0].notes = "</style><script>alert(1)</script>";
    library.items[0].url = "https://example.com/private?key=should-not-appear";
    const plan = document(); Object.assign(plan, { apiKey: "private-key" });
    const report = createPlanningSnapshot(plan, library, photo, "2026-11-01T00:00:00.000Z", "snapshot-one");
    const html = planningReportHtml(report, { title: "<script>title</script>", intent: "<iframe src='https://example.com'>", locale: "en" });
    expect(html).not.toContain("<script>"); expect(html).not.toContain("<iframe"); expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/(?:src|href)=["']https?:/); expect(html).not.toContain("private-key"); expect(html).not.toContain("should-not-appear");
  });
  it("외부 캡처 URL이나 빈 제목을 출력으로 수락하지 않는다", () => {
    expect(() => createPlanningSnapshot(document(), sources(), { ...photo, image: "https://example.com/photo.jpg" })).toThrow();
    expect(() => planningReportHtml(snapshot(), { title: " ", intent: "", locale: "en" })).toThrow("Title is required.");
  });
  it("한국어 제목·본문·출력 안내를 보존한다", () => {
    const html = planningReportHtml(snapshot(), { title: "브랜드 공간 기획서", intent: "방문자가 편하게 쉬는 공간", locale: "ko" });
    expect(html).toContain('<html lang="ko">'); expect(html).toContain("브랜드 공간 기획서"); expect(html).toContain("방문자가 편하게 쉬는 공간"); expect(html).not.toContain("undefined");
  });
});


describe("기획서 인쇄 준비", () => {
  function popup(images: { decode: () => Promise<void> }[], fonts: Promise<unknown> = Promise.resolve()) {
    return { opener: {}, closed: false, close: vi.fn(), focus: vi.fn(), print: vi.fn(), document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), images, fonts: { ready: fonts } } };
  }
  it("모든 이미지와 글꼴이 준비된 뒤 인쇄하고 보고서 창은 남긴다", async () => {
    let imageReady!: () => void;
    let fontReady!: () => void;
    const window = popup([{ decode: () => new Promise<void>(resolve => { imageReady = resolve; }) }], new Promise(resolve => { fontReady = () => resolve(undefined); }));
    const output = printPlanningReport(window as unknown as Window, "<html>Report</html>", new AbortController().signal);
    expect(window.print).not.toHaveBeenCalled(); imageReady(); await Promise.resolve(); expect(window.print).not.toHaveBeenCalled();
    fontReady(); await output;
    expect(window.print).toHaveBeenCalledOnce(); expect(window.close).not.toHaveBeenCalled(); expect(window.opener).toBeNull();
  });
  it("이미지 로딩 실패를 빈 PDF 성공으로 처리하지 않는다", async () => {
    const window = popup([{ decode: () => Promise.reject(new Error("broken image")) }]);
    await expect(printPlanningReport(window as unknown as Window, "<html>Report</html>", new AbortController().signal)).rejects.toThrow("Report images could not load");
    expect(window.print).not.toHaveBeenCalled(); expect(window.close).toHaveBeenCalledOnce();
  });
  it("도면·소스 변경으로 취소하면 준비 중 보고서를 닫고 인쇄하지 않는다", async () => {
    const window = popup([{ decode: () => new Promise<void>(() => {}) }]);
    const abort = new AbortController();
    const output = printPlanningReport(window as unknown as Window, "<html>Report</html>", abort.signal);
    abort.abort();
    await expect(output).rejects.toThrow();
    expect(window.print).not.toHaveBeenCalled(); expect(window.close).toHaveBeenCalledOnce();
  });
});
