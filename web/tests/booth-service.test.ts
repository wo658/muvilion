import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBoothProject, readBoothProject, updateBoothProject, applyForBooth, getApplicationAccess, reviewBoothApplication, saveBoothDesign } from "@/server/booths/service";
import { POST as createRoute } from "@/app/api/booths/projects/route";
import { GET as getRoute } from "@/app/api/booths/projects/[id]/route";
import { POST as applyRoute } from "@/app/api/booths/projects/[id]/applications/route";
import { PATCH as saveRoute } from "@/app/api/booths/projects/[id]/applications/[applicationId]/design/route";
import type { PlanDocument, DesignObject } from "@/lib/plans/schema";

const document: PlanDocument = {
  schemaVersion: 1, source: { name: "Private venue.pdf", format: "pdf", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: 20, heightMeters: 20, scaleConfirmed: true,
  lines: [], texts: [{ id: "secret", text: "Organizer private notes", x: 0, y: 0 }], warnings: [], method: "pdf-vector",
  zones: [{ id: "z1", label: "A1", purpose: "booth", x: 0.5, y: 0.5, width: 4, depth: 4, rotation: 0, assignable: true }],
};
const listing = { zoneId: "z1", name: "A1", price: 150000, currency: "KRW" as const, maxHeight: 3, description: "Includes power" };
const object: DesignObject = { id: "counter", kind: "furniture", label: "Counter", x: 0.5, y: 0.5, width: 1, depth: 1, height: 1, rotation: 0, color: "#ffffff" };
const design = { objects: [object], notes: "Brand counter", buildNotes: "Review materials with contractor", status: "draft" as const };
const request = (url: string, body?: unknown, token?: string) => new Request(`http://localhost${url}`, { method: body ? "POST" : "GET", ...(body ? { body: JSON.stringify(body) } : {}), headers: token ? { authorization: `Bearer ${token}` } : {} });
function setup() {
  const owner = createBoothProject({ title: "Trade fair", document, booths: [listing] });
  const applicant = applyForBooth(owner.project.id, { boothId: owner.project.booths[0].id, company: "Acme", contactName: "Kim", email: "private@example.com", brief: "Demo counter" });
  return { ...owner, ...applicant };
}
let folder: string;
let previousPath: string | undefined;
beforeEach(() => { folder = mkdtempSync(join(tmpdir(), "booth-tests-")); previousPath = process.env.BOOTH_DB_PATH; process.env.BOOTH_DB_PATH = join(folder, "booths.sqlite"); });
afterEach(() => { if (previousPath === undefined) delete process.env.BOOTH_DB_PATH; else process.env.BOOTH_DB_PATH = previousPath; rmSync(folder, { recursive: true, force: true }); });

describe("booth participation authorization and persistence", () => {
  it("returns only the catalogue publicly, and persists private application data across database reopenings", () => {
    const { project, organizerToken, application, applicantToken } = setup();
    const publicData = readBoothProject(project.id);
    expect(publicData.project).not.toHaveProperty("document");
    expect(publicData.project).not.toHaveProperty("applications");
    expect(JSON.stringify(publicData)).not.toContain("private@example.com");
    expect(JSON.stringify(publicData)).not.toContain(organizerToken);
    const owner = readBoothProject(project.id, organizerToken);
    expect(owner.project).toHaveProperty("applications", [application]);
    expect(getApplicationAccess(project.id, application.id, applicantToken).application).toEqual(application);
    expect(() => readBoothProject(project.id, applicantToken)).toThrow("organizer");
    expect(() => readBoothProject(project.id, "wrong")).toThrow("organizer");
  });
  it("isolates applicants and projects even when IDs are known", () => {
    const first = setup(), second = setup();
    expect(() => getApplicationAccess(first.project.id, first.application.id, second.applicantToken)).toThrow("access key");
    expect(() => getApplicationAccess(second.project.id, first.application.id, second.organizerToken)).toThrow("not found");
    expect(() => reviewBoothApplication(first.project.id, first.application.id, first.applicantToken, "approved")).toThrow("organizer");
  });
  it("allows only one approved participant per booth and freezes the quoted participation fee", () => {
    const { project, organizerToken, application } = setup();
    const other = applyForBooth(project.id, { boothId: project.booths[0].id, company: "Other", contactName: "Lee", email: "other@example.com", brief: "Other counter" });
    updateBoothProject(project.id, organizerToken, { booths: [{ ...listing, id: project.booths[0].id, price: 200000 }] });
    expect(getApplicationAccess(project.id, application.id, organizerToken).application.quotedPrice).toBe(150000);
    reviewBoothApplication(project.id, application.id, organizerToken, "approved");
    expect(() => reviewBoothApplication(project.id, other.application.id, organizerToken, "approved")).toThrow("already been approved");
    expect(readBoothProject(project.id).project.booths[0].available).toBe(false);
    expect(() => applyForBooth(project.id, { boothId: project.booths[0].id, company: "Third", contactName: "Choi", email: "third@example.com", brief: "Counter" })).toThrow("allocated");
    expect(() => reviewBoothApplication(project.id, application.id, organizerToken, "rejected")).toThrow("pending");
  });
  it("requires approval before saving and rejects invalid booth geometry", () => {
    const { project, organizerToken, application, applicantToken } = setup();
    expect(() => saveBoothDesign(project.id, application.id, applicantToken, design)).toThrow("approved");
    reviewBoothApplication(project.id, application.id, organizerToken, "approved");
    expect(() => saveBoothDesign(project.id, application.id, applicantToken, { ...design, objects: [{ ...object, width: 10 }] })).toThrow();
    expect(() => saveBoothDesign(project.id, application.id, applicantToken, { ...design, objects: [{ ...object, height: 4 }] })).toThrow();
    expect(() => saveBoothDesign(project.id, application.id, applicantToken, { ...design, objects: [], status: "submitted" })).toThrow("Add a booth design");
    saveBoothDesign(project.id, application.id, applicantToken, { ...design, status: "submitted" });
    expect(getApplicationAccess(project.id, application.id, applicantToken).application.design?.status).toBe("submitted");
  });
  it("does not grant design access to rejected participants", () => {
    const { project, organizerToken, application, applicantToken } = setup();
    reviewBoothApplication(project.id, application.id, organizerToken, "rejected");
    expect(() => saveBoothDesign(project.id, application.id, applicantToken, design)).toThrow("approved");
  });
  it("rejects overlapping published booths including rotated footprints, but allows adjacent booths", () => {
    const secondZone = { ...document.zones![0], id: "z2", label: "A2", x: 0.6, width: 2, depth: 4, rotation: 90 as const };
    const secondListing = { ...listing, zoneId: "z2", name: "A2" };
    expect(() => createBoothProject({ title: "Overlapping", document: { ...document, zones: [...document.zones!, secondZone] }, booths: [listing, secondListing] })).toThrow("footprints must not overlap");
    const adjacent = createBoothProject({ title: "Adjacent", document: { ...document, zones: [...document.zones!, { ...secondZone, x: 0.7 }] }, booths: [listing, secondListing] });
    expect(adjacent.project.booths).toHaveLength(2);
  });
  it("keeps walls, occupied volumes and circulation clear while allowing boundary walls and overhead clearance", () => {
    const wall = { id: "wall", a: { x: 0.5, y: 0.1 }, b: { x: 0.5, y: 0.9 }, kind: "wall" as const, origin: "manual" as const, confidence: 1 };
    expect(() => createBoothProject({ title: "Crossing", document: { ...document, lines: [wall] }, booths: [listing] })).toThrow("crosses an existing wall");
    expect(() => createBoothProject({ title: "Occupied", document: { ...document, objects: [object] }, booths: [listing] })).toThrow("physical installation");
    expect(() => createBoothProject({ title: "Passage", document: { ...document, zones: [...document.zones!, { ...document.zones![0], id: "passage", purpose: "circulation", assignable: false }] }, booths: [listing] })).toThrow("circulation");
    const clear = createBoothProject({ title: "Clear", document: { ...document, lines: [{ ...wall, a: { x: 0.4, y: 0.1 }, b: { x: 0.4, y: 0.9 } }], objects: [{ ...object, elevation: 3.5 }] }, booths: [listing] });
    expect(clear.project.booths).toHaveLength(1);
  });
  it("requires assignable, scaled, in-bounds listings and unique zone mappings", () => {
    expect(() => createBoothProject({ title: "Invalid", document: { ...document, scaleConfirmed: false }, booths: [listing] })).toThrow("scale");
    expect(() => createBoothProject({ title: "Invalid", document, booths: [listing, listing] })).toThrow("only one");
    expect(() => createBoothProject({ title: "Invalid", document: { ...document, zones: [{ ...document.zones![0], x: 0.99 }] }, booths: [listing] })).toThrow("boundary");
  });
});

describe("booth route validation", () => {
  it("maps malformed, oversized and unauthorized requests without exposing private details", async () => {
    const bad = await createRoute(request("/api/booths/projects", { title: "Bad" }));
    expect(bad.status).toBe(400);
    const huge = new Request("http://localhost/api/booths/projects", { method: "POST", body: "{}", headers: { "content-length": "17000000" } });
    expect((await createRoute(huge)).status).toBe(413);
    const { project, application, applicantToken } = setup();
    const ctx = { params: Promise.resolve({ id: project.id }) };
    expect((await getRoute(request("/x", undefined, "invalid"), ctx)).status).toBe(403);
    expect((await applyRoute(request("/x", { boothId: project.booths[0].id, email: "wrong" }), ctx)).status).toBe(400);
    const save = await saveRoute(request("/x", design, applicantToken), { params: Promise.resolve({ id: project.id, applicationId: application.id }) });
    expect(save.status).toBe(403);
    expect(save.headers.get("cache-control")).toBe("no-store");
  });
});
