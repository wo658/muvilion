import { describe, expect, it } from "vitest";
import { generatePhotoCandidates, PhotoIntentSchema, validPhotoTargets } from "@/lib/plans/photography";
import { navigationWorld } from "@/lib/plans/camera";
import { canStand, EYE_HEIGHT } from "@/lib/plans/walk";
import type { PlanDocument } from "@/lib/plans/schema";

const room: PlanDocument = {schemaVersion:1,source:{name:"Visitor hall",format:"image",page:1,pages:1,width:100,height:100},preview:"data:image/png;base64,AA==",widthMeters:90,heightMeters:63,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv",floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],ceiling:{height:6,status:"confirmed",color:"#ffffff"},objects:[{id:"display",kind:"equipment",label:"Display",x:.5,y:.5,width:3,depth:2,height:2.5,rotation:0,color:"#ffffff"}]};
const raw = {title:"Walk into the space",description:"A visitor looking into the installation",targetIds:[] as string[],azimuth:90,elevation:35,distanceScale:1};
const interior = {...raw,view:"interior" as const,framing:"subjects" as const};

describe("visitor eye-level photography",()=>{
 it("requests an enclosed interior even when the drawing has no saved ceiling",()=>{
  const source={...room,ceiling:undefined};
  const before=JSON.stringify(source);
  const shots=generatePhotoCandidates(source,interior);
  expect(shots).toHaveLength(4);
  expect(shots.every(shot=>shot.ceilingMode==="solid"&&!shot.cutaway)).toBe(true);
  expect(JSON.stringify(source)).toBe(before);
 });
 it("defaults an unspecified view to an interior photograph and permits a general space request",()=>{
  const intent=PhotoIntentSchema.parse(raw);
  expect(intent.view).toBe("interior");
  expect(validPhotoTargets(room,intent)).toBe(true);
  expect(generatePhotoCandidates(room,intent)).toHaveLength(4);
 });
 it("keeps eye and horizon at human height with a wider architectural lens and intact enclosure",()=>{
  const shots=generatePhotoCandidates(room,{...interior,targetIds:["display"]});
  expect(shots).toHaveLength(4);
  for(const shot of shots){
   expect(shot.eye[1]).toBe(EYE_HEIGHT);expect(shot.target[1]).toBe(EYE_HEIGHT);
   expect(shot.fov).toBe(60);expect(shot.cutaway).toBe(false);expect(shot.ceilingMode).toBe("solid");
  }
 });
 it("does not move outside a large venue to squeeze the whole hall into one interior image",()=>{
  const shots=generatePhotoCandidates({...room,objects:[]},{...interior,framing:"venue"});
  expect(shots).toHaveLength(4);
  const world=navigationWorld(room)!;
  for(const shot of shots){
   expect(Math.hypot(shot.eye[0]-shot.target[0],shot.eye[2]-shot.target[2])).toBeLessThanOrEqual(18);
   expect(canStand({x:shot.eye[0]+45,y:shot.eye[2]+31.5},world)).toBe(true);
  }
 });
 it("changes the actual visitor positions when the model revises direction or distance",()=>{
  const original=generatePhotoCandidates(room,interior);
  const turned=generatePhotoCandidates(room,{...interior,azimuth:150},1);
  const closer=generatePhotoCandidates(room,{...interior,distanceScale:.75},1);
  expect(turned.map(s=>s.eye)).not.toEqual(original.map(s=>s.eye));
  expect(closer.map(s=>s.eye)).not.toEqual(original.map(s=>s.eye));
  expect(Math.hypot(closer[0].eye[0],closer[0].eye[2])).toBeLessThan(Math.hypot(original[0].eye[0],original[0].eye[2]));
 });
 it("uses a nearby circulation lane while retaining the requested subject",()=>{
  const scene:PlanDocument={...room,zones:[{id:"aisle",label:"Visitor aisle",purpose:"circulation",x:.5,y:.56,width:12,depth:1.5,rotation:0,assignable:false}]};
  const shot=generatePhotoCandidates(scene,{...interior,targetIds:["display"]})[0];
  expect(shot.target).toEqual([0,EYE_HEIGHT,0]);
  expect(shot.eye[2]).toBeGreaterThan(3);
  expect(shot.eye[2]).toBeLessThan(4.6);
 });
 it("keeps visitor cameras within concave floor boundaries and clear of source walls and installations",()=>{
  const scene:PlanDocument={...room,widthMeters:12,heightMeters:12,floorBoundary:[{x:0,y:0},{x:.6,y:0},{x:.6,y:.6},{x:1,y:.6},{x:1,y:1},{x:0,y:1}],objects:[{...room.objects![0],x:.3,y:.3,width:1,depth:1}],lines:[{id:"wall",a:{x:.48,y:.05},b:{x:.48,y:.55},kind:"wall",origin:"manual",confidence:1}]};
  const shots=generatePhotoCandidates(scene,{...interior,targetIds:["display"]});
  expect(shots.length).toBeGreaterThan(0);
  const world=navigationWorld(scene)!;
  for(const shot of shots) expect(canStand({x:shot.eye[0]+6,y:shot.eye[2]+6},world)).toBe(true);
 });
 it("never invents an interior viewpoint without a boundary or when the floor is blocked",()=>{
  expect(generatePhotoCandidates({...room,floorBoundary:undefined},interior)).toEqual([]);
  expect(generatePhotoCandidates({...room,ceiling:{...room.ceiling!,height:1}},interior)).toEqual([]);
  const blocked={...room,objects:[{...room.objects![0],width:90,depth:63,height:3}]};
  expect(generatePhotoCandidates(blocked,interior)).toEqual([]);
 });
 it("preserves explicit elevated shots and leaves the document unchanged",()=>{
  const before=JSON.stringify(room);
  const shots=generatePhotoCandidates(room,{...interior,view:"overview"});
  expect(shots).toHaveLength(4);expect(shots.every(s=>s.eye[1]>EYE_HEIGHT&&s.cutaway&&s.fov===40)).toBe(true);
  expect(JSON.stringify(room)).toBe(before);
 });
});
