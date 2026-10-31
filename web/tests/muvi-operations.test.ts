import { describe, expect, it } from "vitest";
import { MuviOperationSchema, operationForTool, operationMotion, type MuviOperation } from "@/lib/muvi/operations";
import { applyDesignPatch, readDesignStream } from "@/lib/plans/design-stream";
import { PlanDocumentSchema } from "@/lib/plans/schema";

const runId = "b6d5b2cf-161e-4e76-a904-8e3cd9e28ea6";
const operation = (sequence: number, kind = "arrange") => ({ type: "operation", runId, sequence, operation: kind });
function stream(events: unknown[]) {
  const bytes = new TextEncoder().encode(events.map(event => JSON.stringify(event) + "\n").join(""));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 5) controller.enqueue(bytes.slice(i, i + 5));
    controller.close();
  } }));
}

describe("Muvi operation stream", () => {
  it("uses chosen work gestures and safe tool fallbacks", () => {
    for (const motion of ["inspect", "measure", "arrange", "paint"])
      expect(operationForTool("edit_design", { operation: motion })).toBe(motion);
    expect(operationForTool("edit_design", {})).toBe("arrange");
    expect(operationForTool("edit_design", { operation: "delete_everything" })).toBe("arrange");
    expect(operationForTool("review_design", {})).toBe("measure");
    expect(operationForTool("generate_design_concept", {})).toBe("paint");
    expect(operationForTool("search_design_assets", {})).toBe("inspect");
    expect(operationForTool("extension", null)).toBe("inspect");
    expect(operationMotion(null)).toBe("walk");
  });
  it("delivers ordered cues interleaved with independent draft revisions", async () => {
    const seen: string[] = [];
    const preview = { type: "preview", revision: 1, label: "Draft", objects: [], zones: [], removeObjects: [], removeZones: [], warnings: [] };
    await readDesignStream(stream([operation(1, "inspect"), operation(2), preview, operation(3, "measure"), { type: "complete", result: {} }]),
      () => seen.push("preview"), event => seen.push(operationMotion(event)));
    expect(seen).toEqual(["inspect", "arrange", "preview", "measure"]);
  });
  it("rejects duplicate, missing, cross-run and malformed cues", async () => {
    for (const events of [
      [operation(1), operation(1)], [operation(2)],
      [operation(1), { ...operation(2), runId: "8fa39121-9e96-4715-b552-596244b5fb20" }],
      [operation(1, "unknown")],
    ]) await expect(readDesignStream(stream([...events, { type: "complete", result: {} }]), () => {})).rejects.toThrow();
  });
  it("keeps failed/cancelled streams terminal and cancels their reader", async () => {
    const seen: MuviOperation[] = [];
    await expect(readDesignStream(stream([operation(1), { type: "error", error: "failed" }, operation(2)]), () => {}, e => seen.push(e))).rejects.toThrow("failed");
    expect(seen).toHaveLength(1);
    let cancelled = false;
    const response = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify(operation(1)) + "\n")); }, cancel() { cancelled = true; } }));
    await expect(readDesignStream(response, () => {}, () => { throw new DOMException("Stale design", "AbortError"); })).rejects.toThrow("Stale design");
    expect(cancelled).toBe(true);
  });
  it("never puts an operation in the edited document", () => {
    const base = PlanDocumentSchema.parse({ schemaVersion: 1, source: { name: "hall", format: "pdf", page: 1, pages: 1, width: 100, height: 100 }, preview: "data:image/png;base64,AA==", widthMeters: 20, heightMeters: 20, scaleConfirmed: true, lines: [], texts: [], warnings: [], method: "pdf-vector" });
    const draft = applyDesignPatch(base, { operation: "paint", label: "Finish", objects: [], zones: [], removeObjects: [], removeZones: [] });
    expect(JSON.stringify(draft)).not.toContain('"operation"');
    expect(MuviOperationSchema.parse(operation(1)).sequence).toBe(1);
  });
});
