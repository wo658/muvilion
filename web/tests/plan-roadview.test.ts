import { describe, expect, it } from 'vitest';
import { canTravel, type WalkWorld } from '@/lib/plans/walk';
import type { DerivedWall } from '@/lib/plans/walls';
const wall=(x:number,y1:number,y2:number):DerivedWall=>({id:'w',evidenceIds:['w'],a:{x,y:y1},b:{x,y:y2},thickness:.01,thicknessSource:'provisional'});
const room=():WalkWorld=>({width:10,depth:10,walls:[],objects:[],ceilingHeight:3,boundary:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]});
describe('RoadView swept route',()=>{
 it('checks the path, not just the destination, even across thin walls',()=>{
  const world=room();world.walls=[wall(5.013,0,10)];
  expect(canTravel({x:2,y:5},{x:8,y:5},world)).toBe(false);
  expect(canTravel({x:2,y:5},{x:4,y:5},world)).toBe(true);
 });
 it('allows doorway clearance but rejects a narrow gap',()=>{
  const world=room();world.walls=[wall(5,0,4.5),wall(5,5.5,10)];
  expect(canTravel({x:2,y:5},{x:8,y:5},world)).toBe(true);
  world.walls=[wall(5,0,4.8),wall(5,5.2,10)];
  expect(canTravel({x:2,y:5},{x:8,y:5},world)).toBe(false);
 });
 it('rejects routes crossing a rotated booth and low overhead element',()=>{
  const world=room();world.objects=[{id:'booth',label:'Booth',kind:'booth',x:.5,y:.5,width:4,depth:1,height:2,rotation:90,color:'#ffffff'}];
  expect(canTravel({x:2,y:6},{x:8,y:6},world)).toBe(false);
  world.objects[0]={...world.objects[0],kind:'beam',elevation:1.7};
  expect(canTravel({x:2,y:6},{x:8,y:6},world)).toBe(false);
  world.objects[0].elevation=2.5;
  expect(canTravel({x:2,y:6},{x:8,y:6},world)).toBe(true);
 });
 it('rejects crossing outside a concave floor even with both endpoints inside',()=>{
  const world=room();world.boundary=[{x:0,y:0},{x:10,y:0},{x:10,y:3},{x:3,y:3},{x:3,y:10},{x:0,y:10}];
  expect(canTravel({x:8,y:2},{x:2,y:8},world)).toBe(false);
 });
 it('rejects low ceilings, nonfinite coordinates and oversized routes',()=>{
  const world=room();world.ceilingHeight=1.5;
  expect(canTravel({x:2,y:2},{x:3,y:2},world)).toBe(false);
  expect(canTravel({x:NaN,y:2},{x:3,y:2},room())).toBe(false);
  expect(canTravel({x:2,y:2},{x:1000,y:2},room())).toBe(false);
 });
});
