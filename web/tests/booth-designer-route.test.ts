import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/booths/projects/[id]/applications/[applicationId]/design/generate/route";
const mocked = vi.hoisted(() => ({ access: vi.fn(), generate: vi.fn() }));
vi.mock("@/server/booths/service", () => ({
  getApplicationAccess: mocked.access,
  BoothError: class extends Error { constructor(public status: number, message: string) { super(message); } },
}));
vi.mock("@/server/booths/designer", () => ({
  designBooth: mocked.generate,
  BoothDesignerError: class extends Error { constructor(public status: number, message: string) { super(message); } },
}));
const context = { params: Promise.resolve({ id: "project", applicationId: "application" }) };
const request = () => new Request("http://localhost/api/booths/test", { method: "POST", headers: { authorization: `Bearer ${"a".repeat(43)}` }, body: JSON.stringify({ brief: "Design a counter" }) });
const approved = { application: { status: "approved", company: "Acme" }, booth: { id: "booth" }, document: {} };
beforeEach(() => { mocked.access.mockReset(); mocked.generate.mockReset(); });
describe("booth design generation access boundary", () => {
  it("does not run the model for pending participants", async () => {
    mocked.access.mockReturnValue({ ...approved, application: { ...approved.application, status: "pending" } });
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(mocked.generate).not.toHaveBeenCalled();
  });
  it("only passes the authorized booth context and rechecks status before delivery", async () => {
    mocked.access.mockReturnValueOnce(approved).mockReturnValueOnce({ ...approved, application: { ...approved.application, status: "rejected" } });
    mocked.generate.mockResolvedValue({ document: {} });
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(mocked.generate).toHaveBeenCalledWith(expect.objectContaining({ booth: approved.booth, company: "Acme", brief: "Design a counter" }));
  });
});
