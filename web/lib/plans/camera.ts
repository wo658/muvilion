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
  const point=findWalkSpawn(world);
  if(!point) return null;
  const x=point.x-width/2,z=point.y-depth/2;
  return {eye:[x,1.65,z],target:[x,1.65,z-0.01]};
}
export function overviewPose(doc: PlanDocument): CameraPose {
 const width=doc.widthMeters??10,depth=doc.heightMeters??width*doc.source.height/doc.source.width;
 const span=Math.max(width,depth);
 return {eye:[span*.6,span*.8,span*.7],target:[0,0,0]};
}
