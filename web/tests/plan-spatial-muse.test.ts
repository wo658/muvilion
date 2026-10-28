import { describe, expect, it } from "vitest";
import { applyDesignProposal, planChatContext } from "@/lib/plans/muse";
import type { PlanDocument, DesignObject } from "@/lib/plans/schema";
const doc: PlanDocument = {
 schemaVersion:1, source:{name:"hall.pdf",format:"pdf",page:1,pages:1,width:100,height:100}, preview:"data:image/png;base64,AA==",widthMeters:20,heightMeters:20,scaleConfirmed:true,
 lines:[],texts:[],warnings:[],method:"pdf-vector",wallHeight:6,ceiling:{height:6,status:"estimated",color:"#eeeeee"},
 floorBoundary:[{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9}],
 zones:[{id:"experience",label:"Experience",purpose:"experience",x:0.5,y:0.5,width:8,depth:8,rotation:0,assignable:false}],
};
const sign:DesignObject={id:"sign",kind:"hanging-sign",label:"Welcome",x:0.5,y:0.5,width:3,depth:0.2,height:1,elevation:4,rotation:0,color:"#abcdef",zoneId:"experience"};
const proposal={summary:"Overhead sign",objects:[sign],assumptions:["Rigging requires separate review."]};
describe("Muse shared spatial model",()=>{
 it("receives all spatial and height conditions without preview or display filtering",()=>{
  const context=planChatContext({...doc,objects:[sign]});
  expect(context).toMatchObject({ceiling:doc.ceiling,wallHeight:6,floorBoundary:doc.floorBoundary,zones:doc.zones,objects:[sign],heightStatus:"estimated"});
  expect(context).not.toHaveProperty("preview");
 });
 it("supports booth-free design and preserves source and reviewed height conditions",()=>{
  const result=applyDesignProposal(doc,{...proposal,ceiling:{height:99},wallHeight:99,floorBoundary:[]});
  expect(result.objects).toEqual([{ ...sign, provenance: "ai" }]);expect(result.zones).toEqual(doc.zones);expect(result.ceiling).toEqual(doc.ceiling);expect(result.wallHeight).toBe(6);expect(result.floorBoundary).toEqual(doc.floorBoundary);expect(result.source).toEqual(doc.source);
 });
 it("rejects orphaned references after replacing zones and duplicate IDs",()=>{
  expect(()=>applyDesignProposal(doc,{...proposal,zones:[]})).toThrow(/unknown space zone/);
  expect(()=>applyDesignProposal(doc,{...proposal,zones:[doc.zones![0],doc.zones![0]]})).toThrow(/unique/);
 });
 it("allows explicitly clearing zones when no object references remain",()=>{expect(applyDesignProposal(doc,{...proposal,zones:[],objects:[]}).zones).toEqual([]);});
 it("reports a ceiling clash without silently changing the height constraint",()=>{
  const result=applyDesignProposal(doc,{...proposal,objects:[{...sign,elevation:5.5}]});
  expect(result.objects?.[0].elevation).toBe(5.5);expect(result.ceiling?.height).toBe(6);expect(result.warnings.some(w=>/ceiling/i.test(w))).toBe(true);
 });
});
