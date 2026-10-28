import { describe, expect, it } from "vitest";
import { displayWallHeight, partitionLabel } from "@/lib/plans/overview";
import { PlanDocumentSchema, type PlanDocument, type DesignObject } from "@/lib/plans/schema";
import { applyDesignProposal, planChatContext } from "@/lib/plans/muse";
import { cropEvidence } from "@/lib/plans/crop";
const object: DesignObject = { id: "wall", kind: "partition", label: "Divider", x: .5, y: .5, width: 3, depth: .2, height: 2.4, rotation: 0, color: "#ffffff", provenance: "manual" };
const document: PlanDocument = { schemaVersion: 1, source: { name: "hall", format: "image", page: 1, pages: 1, width: 100, height: 100 }, preview: "data:image/png;base64,AA==", widthMeters: 10, heightMeters: 10, scaleConfirmed: true, lines: [], texts: [], warnings: [], method: "opencv", objects: [object], entrances: [{ id: "entry", label: "Main entry", x: .2, y: .5, rotation: 90 }] };
describe("venue overview", () => {
 it("cuts away only the overview; interior retains physical heights", () => {
  expect(displayWallHeight(6, true, false)).toBe(1.1);
  expect(displayWallHeight(6, true, true)).toBe(6);
  expect(displayWallHeight(.7, true, false)).toBe(.7);
  expect(displayWallHeight(6, false, false)).toBe(6);
 });
 it("preserves entrance markings and manual provenance for unchanged proposals", () => {
  const result = applyDesignProposal(document, { summary: "Unchanged", objects: [{ ...object, provenance: "ai" }], assumptions: [] });
  expect(result.entrances).toEqual(document.entrances);
  expect(result.objects?.[0].provenance).toBe("manual");
  expect(planChatContext(result)).toHaveProperty("entrances", document.entrances);
 });
 it("marks changed elements as AI proposals even if the model claims manual origin", () => {
  const result = applyDesignProposal(document, { summary: "Moved", objects: [{ ...object, x: .6 }], assumptions: [] });
  expect(result.objects?.[0].provenance).toBe("ai");
  expect(partitionLabel(result.objects![0])).toBe("AI 제안 가벽");
 });
 it("round trips entrances, rejects duplicates, and remaps cropped markers", () => {
  expect(PlanDocumentSchema.parse(JSON.parse(JSON.stringify(document))).entrances).toEqual(document.entrances);
  expect(PlanDocumentSchema.safeParse({ ...document, entrances: [...document.entrances!, ...document.entrances!] }).success).toBe(false);
  expect(cropEvidence(document, { x: .1, y: 0, width: .5, height: 1 }).entrances?.[0].x).toBeCloseTo(.2);
  expect(cropEvidence(document, { x: .5, y: 0, width: .5, height: 1 }).entrances).toEqual([]);
 });
});
