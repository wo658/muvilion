import { describe,expect,it } from "vitest";
import { cropEvidence } from "@/lib/plans/crop";
import type { PlanDocument } from "@/lib/plans/schema";
const doc:PlanDocument={schemaVersion:1,source:{name:"x",format:"image",page:1,pages:1,width:100,height:100},preview:"data:image/png;base64,AA==",widthMeters:10,heightMeters:10,scaleConfirmed:true,lines:[{id:"line",a:{x:0,y:0.5},b:{x:1,y:0.5},kind:"wall",origin:"vector",confidence:1}],texts:[{id:"text",text:"inside",x:0.5,y:0.5},{id:"out",text:"outside",x:0,y:0}],warnings:[],method:"opencv"};
describe("crop coordinate mapping",()=>{
 it("clips crossing walls and maps text into the cropped frame",()=>{
  const crop=cropEvidence(doc,{x:0.25,y:0.25,width:0.5,height:0.5});
  expect(crop.lines[0].a).toEqual({x:0,y:0.5});expect(crop.lines[0].b).toEqual({x:1,y:0.5});
  expect(crop.texts).toHaveLength(1);expect(crop.texts[0].x).toBe(0.5);expect(crop.widthMeters).toBe(5);expect(crop.scaleConfirmed).toBe(false);
 });
 it("retains source provenance across repeated crops",()=>{
  const first=cropEvidence(doc,{x:0.2,y:0.2,width:0.6,height:0.6});
  const second=cropEvidence({...first,preview:doc.preview},{x:0.5,y:0,width:0.5,height:1});
  expect(second.source.crop).toEqual({x:0.5,y:0.2,width:0.3,height:0.6});
 });
 it("rejects invalid crop regions",()=>{expect(()=>cropEvidence(doc,{x:0.9,y:0,width:0.2,height:1})).toThrow();});
});
