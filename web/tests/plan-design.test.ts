import { describe, expect, it } from "vitest";
import { designWarnings } from "@/lib/plans/design";
import type { PlanDocument, DesignObject } from "@/lib/plans/schema";
const object: DesignObject={id:"a",kind:"booth",label:"Booth",x:0.5,y:0.5,width:2,depth:2,height:2,rotation:0,color:"#ffffff"};
const doc:PlanDocument={schemaVersion:1,source:{name:"x",format:"image",page:1,pages:1,width:100,height:100},preview:"data:image/png;base64,AA==",widthMeters:10,heightMeters:10,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv",objects:[object]};
describe("design geometry checks",()=>{
 it("detects objects intersecting wall segments, including diagonal walls",()=>{
  expect(designWarnings({...doc,lines:[{id:"l",a:{x:0,y:0},b:{x:1,y:1},kind:"wall",origin:"vector",confidence:1}]})).toEqual(["Booth intersects a classified wall line."]);
 });
 it("does not mistake a nearby nonintersecting line for a collision",()=>{
  expect(designWarnings({...doc,lines:[{id:"l",a:{x:0,y:0},b:{x:0.2,y:0.2},kind:"wall",origin:"vector",confidence:1}]})).toEqual([]);
 });
 it("detects overlaps and out-of-bounds rotated objects",()=>{
  expect(designWarnings({...doc,objects:[object,{...object,id:"b",label:"Stage"}]})).toContain("Booth overlaps Stage.");
  expect(designWarnings({...doc,objects:[{...object,x:0.05,rotation:90}]})).toContain("Booth extends outside the drawing.");
 });
});
