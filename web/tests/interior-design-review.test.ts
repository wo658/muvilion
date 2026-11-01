import { describe, expect, it } from "vitest";
import { DesignBriefSchema, DesignCoverageSchema, reviewDesignCoverage } from "@/lib/plans/design-review";
import { PlanDocumentSchema } from "@/lib/plans/schema";

const brief = DesignBriefSchema.parse({ scope: "interior", direction: "Warm timber lounge with teal partitions",
  requirements: [{id:"seats",label:"Two lounge chairs",target:"objects",kinds:["furniture"],minimum:2}] });
const chair = { id:"chair-1",kind:"furniture",label:"Chair",x:.3,y:.4,width:1,depth:1,height:1,rotation:0,color:"#335577" };
const document = PlanDocumentSchema.parse({schemaVersion:1,source:{name:"hall",format:"image",page:1,pages:1,width:100,height:100},
  preview:"data:image/png;base64,AA==",widthMeters:20,heightMeters:20,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv",
  objects:[chair,{...chair,id:"chair-2",x:.5}],zones:[{id:"lounge",label:"Lounge",purpose:"lounge",x:.5,y:.5,width:8,depth:8,rotation:0,assignable:false}]});
const coverage = (ids: string[]) => [{requirementId:"seats",ids,decision:"Paired seats face the product display."}];

describe("interior deliverable coverage", () => {
  it("identifies invalid evidence even when the requested quantity is already met", () => {
    const result=reviewDesignCoverage(brief,document,coverage(["chair-1","chair-2","lounge","invented"]));
    expect(result).toMatchObject({complete:false,requirements:[{minimum:2,count:2,satisfied:false,invalidIds:["lounge","invented"],allowedKinds:["furniture"],coverageEntryCount:1}]});
    expect(reviewDesignCoverage(brief,document,coverage(["chair-1","chair-2"]))).toMatchObject({complete:true,requirements:[{invalidIds:[],coverageEntryCount:1}]});
    expect(reviewDesignCoverage(brief,document,[])).toMatchObject({complete:false,requirements:[{coverageEntryCount:0}]});
    expect(reviewDesignCoverage(brief,document,[...coverage(["chair-1"]),...coverage(["chair-2"])])).toMatchObject({complete:false,requirements:[{coverageEntryCount:2}]});
  });
  it("reviews all two hundred requested furnishings instead of silently reducing the quantity to eighty", () => {
    const fullBrief=DesignBriefSchema.parse({...brief,requirements:[{...brief.requirements[0],label:"Two hundred event chairs",minimum:200}]});
    const fullDocument=PlanDocumentSchema.parse({...document,objects:Array.from({length:200},(_,i)=>({...chair,id:`chair-${i}`}))});
    const evidence=DesignCoverageSchema.parse(coverage(fullDocument.objects!.map(object=>object.id)));
    expect(reviewDesignCoverage(fullBrief,fullDocument,evidence)).toMatchObject({complete:true,requirements:[{minimum:200,count:200,satisfied:true}]});
    expect(reviewDesignCoverage(fullBrief,{...fullDocument,objects:fullDocument.objects!.slice(0,80)},evidence).complete).toBe(false);
    expect(DesignBriefSchema.safeParse({...brief,requirements:[{...brief.requirements[0],minimum:201}]}).success).toBe(false);
    expect(DesignCoverageSchema.safeParse(coverage([...evidence[0].ids,"chair-extra"])).success).toBe(false);
  });
  it("does not accept an interior brief consisting only of zones", () => {
    expect(DesignBriefSchema.safeParse({...brief,requirements:[{id:"zone",label:"Lounge",target:"zones",minimum:1}]}).success).toBe(false);
  });
  it("counts actual furniture, independently of unknown source walls", () => {
    expect(reviewDesignCoverage(brief,document,coverage(["chair-1","chair-2"]))).toMatchObject({complete:true,requirements:[{count:2,satisfied:true}]});
  });
  it.each([["lounge"],["chair-1","chair-1"],["chair-1","invented"],[]])("rejects zones, duplicate or missing IDs as furniture evidence: %s", (...ids) => {
    expect(reviewDesignCoverage(brief,document,coverage(ids)).complete).toBe(false);
  });
  it("rejects wrong object kinds and unreviewed requirements", () => {
    const stage = {...document,objects:document.objects!.map(o=>({...o,kind:"stage" as const}))};
    expect(reviewDesignCoverage(brief,stage,coverage(["chair-1","chair-2"])).complete).toBe(false);
    expect(reviewDesignCoverage(brief,document,[]).complete).toBe(false);
    expect(reviewDesignCoverage(brief,document,[...coverage(["chair-1","chair-2"]),...coverage([])]).complete).toBe(false);
  });
  it("allows deliberate zoning and removal edits without inventing furnishings", () => {
    const zoning = DesignBriefSchema.parse({scope:"zoning",direction:"Reserve a lounge",requirements:[{id:"zone",label:"Lounge footprint only",target:"zones",minimum:1}]});
    expect(reviewDesignCoverage(zoning,document,[{requirementId:"zone",ids:["lounge"],decision:"Footprint only, as requested."}]).complete).toBe(true);
    const edit = DesignBriefSchema.parse({scope:"edit",direction:"Remove chairs",requirements:[{id:"remove",label:"Leave area empty",target:"objects",minimum:0}]});
    expect(reviewDesignCoverage(edit,{...document,objects:[]},[{requirementId:"remove",ids:[],decision:"Chairs removed."}]).complete).toBe(true);
  });
});
