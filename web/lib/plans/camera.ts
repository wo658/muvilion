import type { PlanDocument } from './schema';
import { deriveWalls } from './walls';
import { findWalkSpawn, type WalkWorld } from './walk';
export type CameraView = 'overview' | 'top' | 'interior' | 'selection';
export type CameraPose = { eye: [number,number,number]; target: [number,number,number] };
export function navigationWorld(doc: PlanDocument): WalkWorld | null {
  if (!doc.scaleConfirmed || !doc.widthMeters || !doc.heightMeters || !doc.floorBoundary?.length) return null;
  const width=doc.widthMeters,depth=doc.heightMeters;
  return {width,depth,walls:deriveWalls(doc,{pairParallelEdges:true}),objects:doc.objects??[],boundary:doc.floorBoundary.map(p=>({x:p.x*width,y:p.y*depth})),ceilingHeight:doc.ceiling?.height,wallHeight:doc.wallHeight};
}
export function interiorPose(doc: PlanDocument): CameraPose | null {
  const world=navigationWorld(doc);
  if(!world) return null;
  const {width,depth}=world;
  const point=findWalkSpawn(world,doc.visualStyle==="exhibition" && doc.walkStart?{x:doc.walkStart.x*width,y:doc.walkStart.y*depth}:undefined);
  if(!point) return null;
  const x=point.x-width/2,z=point.y-depth/2;
  return {eye:[x,1.65,z],target:[x,1.65,z-0.01]};
}
export type FitBox = { cx: number; cz: number; width: number; depth: number; bottom: number; top: number };
const FOV = 40;
const MARGIN = 1.12;
const MIN_FOCUS = 6;

function extent(doc: PlanDocument) {
  const width=doc.widthMeters??10,depth=doc.heightMeters??width*doc.source.height/doc.source.width;
  return {width,depth};
}
/** Scene-space box of the reviewed floor, or the whole drawing without one. */
export function floorBox(doc: PlanDocument): FitBox {
  const {width,depth}=extent(doc);
  const points=doc.floorBoundary?.length?doc.floorBoundary:[{x:0,y:0},{x:1,y:1}];
  const xs=points.map(p=>(p.x-.5)*width),zs=points.map(p=>(p.y-.5)*depth);
  const [x0,x1,z0,z1]=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];
  return {cx:(x0+x1)/2,cz:(z0+z1)/2,width:x1-x0,depth:z1-z0,bottom:0,top:doc.wallHeight??3};
}
/** Scene-space box around the given objects/zones, padded to a readable minimum; null when none exist. */
export function itemsBox(doc: PlanDocument, ids: string[]): FitBox | null {
  const {width,depth}=extent(doc);
  const wanted=new Set(ids);
  const items=[...(doc.objects??[]),...(doc.zones??[])].filter(item=>wanted.has(item.id));
  if(!items.length) return null;
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,bottom=Infinity,top=0;
  for(const item of items){
    const turned=(item.rotation??0)%180===90,w=turned?item.depth:item.width,d=turned?item.width:item.depth;
    const cx=(item.x-.5)*width,cz=(item.y-.5)*depth;
    x0=Math.min(x0,cx-w/2);x1=Math.max(x1,cx+w/2);z0=Math.min(z0,cz-d/2);z1=Math.max(z1,cz+d/2);
    const base="elevation" in item?item.elevation??0:0,height="height" in item?item.height:0.1;
    bottom=Math.min(bottom,base);top=Math.max(top,base+height);
  }
  return {cx:(x0+x1)/2,cz:(z0+z1)/2,width:Math.max(MIN_FOCUS,x1-x0),depth:Math.max(MIN_FOCUS,z1-z0),bottom,top};
}
/** Camera distance at which the box's bounding sphere fits the narrower field of view with a margin. */
export function fitDistance(box: FitBox, aspect: number, fov=FOV) {
  const halfV=fov/2*Math.PI/180,halfH=Math.atan(Math.tan(halfV)*Math.max(.1,aspect));
  const radius=Math.hypot(box.width,box.depth,box.top-box.bottom)/2*MARGIN;
  return radius/Math.sin(Math.min(halfV,halfH));
}
/** Three-quarter view of a box from the south-east, fitted to the viewport. */
export function framePose(box: FitBox, aspect: number): CameraPose {
  const distance=fitDistance(box,aspect),cy=(box.bottom+box.top)/2;
  const dir=[.6,.8,.7],length=Math.hypot(...dir);
  return {eye:[box.cx+dir[0]/length*distance,cy+dir[1]/length*distance,box.cz+dir[2]/length*distance],target:[box.cx,cy,box.cz]};
}
/** Straight-down view whose footprint fits both viewport axes. */
export function topPose(doc: PlanDocument, aspect: number, fov=FOV): CameraPose {
  const box=floorBox(doc),halfV=fov/2*Math.PI/180,halfH=Math.atan(Math.tan(halfV)*Math.max(.1,aspect));
  const height=Math.max(box.depth/2/Math.tan(halfV),box.width/2/Math.tan(halfH))*MARGIN+box.top;
  return {eye:[box.cx,height,box.cz+0.001],target:[box.cx,0,box.cz]};
}
export function overviewPose(doc: PlanDocument, aspect=16/9): CameraPose {
  return framePose(floorBox(doc),aspect);
}
