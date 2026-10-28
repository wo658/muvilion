import { describe, expect, it } from "vitest";
import { applyInterpretation, applyDesignProposal, planChatContext, interpretationEvidence } from "@/lib/plans/muse";
import type { PlanDocument } from "@/lib/plans/schema";

const doc: PlanDocument = {
  schemaVersion: 1,
  source: { name: "test.pdf", format: "pdf", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
  lines: [
    { id: "a", a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, kind: "unknown", origin: "vector", confidence: 0.5 },
    { id: "b", a: { x: 0, y: 0 }, b: { x: 0, y: 1 }, kind: "wall", origin: "vector", confidence: 1 },
  ],
  texts: [], warnings: [], method: "pdf-vector",
};
const proposal = (id = "a", confidence = 0.9) => ({ summary: "A wall candidate", classifications: [{ id, kind: "wall", confidence }], uncertainties: [] });

describe("Muse drawing interpretation boundaries", () => {
  it("preserves geometry, source, dimensions, and existing human classifications", () => {
    const result = applyInterpretation(doc, proposal());
    expect(result.lines[0].kind).toBe("wall");
    expect(result.lines[0].a).toEqual(doc.lines[0].a);
    expect(result.lines[0].b).toEqual(doc.lines[0].b);
    expect(result.lines[1]).toEqual(doc.lines[1]);
    expect(result.source).toEqual(doc.source);
    expect(result.scaleConfirmed).toBe(false);
    expect(result.widthMeters).toBeNull();
    expect(doc.lines[0].kind).toBe("unknown");
  });
  it("rejects fabricated IDs, manual classifications and duplicate decisions", () => {
    expect(() => applyInterpretation(doc, proposal("invented"))).toThrow(/outside/);
    expect(() => applyInterpretation(doc, proposal("b"))).toThrow(/outside/);
    expect(() => applyInterpretation(doc, { ...proposal(), classifications: [...proposal().classifications, ...proposal().classifications] })).toThrow(/duplicate/);
  });
  it("keeps uncertain guesses unknown and excludes images from chat context", () => {
    expect(applyInterpretation(doc, proposal("a", 0.6)).lines[0].kind).toBe("unknown");
    expect(planChatContext(doc)).not.toHaveProperty("preview");
    expect(interpretationEvidence(doc).lines.map((line) => line.id)).toEqual(["a"]);
  });
});


describe("Muse design proposals", () => {
  const object = { id: "booth-a", kind: "booth", label: "Demo booth", x: 0.5, y: 0.5, width: 3, depth: 3, height: 2.4, rotation: 0, color: "#abcdef" };
  const proposal = { summary: "A starting concept", objects: [object], assumptions: ["Exit locations need review."] };
  it("requires confirmed dimensions and rejects duplicate IDs", () => {
    expect(() => applyDesignProposal(doc, proposal)).toThrow(/scale/);
    const scaled = { ...doc, scaleConfirmed: true, widthMeters: 10, heightMeters: 10 };
    expect(() => applyDesignProposal(scaled, {...proposal,objects:[object,object]})).toThrow(/unique/);
  });
  it("replaces concept objects while preserving all source geometry and dimensions", () => {
    const scaled = { ...doc, scaleConfirmed: true, widthMeters: 10, heightMeters: 10 };
    const next = applyDesignProposal(scaled, proposal);
    expect(next.objects).toEqual([{ ...object, provenance: "ai" }]);
    expect(next.lines).toEqual(doc.lines);
    expect(next.widthMeters).toBe(10);
    expect(next.warnings).toContain("Exit locations need review.");
    expect(planChatContext(next)).toHaveProperty("objects",[{ ...object, provenance: "ai" }]);
  });
  it("reports geometric conflicts rather than calling a draft feasible", () => {
    const next = applyDesignProposal({...doc,scaleConfirmed:true,widthMeters:10,heightMeters:10}, {...proposal,objects:[{...object,x:0}]});
    expect(next.warnings.some(warning=>warning.includes("outside"))).toBe(true);
  });
});
