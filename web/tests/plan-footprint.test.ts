import {describe,it,expect} from 'vitest';
import {isSimpleFootprint} from '@/lib/plans/footprint';
import {cropEvidence} from '@/lib/plans/crop';
import type {PlanDocument} from '@/lib/plans/schema';
const outline=[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}];
describe('reviewed interior outline',()=>{
 it('accepts clockwise, counterclockwise and concave footprints',()=>{
  expect(isSimpleFootprint(outline)).toBe(true);expect(isSimpleFootprint([...outline].reverse())).toBe(true);
  expect(isSimpleFootprint([{x:0,y:0},{x:1,y:0},{x:.5,y:.5},{x:1,y:1},{x:0,y:1}])).toBe(true);
 });
 it('rejects crossed, overlapping, duplicate and degenerate outlines',()=>{
  expect(isSimpleFootprint([outline[0],outline[2],outline[1],outline[3]])).toBe(false);
  expect(isSimpleFootprint([outline[0],outline[0],outline[2]])).toBe(false);
  expect(isSimpleFootprint([{x:0,y:0},{x:.5,y:0},{x:1,y:0}])).toBe(false);
 });
 it('clears stale footprint and spawn when image coordinates change by cropping',()=>{
  const doc:PlanDocument={schemaVersion:1,source:{name:'test',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:10,heightMeters:10,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'opencv',floorBoundary:outline,walkStart:{x:.5,y:.5}};
  const next=cropEvidence(doc,{x:.2,y:.2,width:.5,height:.5});
  expect(next.floorBoundary).toBeUndefined();expect(next.walkStart).toBeUndefined();expect(next.scaleConfirmed).toBe(false);
 });
});
