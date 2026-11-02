"use client";
import { useEffect, useRef } from 'react';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import type { PlanDocument } from '@/lib/plans/schema';
import { floorBox, fitDistance, framePose, interiorPose, itemsBox, overviewPose, topPose, type CameraView } from '@/lib/plans/camera';
/** `focus` follows Muse's committed operations: changed element IDs (empty = whole floor) and a key that changes per operation. */
export function SceneCamera({document,view,revision,selected,focus=null,photography=false}:{photography?:boolean;document:PlanDocument;view:CameraView;revision:number;selected:string|null;focus?:{ids:string[];key:number}|null}) {
 const ref=useRef<CameraControlsImpl>(null);
 const size=useThree(state=>state.size);
 const get=useThree(state=>state.get);
 const width=document.widthMeters??10,depth=document.heightMeters??width*document.source.height/document.source.width,span=Math.max(width,depth);
 const item=document.objects?.find(o=>o.id===selected)??document.zones?.find(z=>z.id===selected);
 const x=item?.x,y=item?.y;
 const w=(item?.rotation ?? 0)%180===90?item?.depth:item?.width,d=(item?.rotation ?? 0)%180===90?item?.width:item?.depth;
 useEffect(()=>{
  const controls=ref.current;if(!controls)return;
  if(photography) {controls.minDistance=0.1;controls.maxDistance=span*8;return;}
  const camera=get().camera;
  if(camera instanceof PerspectiveCamera) {camera.fov=40;camera.updateProjectionMatrix();}
  const animate=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const aspect=size.width/Math.max(1,size.height);
  const pose=view==='interior'?interiorPose(document):view==='top'?topPose(document,aspect):overviewPose(document,aspect);
  if(!pose)return;
  controls.minDistance=view==='interior'?0.01:0.1;
  controls.maxDistance=view==='interior'?0.01:Math.max(span*4,fitDistance(floorBox(document),aspect)*1.5);
  void controls.zoomTo(1,false);
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
 },[view,revision,width,depth,photography,get]);
 // Follow each committed Muse operation in the overview/top views; never move an interior walk or a photo camera.
 useEffect(()=>{
  const controls=ref.current;
  if(!controls||!focus||photography||view==='interior')return;
  const aspect=size.width/Math.max(1,size.height);
  const box=focus.ids.length?itemsBox(document,focus.ids):null;
  const pose=box?framePose(box,aspect):overviewPose(document,aspect);
  void controls.setLookAt(...pose.eye,...pose.target,!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 // Only a new operation moves the camera; the document it reads is the committed result of that operation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[focus?.key]);
 const A=CameraControlsImpl.ACTION;
 const interior=view==='interior'&&!photography;
 return <CameraControls ref={ref} makeDefault minPolarAngle={0.08} maxPolarAngle={photography||interior?Math.PI-0.08:Math.PI/2.02} minZoom={0.5} maxZoom={3} smoothTime={0.22} mouseButtons={{left:A.ROTATE,middle:interior?A.NONE:A.DOLLY,right:interior?A.NONE:A.TRUCK,wheel:interior?A.ZOOM:A.DOLLY}} touches={{one:A.TOUCH_ROTATE,two:interior?A.TOUCH_ZOOM:A.TOUCH_DOLLY_TRUCK,three:interior?A.NONE:A.TOUCH_TRUCK}} />;
}
