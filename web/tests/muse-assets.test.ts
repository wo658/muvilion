import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { DesignObjectSchema, PlanDocumentSchema, type PlanDocument } from "@/lib/plans/schema";
import { applyDesignProposal, planChatContext } from "@/lib/plans/muse";
import { POST } from "@/app/api/plans/design/route";
import { getModel } from "@/server/agent/model";

vi.mock("@/server/agent/model", () => ({ getModel: vi.fn() }));
const document: PlanDocument = {
  schemaVersion: 1, source: { name: "hall.png", format: "image", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: 20, heightMeters: 20, scaleConfirmed: true,
  lines: [], texts: [], warnings: [], method: "opencv", wallHeight: 4,
};
const chair = { id: "chair", kind: "furniture", label: "라운지 의자", x: .4, y: .5, width: 1, depth: 1, height: 1, rotation: 0, color: "#aaaaaa", modelAssetId: "modern_arm_chair_01" };
const wall = { ...chair, id: "partition", kind: "partition", modelAssetId: undefined, materialAssetId: "Wood051" };
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
const call = (name: string, input: unknown) => ({ content: [{ type: "tool-call" as const, toolCallId: name, toolName: name, input: JSON.stringify(input) }], finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [] });
const request = () => new Request("http://localhost/api/plans/design", { method: "POST", body: JSON.stringify({ document, brief: "라운지 의자와 목재 가벽을 제안해줘" }) });

describe("Muse asset references", () => {
  it("preserves model/material IDs through proposal, context and JSON round trip without mutating the source", () => {
    const next = applyDesignProposal(document, { summary: "라운지", objects: [chair, wall], assumptions: [] });
    expect(next.objects?.[0]).toMatchObject({ modelAssetId: "modern_arm_chair_01" });
    expect(next.objects?.[1]).toMatchObject({ materialAssetId: "Wood051" });
    expect(PlanDocumentSchema.parse(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(planChatContext(next).objects).toEqual(next.objects);
    expect(document.objects).toBeUndefined();
    expect(next.source).toEqual(document.source);
  });
  it("rejects invented IDs, wrong asset kinds and model/material combinations", () => {
    for (const invalid of [
      { ...chair, modelAssetId: "https://evil.invalid/model.gltf" },
      { ...chair, modelAssetId: "missing" },
      { ...chair, kind: "light" },
      { ...chair, materialAssetId: "Wood051" },
      { ...wall, materialAssetId: "missing" },
    ]) expect(DesignObjectSchema.safeParse(invalid).success).toBe(false);
    expect(DesignObjectSchema.safeParse({ ...chair, modelAssetId: undefined }).success).toBe(true);
  });
  it("executes asset lookup, feeds its results back to the model and returns a proposal at the HTTP boundary", async () => {
    const model = new MockLanguageModelV4({ doGenerate: [
      call("search_design_assets", { category: "all", query: "" }),
      call("review_design", { summary: "CC0 라운지", objects: [chair, wall], assumptions: [] }),
      call("submit_design", { summary: "CC0 라운지", objects: [chair, wall], assumptions: [] }),
    ] });
    vi.mocked(getModel).mockReturnValue({ model, hasKey: true, provider: "test", modelId: "test" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).document.objects[0].modelAssetId).toBe("modern_arm_chair_01");
    expect(model.doGenerateCalls).toHaveLength(3);
    // Muse's provider supports auto only; restrict advertised tools rather than forcing tool_choice.
    expect(model.doGenerateCalls[0].toolChoice).toEqual({ type: "auto" });
    expect(model.doGenerateCalls[0].tools?.map(tool => tool.name)).toContain("search_design_assets");
    const toolMessages = model.doGenerateCalls[1].prompt.filter(message => message.role === "tool");
    expect(JSON.stringify(toolMessages)).toContain("modern_arm_chair_01");
    expect(JSON.stringify(toolMessages)).toContain("Wood051");
  });
  it("rejects an invalid asset in model output without returning an edited document", async () => {
    const model = new MockLanguageModelV4({ doGenerate: [
      call("search_design_assets", { category: "all", query: "" }),
      call("submit_design", { summary: "bad", objects: [{ ...chair, modelAssetId: "invented" }], assumptions: [] }),
    ] });
    vi.mocked(getModel).mockReturnValue({ model, hasKey: true, provider: "test", modelId: "test" });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty("document");
  });
  it("bounds repeated searches and fails rather than fabricating a submitted design", async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => call("search_design_assets", { category: "all", query: "" }) });
    vi.mocked(getModel).mockReturnValue({ model, hasKey: true, provider: "test", modelId: "test" });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(model.doGenerateCalls.length).toBeLessThanOrEqual(8);
    expect(await response.json()).not.toHaveProperty("document");
  });
});
