import "server-only";
import { publicSpace } from "@/lib/booths/public-space";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { CreateBoothProjectSchema, UpdateBoothProjectSchema, ApplyForBoothSchema, SaveBoothDesignSchema, type BoothApplication, type BoothListing, type PublicBoothProject, type OrganizerBoothProject, type BoothApplicationAccess } from "@/lib/booths/schema";
import { createBoothDocument, validateBoothDesign } from "@/lib/booths/design";
import { footprintFitsBoundary, objectBounds, overlaps, segmentHitsRect } from "@/lib/plans/design";
import { withBoothDatabase, type BoothDatabase } from "./store";

export class BoothError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type StoredProject = Omit<OrganizerBoothProject, "applications" | "space">;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
function authorized(token: string | undefined, expected: string) {
  if (!token || token.length > 200) return false;
  return timingSafeEqual(Buffer.from(hash(token), "hex"), Buffer.from(expected, "hex"));
}
function getProject(db: BoothDatabase, projectId: string) {
  const row = db.prepare("SELECT * FROM booth_projects WHERE id = ?").get(projectId);
  if (!row) throw new BoothError(404, "Project not found.");
  return { project: JSON.parse(String(row.data)) as StoredProject, organizerHash: String(row.organizer_hash) };
}
function requireOrganizer(token: string | undefined, expected: string) {
  if (!authorized(token, expected)) throw new BoothError(403, "An organizer access key is required.");
}
function applications(db: BoothDatabase, projectId: string): BoothApplication[] {
  return db.prepare("SELECT data FROM booth_applications WHERE project_id = ? ORDER BY rowid DESC").all(projectId).map(row => JSON.parse(String(row.data)));
}
function publicProject(project: StoredProject, apps: BoothApplication[]): PublicBoothProject {
  return { id: project.id, title: project.title, createdAt: project.createdAt, space: publicSpace(project.document),
    booths: project.booths.map(booth => ({ ...booth, available: !apps.some(app => app.boothId === booth.id && app.status === "approved") })) };
}
export function createBoothProject(input: z.infer<typeof CreateBoothProjectSchema>) {
  const data = CreateBoothProjectSchema.parse(input);
  if (!data.document.scaleConfirmed) throw new BoothError(422, "Confirm the drawing scale before publishing booths.");
  if (new Set(data.booths.map(booth => booth.zoneId)).size !== data.booths.length) throw new BoothError(422, "Each space can have only one booth listing.");
  const booths: BoothListing[] = data.booths.map(booth => {
    const zone = data.document.zones?.find(zone => zone.id === booth.zoneId);
    if (!zone?.assignable) throw new BoothError(422, "Booths must reference spaces available for participant assignment.");
    const bounds = objectBounds(zone, data.document);
    if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > 1 || bounds.y + bounds.height > 1 || (data.document.floorBoundary && !footprintFitsBoundary(bounds, data.document.floorBoundary)))
      throw new BoothError(422, "A booth lies outside the reviewed floor boundary.");
    if (data.document.ceiling && booth.maxHeight > data.document.ceiling.height) throw new BoothError(422, "A booth height limit cannot exceed the venue ceiling.");
    return { ...booth, id: randomUUID(), width: zone.width, depth: zone.depth, available: true };
  });
  // Reserve disjoint, usable volumes. A wall exactly on a booth edge is allowed;
  // crossing its interior or occupying a designated passage is not.
  const footprints = booths.map(booth => objectBounds(data.document.zones!.find(zone => zone.id === booth.zoneId)!, data.document));
  for (let index = 0; index < booths.length; index++) {
    const booth = booths[index], bounds = footprints[index];
    if (footprints.slice(index + 1).some(other => overlaps(bounds, other)))
      throw new BoothError(422, "Published booth footprints must not overlap.");
    if (data.document.zones?.some(zone => zone.purpose === "circulation" && overlaps(bounds, objectBounds(zone, data.document))))
      throw new BoothError(422, `${booth.name} occupies a designated circulation space.`);
    const inset = 1e-9;
    const interior = { x: bounds.x + inset, y: bounds.y + inset, width: bounds.width - 2 * inset, height: bounds.height - 2 * inset };
    if (data.document.lines.some(line => line.kind === "wall" && segmentHitsRect(line.a, line.b, interior)))
      throw new BoothError(422, `${booth.name} crosses an existing wall.`);
    if (data.document.objects?.some(object => (object.elevation ?? 0) < booth.maxHeight - 1e-9 && overlaps(bounds, objectBounds(object, data.document))))
      throw new BoothError(422, `${booth.name} overlaps an existing physical installation within its height allowance.`);
  }
  const project: StoredProject = { id: randomUUID(), title: data.title, document: data.document, booths, createdAt: new Date().toISOString() };
  const organizerToken = randomBytes(32).toString("base64url");
  withBoothDatabase(db => db.prepare("INSERT INTO booth_projects (id, organizer_hash, data) VALUES (?, ?, ?)").run(project.id, hash(organizerToken), JSON.stringify(project)));
  return { project: { ...project, space: publicSpace(project.document), applications: [] } satisfies OrganizerBoothProject, organizerToken };
}
export function readBoothProject(projectId: string, token?: string) {
  return withBoothDatabase(db => {
    const { project, organizerHash } = getProject(db, projectId);
    const apps = applications(db, projectId);
    const visible = publicProject(project, apps);
    if (token !== undefined) {
      requireOrganizer(token, organizerHash);
      return { project: { ...visible, document: project.document, applications: apps } satisfies OrganizerBoothProject };
    }
    return { project: visible };
  });
}
export function updateBoothProject(projectId: string, token: string | undefined, input: z.infer<typeof UpdateBoothProjectSchema>) {
  const data = UpdateBoothProjectSchema.parse(input);
  return withBoothDatabase(db => {
    const { project, organizerHash } = getProject(db, projectId);
    requireOrganizer(token, organizerHash);
    const apps = applications(db, projectId);
    if (new Set(data.booths.map(booth => booth.id)).size !== data.booths.length) throw new BoothError(422, "Duplicate booth updates.");
    for (const patch of data.booths) {
      const booth = project.booths.find(item => item.id === patch.id);
      if (!booth) throw new BoothError(404, "Booth not found.");
      if (patch.maxHeight !== booth.maxHeight && apps.some(app => app.boothId === booth.id)) throw new BoothError(409, "Height limits cannot change after applications have been received.");
      if (project.document.ceiling && patch.maxHeight > project.document.ceiling.height) throw new BoothError(422, "A booth height limit cannot exceed the venue ceiling.");
      const zone = project.document.zones!.find(zone => zone.id === booth.zoneId)!;
      if (project.document.objects?.some(object => (object.elevation ?? 0) < patch.maxHeight - 1e-9 && overlaps(objectBounds(zone, project.document), objectBounds(object, project.document))))
        throw new BoothError(422, "The updated height allowance intersects an existing physical installation.");
      Object.assign(booth, patch);
    }
    db.prepare("UPDATE booth_projects SET data = ? WHERE id = ?").run(JSON.stringify(project), projectId);
    return { project: { ...publicProject(project, apps), document: project.document, applications: apps } satisfies OrganizerBoothProject };
  });
}
export function applyForBooth(projectId: string, input: z.infer<typeof ApplyForBoothSchema>) {
  const data = ApplyForBoothSchema.parse(input);
  return withBoothDatabase(db => {
    const { project } = getProject(db, projectId);
    const booth = project.booths.find(booth => booth.id === data.boothId);
    if (!booth) throw new BoothError(404, "Booth not found.");
    const apps = applications(db, projectId);
    if (apps.some(app => app.boothId === booth.id && app.status === "approved")) throw new BoothError(409, "This booth has already been allocated.");
    if (apps.length >= 1000) throw new BoothError(409, "This project has reached its application limit.");
    const application: BoothApplication = { ...data, id: randomUUID(), status: "pending", createdAt: new Date().toISOString(), quotedPrice: booth.price, currency: booth.currency };
    const applicantToken = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO booth_applications (id, project_id, booth_id, status, applicant_hash, data) VALUES (?, ?, ?, ?, ?, ?)").run(application.id, projectId, booth.id, application.status, hash(applicantToken), JSON.stringify(application));
    return { application, applicantToken };
  });
}
function applicationAccess(db: BoothDatabase, projectId: string, applicationId: string, token?: string): BoothApplicationAccess {
  const { project, organizerHash } = getProject(db, projectId);
  const row = db.prepare("SELECT * FROM booth_applications WHERE id = ? AND project_id = ?").get(applicationId, projectId);
  if (!row) throw new BoothError(404, "Application not found.");
  if (!authorized(token, organizerHash) && !authorized(token, String(row.applicant_hash))) throw new BoothError(403, "An application access key is required.");
  const application = JSON.parse(String(row.data)) as BoothApplication;
  const booth = project.booths.find(item => item.id === application.boothId)!;
  return { application, booth, document: createBoothDocument(booth, application.design?.objects ?? []) };
}
export function getApplicationAccess(projectId: string, applicationId: string, token?: string) {
  return withBoothDatabase(db => applicationAccess(db, projectId, applicationId, token));
}
export function reviewBoothApplication(projectId: string, applicationId: string, token: string | undefined, status: "approved" | "rejected") {
  return withBoothDatabase(db => {
    const { organizerHash } = getProject(db, projectId);
    requireOrganizer(token, organizerHash);
    const { application } = applicationAccess(db, projectId, applicationId, token);
    if (application.status === status) return { application };
    if (application.status !== "pending") throw new BoothError(409, "Only pending applications can be reviewed.");
    if (status === "approved" && applications(db, projectId).some(app => app.boothId === application.boothId && app.status === "approved")) throw new BoothError(409, "Another applicant has already been approved for this booth.");
    application.status = status;
    db.prepare("UPDATE booth_applications SET status = ?, data = ? WHERE id = ? AND project_id = ?").run(status, JSON.stringify(application), applicationId, projectId);
    return { application };
  });
}
export function saveBoothDesign(projectId: string, applicationId: string, token: string | undefined, input: z.infer<typeof SaveBoothDesignSchema>) {
  const data = SaveBoothDesignSchema.parse(input);
  return withBoothDatabase(db => {
    const { application, booth } = applicationAccess(db, projectId, applicationId, token);
    if (application.status !== "approved") throw new BoothError(403, "Only approved applicants can design this booth.");
    const issues = validateBoothDesign(booth, data.objects);
    if (issues.length) throw new BoothError(422, issues.join(" "));
    if (data.status === "submitted" && !data.objects.length) throw new BoothError(422, "Add a booth design before submitting it for construction review.");
    application.design = { ...data, updatedAt: new Date().toISOString() };
    db.prepare("UPDATE booth_applications SET data = ? WHERE id = ? AND project_id = ?").run(JSON.stringify(application), applicationId, projectId);
    return { application };
  });
}
