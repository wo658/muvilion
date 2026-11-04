import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boothExample } from "@/lib/booths/example";
import { emptySources } from "@/lib/sources/schema";
import { applyPlanningEdit, createPlanningArtifact, emptyBoothCopy, planningBooths, planningIsStale, refreshPlanningArtifact, revisePlanningArtifact, PlanningArtifactSchema } from "@/lib/plans/planning-artifact";
import { emptyProject } from "@/lib/projects/schema";
import { createProject, saveProject, getProject, exportProject } from "@/server/projects/store";
import { withDatabase } from "@/server/database";
import { planningReportHtml, createPlanningSnapshot } from "@/lib/plans/planning-report";

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "planning-artifact-")); vi.stubEnv("MUVILION_DATA_DIR", directory); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
const artifact = () => createPlanningArtifact(boothExample(), emptySources(), "legacy-drawing", "ko");
const shot = { id: "booth-a1", eye: [1, 2, 3] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 40, zoom: 1, aspect: 16 / 9, cutaway: true, ceilingMode: "hidden" as const, showStructure: true, showOverhead: true };

describe("persistent planning document", () => {
  it("derives actual booth dimensions and excludes circulation and contained booth objects", () => {
    const plan = boothExample();
    plan.objects = [{ id: "nested", zoneId: "booth-a1", label: "Nested", kind: "booth", x: .2, y: .2, width: 1, depth: 1, height: 2, rotation: 0, color: "#123456" }];
    expect(planningBooths(plan)).toHaveLength(4);
    expect(planningBooths(plan)[0]).toMatchObject({ id: "booth-a1", width: 4, depth: 3 });
    expect(artifact().content.booths.every(b => b.fee.amount === null)).toBe(true);
  });
  it("patches only the requested booth and section; rejects unknown and duplicate IDs", () => {
    const a = artifact();
    const booth = { ...a.content.booths[0], fee: { ...a.content.booths[0].fee, amount: 1500000, basis: "User's planning assumption", includes: "Table and signage" } };
    const edit = { summary: "Updated", sections: [{ id: "overview" as const, text: "A new overview" }], booths: [booth], captureIds: [] };
    const next = applyPlanningEdit(a.content, edit);
    expect(next.booths[0].fee.amount).toBe(1500000);
    expect(next.booths.slice(1)).toEqual(a.content.booths.slice(1));
    expect(a.content.booths[0].fee.amount).toBeNull();
    expect(() => applyPlanningEdit(a.content, { ...edit, booths: [emptyBoothCopy("fake")] })).toThrow(/invalid/);
    expect(() => applyPlanningEdit(a.content, { ...edit, booths: [booth, booth] })).toThrow(/invalid/);
    expect(() => applyPlanningEdit(a.content, { ...edit, captureIds: ["unrelated"] })).toThrow(/invalid/);
  });
  it("persists photos, text and revision history as owned SQLite assets and round trips exports", () => {
    const a = artifact();
    a.photos = [{ targetId: "booth-a1", capturedAt: new Date().toISOString(), shot, image: "data:image/jpeg;base64,AQID" }];
    const p = createProject({ name: "Planning", state: { ...emptyProject(), document: a.basis.document, planningArtifacts: [a] } });
    const revised = revisePlanningArtifact(a, { ...a.content, title: "Revised document" });
    saveProject(p.id, { name: p.name, revision: 0, state: { ...p.state, planningArtifacts: [revised] } });
    expect(getProject(p.id).state.planningArtifacts?.[0]).toEqual(revised);
    withDatabase(db => expect(String(db.prepare("SELECT state_json FROM projects WHERE id = ?").get(p.id)?.state_json)).not.toContain("base64"));
    const imported = createProject(exportProject(p.id));
    expect(imported.state.planningArtifacts?.[0]).toEqual(revised);
    expect(() => saveProject(p.id, { name: p.name, revision: 0, state: p.state })).toThrow(/another tab/);
  });
  it("detects geometry/reference changes; explicit refresh clears photos and reconciles booth inventory", () => {
    const a = artifact();
    a.photos = [{ targetId: "booth-a1", capturedAt: new Date().toISOString(), shot, image: "data:image/jpeg;base64,AQID" }];
    const plan = structuredClone(a.basis.document); plan.zones = plan.zones!.filter(z => z.id !== "booth-a1");
    expect(planningIsStale(a, plan, emptySources())).toBe(true);
    expect(planningIsStale(a, a.basis.document, emptySources())).toBe(false);
    const updated = refreshPlanningArtifact(a, plan, emptySources());
    expect(updated.photos).toEqual([]); expect(updated.content.booths.some(b => b.id === "booth-a1")).toBe(false);
    expect(a.photos).toHaveLength(1);
  });
  it("keeps five text revisions and refuses photos of unrelated targets", () => {
    let a = artifact();
    for (let i = 0; i < 7; i++) a = revisePlanningArtifact(a, { ...a.content, title: `Version ${i}` });
    expect(a.history).toHaveLength(5); expect(a.history[4].content.title).toBe("Version 5");
    expect(PlanningArtifactSchema.safeParse({ ...a, photos: [{ targetId: "fake", shot, image: "data:image/jpeg;base64,AQID", capturedAt: new Date().toISOString() }] }).success).toBe(false);
  });
  it("prints participation details with real photos and escaped text", () => {
    const a = artifact(); a.content.booths[0].description = '<script>alert("x")</script>';
    a.content.booths[0].fee = { amount: 1500000, currency: "KRW", basis: "12 sqm estimate", includes: "Table", tax: "excluded" };
    a.photos = [{ targetId: "booth-a1", capturedAt: new Date().toISOString(), shot, image: "data:image/jpeg;base64,AQID" }];
    const snapshot = createPlanningSnapshot(a.basis.document, a.basis.sources, a.photos[0]);
    const html = planningReportHtml(snapshot, { title: a.content.title, intent: "", locale: "en" }, a);
    for (const text of ["Participation guide", "Estimated participation fee", "12 sqm estimate", "4 × 3 m", "data:image/jpeg;base64,AQID"]) expect(html).toContain(text);
    expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
  });
  it("uses activity zones as area cards when a design has no booths", () => {
    const zone = (id: string, purpose: string) => ({ id, label: id, purpose, x: .5, y: .5, width: 4, depth: 4, rotation: 0, assignable: false });
    const plan = { ...boothExample().document, zones: [zone("fitting", "experience"), zone("lounge", "lounge"), zone("main", "circulation"), zone("store", "operations"), zone("bar-aisle-south", "circulation")], objects: [] } as Parameters<typeof planningBooths>[0];
    expect(planningBooths(plan).map(b => b.id)).toEqual(["fitting", "lounge"]);
    expect(planningBooths({ ...plan, zones: [...plan.zones!, { ...zone("b1", "booth") }] }).map(b => b.id)).toEqual(["b1"]);
  });
});
