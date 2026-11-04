import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ generate: vi.fn(), hasKey: true }));
vi.mock("ai", async importOriginal => ({ ...await importOriginal<typeof import("ai")>(), generateText: mock.generate }));
vi.mock("@/server/agent/model", () => ({ getModel: () => ({ model: {}, hasKey: mock.hasKey }) }));
import { POST } from "@/app/api/plans/planning/route";
import { boothExample } from "@/lib/booths/example";
import { emptySources } from "@/lib/sources/schema";
import { createPlanningArtifact } from "@/lib/plans/planning-artifact";
const input = () => { const artifact = createPlanningArtifact(boothExample(), emptySources(), "drawing", "en"); return { document: artifact.basis.document, content: artifact.content, sources: [], brief: "Set A1 participation fee to 1500000 KRW", locale: "en", target: "booth-a1" }; };
const request = (body: unknown) => new Request("http://localhost/api/plans/planning", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mock.hasKey = true; });
it("applies a targeted document fee revision without mutating source geometry", async () => {
  const body = input(); const original = structuredClone(body.document);
  mock.generate.mockResolvedValue({ toolCalls: [{ toolName: "update_planning_document", input: { summary: "A1 updated", sections: [], booths: [{ ...body.content.booths[0], fee: { amount: 1500000, currency: "KRW", basis: "User estimate", includes: "Pending", tax: "unknown" } }], captureIds: ["booth-a1"] } }] });
  const req = request(body); const response = await POST(req); const result = await response.json();
  expect(response.status).toBe(200); expect(result.content.booths[0].fee.amount).toBe(1500000);
  expect(result.content.booths[1]).toEqual(body.content.booths[1]); expect(body.document).toEqual(original);
  expect(result.captureIds).toEqual(["booth-a1"]);
  expect(mock.generate.mock.calls[0][0].abortSignal).toBe(req.signal);
});
it.each([{ calls: [] }, { calls: [{ toolName: "update_planning_document", input: { sections: [], booths: [] } }] }])("rejects missing or invalid model updates", async ({ calls: toolCalls }) => {
  mock.generate.mockResolvedValue({ toolCalls }); expect((await POST(request(input()))).status).toBe(502);
});
it("drops copy and photos for areas the drawing does not have instead of losing the update", async () => {
  mock.generate.mockResolvedValue({ toolCalls: [{ toolName: "update_planning_document", input: { summary: "Updated", sections: [{ id: "overview", text: "A furnished floor." }], booths: [], captureIds: ["overview", "invented-booth"] } }] });
  const response = await POST(request(input())); const body = await response.json();
  expect(response.status).toBe(200); expect(body.captureIds).toEqual(["overview"]);
  expect(body.content.sections.find((s: { id: string }) => s.id === "overview").text).toBe("A furnished floor.");
});
it("rejects stale booth inventories before invoking the model", async () => {
  const body = input(); body.content.booths.pop(); expect((await POST(request(body))).status).toBe(409); expect(mock.generate).not.toHaveBeenCalled();
});
it("reports missing configuration and malformed requests", async () => {
  mock.hasKey = false; expect((await POST(request(input()))).status).toBe(503); expect((await POST(request({}))).status).toBe(400);
});
