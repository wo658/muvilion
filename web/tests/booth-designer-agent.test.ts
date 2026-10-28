import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { designBooth } from "@/server/booths/designer";
import { createBoothDocument } from "@/lib/booths/design";
import type { DesignObject } from "@/lib/plans/schema";

const mocked = vi.hoisted(() => ({ getModel: vi.fn() }));
vi.mock("@/server/agent/model", () => ({ getModel: mocked.getModel }));
const bounds = { id: "allocated-a", name: "A", width: 4, depth: 3, maxHeight: 2.5 };
const object: DesignObject = { id: "counter", label: "Counter", kind: "furniture", x: 0.5, y: 0.5, width: 1, depth: 0.5, height: 1, rotation: 0, color: "#ffffff" };
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
const toolResult = (name: string, input: unknown) => ({
  content: [{ type: "tool-call" as const, toolCallId: `call-${name}`, toolName: name, input: JSON.stringify(input) }],
  finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
});

beforeEach(() => mocked.getModel.mockReset());
describe("Muse booth subagent", () => {
  it("looks up bundled assets before validating and submitting the selected model", async () => {
    const chair = { ...object, modelAssetId: "modern_arm_chair_01" as const };
    const model = new MockLanguageModelV4({ doGenerate: [
      toolResult("delegate_booth_design", {}),
      toolResult("search_design_assets", { query: "chair", category: "furniture" }),
      toolResult("validate_booth_design", { objects: [chair] }),
      toolResult("submit_design", { objects: [chair], summary: "암체어 배치", buildNotes: [] }),
    ] });
    mocked.getModel.mockReturnValue({ model, hasKey: true });
    const result = await designBooth({ booth: bounds, company: "Acme", brief: "암체어 배치" });
    expect(JSON.stringify(model.doGenerateCalls[2].prompt)).toContain("gltf-scene-bounds");
    expect(result.document.objects?.[0].modelAssetId).toBe(chair.modelAssetId);
    expect(model.doGenerateCalls.every(call => call.toolChoice?.type === "auto")).toBe(true);
  });
  it("delegates, observes failed validation, repairs and submits within isolated context", async () => {
    const model = new MockLanguageModelV4({ doGenerate: [
      toolResult("delegate_booth_design", {}),
      toolResult("validate_booth_design", { objects: [{ ...object, height: 4 }] }),
      toolResult("validate_booth_design", { objects: [object] }),
      toolResult("submit_design", { objects: [object], summary: "검사된 카운터 배치", buildNotes: ["마감재 협의"] }),
    ] });
    mocked.getModel.mockReturnValue({ model, hasKey: true });
    const currentDocument = createBoothDocument(bounds);
    currentDocument.texts.push({ id: "private", text: "DO_NOT_FORWARD_VENUE_DATA", x: 0, y: 0 });
    const result = await designBooth({ booth: bounds, company: "Acme", brief: "카운터 하나", locale: "ko", currentDocument });
    expect(model.doGenerateCalls).toHaveLength(4);
    expect(model.doGenerateCalls.every(call => call.toolChoice?.type === "auto")).toBe(true);
    expect(result.steps.map(step => step.tool)).toEqual(["delegate_booth_design", "validate_booth_design", "validate_booth_design", "submit_design"]);
    expect(result.document.objects).toEqual([{ ...object, provenance: "ai" }]);
    expect(result.handoff.status).toBe("concept");
    expect(JSON.stringify(model.doGenerateCalls)).not.toContain("DO_NOT_FORWARD_VENUE_DATA");
    expect(JSON.stringify(model.doGenerateCalls[2].prompt)).toContain("초과");
  });
  it("never fabricates a design when the model stops without a verified submission", async () => {
    const model = new MockLanguageModelV4({ doGenerate: [
      toolResult("delegate_booth_design", {}),
      { content: [{ type: "text", text: "Done" }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ] });
    mocked.getModel.mockReturnValue({ model, hasKey: true });
    await expect(designBooth({ booth: bounds, company: "Acme", brief: "Design" })).rejects.toMatchObject({ status: 502 });
  });
  it("bounds repeated invalid drafts to six specialist steps", async () => {
    const model = new MockLanguageModelV4({ doGenerate: [
      toolResult("delegate_booth_design", {}),
      ...Array.from({ length: 6 }, () => toolResult("validate_booth_design", { objects: [{ ...object, height: 4 }] })),
    ] });
    mocked.getModel.mockReturnValue({ model, hasKey: true });
    await expect(designBooth({ booth: bounds, company: "Acme", brief: "Design" })).rejects.toMatchObject({ status: 502 });
    expect(model.doGenerateCalls).toHaveLength(7);
  });
  it("fails before any model call when unconfigured", async () => {
    mocked.getModel.mockReturnValue({ hasKey: false });
    await expect(designBooth({ booth: bounds, company: "Acme", brief: "Design" })).rejects.toMatchObject({ status: 503 });
  });
});
