import { describe, expect, it } from 'vitest';
import { interiorPose } from '@/lib/plans/camera';
import type { PlanDocument } from '@/lib/plans/schema';
const doc:PlanDocument={schemaVersion:1,source:{name:'room',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:10,heightMeters:10,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'opencv',floorBoundary:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}],ceiling:{height:3,status:'estimated',color:'#ffffff'}};
describe('interior camera viewpoint',()=>{
 it('requires reviewed scale and footprint, and rejects insufficient headroom',()=>{
  expect(interiorPose({...doc,scaleConfirmed:false})).toBeNull();
  expect(interiorPose({...doc,floorBoundary:undefined})).toBeNull();
  expect(interiorPose({...doc,ceiling:{...doc.ceiling!,height:1.5}})).toBeNull();
 });
 it('finds an interior eye point clear of installations and preserves document',()=>{
  const input={...doc,objects:[{id:'solid',kind:'equipment' as const,label:'Display',x:.5,y:.5,width:2,depth:2,height:2,rotation:0 as const,color:'#ffffff'}]};
  const before=JSON.stringify(input);const pose=interiorPose(input)!;
  expect(pose.eye[1]).toBe(1.65);expect(Math.abs(pose.eye[0])>1||Math.abs(pose.eye[2])>1).toBe(true);
  expect(JSON.stringify(input)).toBe(before);
 });
});
