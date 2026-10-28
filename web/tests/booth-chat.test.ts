import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { boothExample } from "@/lib/booths/example";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { BoothChatRequest, boothChatContext, chatBooth } from "@/server/booths/chat";
import { createBoothProject, applyForBooth, reviewBoothApplication, updateBoothProject } from "@/server/booths/service";
import { RequestBody, chatPlan } from "@/server/plans/chat";
const mock = vi.hoisted(() => ({ stream: vi.fn((options: unknown) => ({ stream: {}, options })) }));
vi.mock("ai", async importOriginal => ({ ...await importOriginal<typeof import("ai")>(), streamText: mock.stream }));
vi.mock("@/server/agent/model", () => ({ getModel: () => ({ hasKey: true, model: {} }) }));
const messages = [{ role: "user" as const, parts: [{ type: "text" as const, text: "예산 100만원으로 부스 추천해줘" }] }];
let folder: string, previous: string | undefined;
beforeEach(() => { mock.stream.mockClear(); folder = mkdtempSync(join(tmpdir(), "booth-chat-")); previous = process.env.BOOTH_DB_PATH; process.env.BOOTH_DB_PATH = join(folder, "booths.sqlite"); });
afterEach(() => { if (previous === undefined) delete process.env.BOOTH_DB_PATH; else process.env.BOOTH_DB_PATH = previous; rmSync(folder, { recursive: true, force: true }); });
function setup() {
  const document = boothExample();
  document.source.name = "PRIVATE_ORIGINAL.pdf";
  document.texts = [{ id: "private", text: "PRIVATE_BUDGET", x: .1, y: .1 }];
  document.preview = "data:image/png;base64,UFJJVkFURQ==";
  const owner = createBoothProject({ title: "Exhibition", document, booths: [{ zoneId: "booth-a1", name: "A1", price: 750000, currency: "KRW", maxHeight: 3, description: "전기 포함" }] });
  const applicant = applyForBooth(owner.project.id, { boothId: owner.project.booths[0].id, company: "Brand", contactName: "Private Name", email: "private@example.com", brief: "제품 체험" });
  return { owner, applicant };
}
describe("role-scoped Muse context", () => {
  it("supplies published prices and public geometry without uploads, private references or applicants", () => {
    const { owner } = setup();
    const input = BoothChatRequest.parse({ messages, selectedZoneId: "booth-a1", role: "organizer", document: { secret: "INJECTED" } });
    const context = boothChatContext(owner.project.id, input);
    expect(context.selectedBooth?.price).toBe(750000);
    expect(context.ownBooth).toBeNull();
    expect(PlanDocumentSchema.safeParse(context.space).success).toBe(true);
    const serialized = JSON.stringify(context);
    for (const secret of ["PRIVATE_ORIGINAL", "PRIVATE_BUDGET", "UFJJVkFURQ", "private@example.com", "Private Name", owner.organizerToken, "INJECTED"]) expect(serialized).not.toContain(secret);
    chatBooth(owner.project.id, input, undefined, new AbortController().signal);
    expect(mock.stream).toHaveBeenCalledWith(expect.objectContaining({ instructions: expect.stringContaining("not the venue designer") }));
    expect(mock.stream.mock.calls[0][0]).not.toHaveProperty("tools");
  });
  it("requires the matching application credential and refreshes price/availability from storage", () => {
    const { owner, applicant } = setup();
    const input = BoothChatRequest.parse({ messages, applicationId: applicant.application.id });
    expect(() => boothChatContext(owner.project.id, input)).toThrow("access key");
    const other = setup();
    expect(() => boothChatContext(owner.project.id, input, other.applicant.applicantToken)).toThrow("access key");
    reviewBoothApplication(owner.project.id, applicant.application.id, owner.organizerToken, "approved");
    updateBoothProject(owner.project.id, owner.organizerToken, { booths: [{ ...owner.project.booths[0], price: 800000 }] });
    const context = boothChatContext(owner.project.id, input, applicant.applicantToken);
    expect(context.booths[0]).toMatchObject({ price: 800000, available: false });
    expect(context.ownBooth).toMatchObject({ status: "approved", quotedPrice: 750000, company: "Brand" });
    expect(JSON.stringify(context)).not.toContain("private@example.com");
  });
  it("gives spatial Muse pricing drafts while keeping published versus proposed amounts explicit", () => {
    const input = RequestBody.parse({ messages, boothPricing: [{ name: "A1", width: 4, depth: 3, price: 750000, description: "전기 포함", published: false }] });
    chatPlan(input, new AbortController().signal);
    expect(mock.stream).toHaveBeenCalledWith(expect.objectContaining({ instructions: expect.stringContaining("suggested prices from published prices") }));
    expect(JSON.stringify(mock.stream.mock.calls)).toContain('750000');
    expect(JSON.stringify(mock.stream.mock.calls)).toContain('published');
  });
});
