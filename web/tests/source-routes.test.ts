import { beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ stream: vi.fn(), generate: vi.fn() }));
vi.mock("@/server/agent/model", () => ({ getModel: () => ({ hasKey: true, model: {} }) }));
vi.mock("ai", () => ({
  streamText: calls.stream,
  generateText: calls.generate,
  tool: (input: unknown) => input,
  toUIMessageStream: () => new ReadableStream({ start(controller) { controller.close(); } }),
  createUIMessageStreamResponse: () => new Response("ok"),
}));
import { POST as chat } from "@/app/api/plans/chat/route";
import { POST as design } from "@/app/api/plans/design/route";
import { POST as pdf } from "@/app/api/sources/pdf/route";
const source = (id: string, selected: boolean) => ({ id, kind: "brief", name: id, text: `${id} content`, selected });
const document = {
  schemaVersion: 1, source: { name: "hall.pdf", format: "pdf", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: 20, heightMeters: 20, scaleConfirmed: true,
  lines: [], texts: [{ id: "label", text: "Keep original text", x: 0.2, y: 0.2 }], warnings: [], method: "pdf-vector",
};
const request = (body: unknown) => new Request("http://localhost/test", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); calls.stream.mockReturnValue({ stream: {} }); });
describe("source-aware Muse routes", () => {
  it("passes only selected sources into chat model content", async () => {
    const response = await chat(request({ sources: [source("chosen", true), source("excluded", false)], messages: [{ role: "user", parts: [{ type: "text", text: "Summarize my brief" }] }] }));
    expect(response.status).toBe(200);
    expect(JSON.stringify(calls.stream.mock.calls[0][0].messages)).toContain("chosen content");
    expect(JSON.stringify(calls.stream.mock.calls[0][0].messages)).not.toContain("excluded content");
  });
  it("does not destroy drawing evidence when drafting with its reference deselected", async () => {
    calls.generate.mockResolvedValue({ toolCalls: [{ toolName: "submit_design", input: { summary: "Concept", objects: [], assumptions: [] } }] });
    const response = await design(request({ document, drawingSelected: false, brief: "Keep open", sources: [source("chosen", true), source("excluded", false)] }));
    expect(response.status).toBe(200);
    const modelInput = JSON.stringify(calls.generate.mock.calls[0][0].messages);
    expect(modelInput).toContain("chosen content");
    expect(modelInput).not.toContain("excluded content");
    expect(modelInput).not.toContain("Keep original text");
    expect((await response.json()).document.texts).toEqual(document.texts);
  });
  it("rejects unsafe reference URLs before calling the model", async () => {
    const response = await chat(request({ sources: [{ ...source("bad", true), url: "file:///etc/passwd" }], messages: [{ role: "user", parts: [{ type: "text", text: "Read" }] }] }));
    expect(response.status).toBe(400); expect(calls.stream).not.toHaveBeenCalled();
  });
  it("rejects non-PDF uploads without contacting the engine", async () => {
    const form = new FormData(); form.set("file", new File(["text"], "brief.docx"));
    const response = await pdf(new Request("http://localhost/test", { method: "POST", body: form }));
    expect(response.status).toBe(400);
  });
});
