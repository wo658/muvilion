import { readReference, selectedReferences } from "@/lib/sources/files";
import { sourceContent } from "@/server/plans/sources";
import { describe, expect, it } from "vitest";
import { emptySources, SourceLibrarySchema, ReferenceSourceSchema } from "@/lib/sources/schema";
const source = (id: string, selected: boolean) => ReferenceSourceSchema.parse({ id, kind: "concept", name: id, selected, images: ["data:image/jpeg;base64,AA=="], notes: `${id} notes` });

describe("project sources", () => {
  it("uses all project references, including legacy unselected materials, without rewriting stored data", async () => {
    const library = { ...emptySources(), items: [source("first", true), source("legacy", false)] };
    const references = await selectedReferences(library, null);
    expect(references.map(item => item.id)).toEqual(["first", "legacy"]);
    expect(references.every(item => item.selected)).toBe(true);
    expect(library.items[1].selected).toBe(false);
  });
  it("makes a newly uploaded brief available to Muse without another selection step", async () => {
    const item = await readReference(new File(["Visitor experience brief"], "brief.txt", { type: "text/plain" }), "brief");
    expect(item.selected).toBe(true);
    expect(item.text).toBe("Visitor experience brief");
  });
  it("includes selected content and image bytes, never deselected references", () => {
    const parts = sourceContent([source("included", true), source("private", false)]);
    expect(parts).toHaveLength(2);
    expect(JSON.stringify(parts)).toContain("included notes");
    expect(JSON.stringify(parts)).not.toContain("private");
    expect(parts[1]).toEqual({ type: "file", data: "data:image/jpeg;base64,AA==", mediaType: "image/jpeg" });
  });
  it("keeps URL bookmarks distinct from fetched page evidence", () => {
    const content = sourceContent([ReferenceSourceSchema.parse({ id: "brand", kind: "brand", name: "Brand", selected: true, url: "https://example.com", notes: "Silver" })]);
    expect(JSON.stringify(content)).toContain('urlFetched');
    expect(content).toHaveLength(1);
  });
  it("rejects unsafe URLs, remote image fetches and duplicate IDs", () => {
    expect(ReferenceSourceSchema.safeParse({ ...source("a", true), url: "javascript:alert(1)" }).success).toBe(false);
    expect(ReferenceSourceSchema.safeParse({ ...source("a", true), images: ["https://example.com/a.png"] }).success).toBe(false);
    expect(SourceLibrarySchema.safeParse({ ...emptySources(), items: [source("a", true), source("a", false)] }).success).toBe(false);
  });
  it("round-trips document content and selections for project export/restore", () => {
    const library = { ...emptySources(), drawingSelected: false, items: [source("one", false), ReferenceSourceSchema.parse({ id: "brief", kind: "brief", name: "Plan", selected: true, text: "20 guests", notes: "Keep stage" })] };
    expect(SourceLibrarySchema.parse(JSON.parse(JSON.stringify(library)))).toEqual(library);
  });
});
