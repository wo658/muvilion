"use client";
import { useEffect, useRef } from 'react';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { PlanDocument } from '@/lib/plans/schema';
import { interiorPose, overviewPose, type CameraView } from '@/lib/plans/camera';
export function SceneCamera({document,view,revision,selected}:{document:PlanDocument;view:CameraView;revision:number;selected:string|null}) {
 const ref=useRef<CameraControlsImpl>(null);
 const size=useThree(state=>state.size);
 const width=document.widthMeters??10,depth=document.heightMeters??width*document.source.height/document.source.width,span=Math.max(width,depth);
 const item=document.objects?.find(o=>o.id===selected)??document.zones?.find(z=>z.id===selected);
 const x=item?.x,y=item?.y;
 const w=item?.rotation===90?item.depth:item?.width,d=item?.rotation===90?item.width:item?.depth;
 useEffect(()=>{
  const controls=ref.current;if(!controls)return;
  const animate=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pose=view==='interior'?interiorPose(document):overviewPose(document);
  if(!pose)return;
  controls.minDistance=view==='interior'?0.01:0.1;
  controls.maxDistance=view==='interior'?0.01:span*4;
  void controls.zoomTo(1,false);
  if(view==='top') {void controls.setLookAt(0,span,0.001,0,0,0,animate);return;}
  if(view==='selection'&&x!==undefined&&y!==undefined&&w&&d){
   const object=document.objects?.find(o=>o.id===selected);
   const z=object?.elevation??0,h=object?.height??0.1;
   const cx=(x-.5)*width,cz=(y-.5)*depth;
   const halfFov=Math.min(20*Math.PI/180,Math.atan(Math.tan(20*Math.PI/180)*size.width/size.height));
   const distance=(Math.hypot(w,h,d)/2+1)/Math.sin(halfFov);
   void controls.setLookAt(cx+distance*0.5,z+h/2+distance*Math.SQRT1_2,cz+distance*0.5,cx,z+h/2,cz,animate);return;
  }
  void controls.setLookAt(...pose.eye,...pose.target,view==='interior'?false:animate);
 // Do not reset the camera on ordinary edits or selection changes. Buttons request a new view.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[view,revision,width,depth]);
 const A=CameraControlsImpl.ACTION;
 return <CameraControls ref={ref} makeDefault minPolarAngle={0.08} maxPolarAngle={view==='interior'?Math.PI-0.08:Math.PI/2.02} minZoom={0.5} maxZoom={3} smoothTime={0.22} mouseButtons={{left:A.ROTATE,middle:view==='interior'?A.NONE:A.DOLLY,right:view==='interior'?A.NONE:A.TRUCK,wheel:view==='interior'?A.ZOOM:A.DOLLY}} touches={{one:A.TOUCH_ROTATE,two:view==='interior'?A.TOUCH_ZOOM:A.TOUCH_DOLLY_TRUCK,three:view==='interior'?A.NONE:A.TOUCH_TRUCK}} />;
}
