import { expect, it } from 'vitest';
import { PlanDocumentSchema } from '@/lib/plans/schema';
import { interiorPose, navigationWorld } from '@/lib/plans/camera';
import { canStand } from '@/lib/plans/walk';
const base={schemaVersion:1,source:{name:'concept',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:10,heightMeters:10,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'opencv',floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]};
it('round-trips appearance and respects the same physical bounds',()=>{
 const doc=PlanDocumentSchema.parse({...base,visualStyle:'exhibition',objects:[{id:'screen',kind:'equipment',label:'Muse',appearance:'screen',x:.5,y:.5,width:2,depth:1,height:3,rotation:0,color:'#ffffff'}]});
 const saved=PlanDocumentSchema.parse(JSON.parse(JSON.stringify(doc)));
 expect(saved.objects?.[0].appearance).toBe('screen');
 expect(canStand({x:5,y:5},navigationWorld(saved)!)).toBe(false);
 expect(canStand({x:2,y:2},navigationWorld(saved)!)).toBe(true);
});
it('uses a reviewed concept entry point but falls back when it is blocked',()=>{
 const doc=PlanDocumentSchema.parse({...base,visualStyle:'exhibition',walkStart:{x:.3,y:.7}});
 expect(interiorPose(doc)?.eye).toEqual([-2,1.65,2]);
 doc.walkStart={x:0,y:0};
 const pose=interiorPose(doc)!;
 expect(canStand({x:pose.eye[0]+5,y:pose.eye[2]+5},navigationWorld(doc)!)).toBe(true);
});
