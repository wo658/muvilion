import { describe, expect, it, vi, afterEach } from "vitest";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { POST } from "@/app/api/plans/extract/route";
const document = {
  schemaVersion: 1, source: { name: "test.pdf", format: "pdf", page: 1, pages: 1, width: 100, height: 100 },
  preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
  lines: [{id:"l1",a:{x:0,y:0},b:{x:1,y:1},kind:"unknown",origin:"vector",confidence:0.5}],
  texts: [], warnings: [], method: "pdf-vector",
};
afterEach(() => vi.unstubAllGlobals());
describe("plan evidence boundary", () => {
  it("preserves unscaled evidence but rejects false calibrated state", () => {
    expect(PlanDocumentSchema.safeParse(document).success).toBe(true);
    expect(PlanDocumentSchema.safeParse({...document,scaleConfirmed:true}).success).toBe(false);
  });
  it("rejects duplicate identifiers and off-page evidence", () => {
    expect(PlanDocumentSchema.safeParse({...document,lines:[...document.lines,...document.lines]}).success).toBe(false);
    expect(PlanDocumentSchema.safeParse({...document,lines:[{...document.lines[0],a:{x:2,y:0}}]}).success).toBe(false);
  });
  it("rejects incompatible service results", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({wrong:"contract"})));
    const form = new FormData();form.set("file",new File(["%PDF-"],"test.pdf"));
    const response=await POST(new Request("http://localhost/api/plans/extract",{method:"POST",body:form}));
    expect(response.status).toBe(502);
  });
  it("does not call service for unsupported files", async () => {
    const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    const form=new FormData();form.set("file",new File(["x"],"test.exe"));
    expect((await POST(new Request("http://localhost/api/plans/extract",{method:"POST",body:form}))).status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
