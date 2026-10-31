import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { generatePhotoCandidates, PhotoIntentSchema } from "@/lib/plans/photography";
import type { PlanDocument } from "@/lib/plans/schema";

const room: PlanDocument = {schemaVersion:1,source:{name:"hall",format:"image",page:1,pages:1,width:100,height:100},preview:"data:image/png;base64,AA==",widthMeters:100,heightMeters:80,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv",floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],objects:[{id:"display",kind:"stage",label:"Long display",x:.65,y:.4,width:10,depth:2,height:2,rotation:0,color:"#ffffff"}]};
const intent = PhotoIntentSchema.parse({title:"Display",description:"Show the display clearly",targetIds:["display"],view:"detail",azimuth:90,elevation:35,distanceScale:1});

function projections(shot: ReturnType<typeof generatePhotoCandidates>[number]) {
 const camera=new PerspectiveCamera(shot.fov,shot.aspect,.01,1000);
 camera.position.fromArray(shot.eye);camera.lookAt(...shot.target);camera.updateMatrixWorld(true);
 return [-5,5].flatMap(x=>[0,2].flatMap(y=>[-1,1].map(z=>new Vector3(15+x,y,-8+z).project(camera))));
}

describe("촬영 구도에 맞춘 대상 프레이밍",()=>{
 it("가로로 긴 대상은 구체 반경 대신 실제 화면 비율에 맞춰 여백을 줄이고 모든 모서리를 담는다",()=>{
  const shot=generatePhotoCandidates(room,intent)[0];
  const corners=projections(shot);
  expect(corners.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1)).toBe(true);
  const horizontalCoverage=(Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)))/2;
  expect(horizontalCoverage).toBeGreaterThan(.7);
 });
 it("대상이 지정되지 않은 기본 조감도는 거대한 빈 행사장보다 설치된 공간을 담는다",()=>{
  const shots=generatePhotoCandidates(room,{...intent,view:"overview",targetIds:[]});
  expect(shots[0].target[0]).toBeCloseTo(15);
  expect(shots[0].target[2]).toBeCloseTo(-8);
  expect(Math.hypot(...shots[0].eye.map((value,i)=>value-shots[0].target[i]))).toBeLessThan(20);
 });
 it("명시적인 행사장 전체 요청은 설치물 중심으로 바꾸지 않는다",()=>{
  const venueIntent=PhotoIntentSchema.parse({...intent,view:"overview",targetIds:[],framing:"venue"});
  const shot=generatePhotoCandidates(room,venueIntent)[0];
  expect(shot.target[0]).toBe(0);expect(shot.target[2]).toBe(0);
  expect(Math.hypot(...shot.eye.map((value,i)=>value-shot.target[i]))).toBeGreaterThan(60);
 });
 it("가림을 피할 선택지를 주기 위해 후보의 내려다보는 각도도 다르게 만든다",()=>{
  const shots=generatePhotoCandidates(room,intent);
  expect(shots).toHaveLength(4);
  const elevations=shots.map(shot=>Math.atan2(shot.eye[1]-shot.target[1],Math.hypot(shot.eye[0]-shot.target[0],shot.eye[2]-shot.target[2])));
  expect(new Set(elevations.map(angle=>angle.toFixed(3))).size).toBeGreaterThanOrEqual(3);
  expect(shots.every(shot=>projections(shot).every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1))).toBe(true);
 });
 it("지정한 구역은 주변 설치물 대신 그 구역 자체를 프레이밍한다",()=>{
  const withZone: PlanDocument={...room,zones:[{id:"lounge",label:"Lounge",purpose:"lounge",x:.2,y:.7,width:6,depth:4,rotation:0,assignable:false}]};
  const shot=generatePhotoCandidates(withZone,{...intent,view:"overview",targetIds:["lounge"]})[0];
  expect(shot.target[0]).toBeCloseTo(-30);expect(shot.target[2]).toBeCloseTo(16);
  expect(Math.hypot(...shot.eye.map((value,i)=>value-shot.target[i]))).toBeLessThan(15);
 });
 it("설치물이 없는 도면은 전체 공간으로 돌아가고 입력 도면을 변경하지 않는다",()=>{
  const empty={...room,objects:[]};const before=JSON.stringify(empty);
  const shot=generatePhotoCandidates(empty,{...intent,view:"overview",targetIds:[]})[0];
  expect(shot.target[0]).toBe(0);expect(shot.target[2]).toBe(0);
  expect(JSON.stringify(empty)).toBe(before);
 });
 it("회전된 대상도 가장 가까운 구도에서 화면 밖으로 잘리지 않는다",()=>{
  const rotated:PlanDocument={...room,objects:[{...room.objects![0],rotation:90}]};
  const shots=generatePhotoCandidates(rotated,{...intent,distanceScale:.75});
  expect(shots).toHaveLength(4);
  for(const shot of shots){
   const camera=new PerspectiveCamera(shot.fov,shot.aspect,.01,1000);
   camera.position.fromArray(shot.eye);camera.lookAt(...shot.target);camera.updateMatrixWorld(true);
   const corners=[-1,1].flatMap(x=>[0,2].flatMap(y=>[-5,5].map(z=>new Vector3(15+x,y,-8+z).project(camera))));
   expect(corners.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1)).toBe(true);
  }
 });

 it("이름으로 선택한 구역의 높은 소속 설치물과 구역 바닥을 함께 담는다",()=>{
  const venue:PlanDocument={...room,widthMeters:20,heightMeters:20,zones:[{id:"photo-zone",label:"Photo zone",purpose:"experience",x:.5,y:.5,width:4,depth:3,rotation:0,assignable:false}],objects:[{id:"backdrop",zoneId:"photo-zone",kind:"partition",label:"Backdrop",x:.5,y:.44,width:4,depth:.2,height:3,rotation:0,color:"#ffffff"}]};
  const shots=generatePhotoCandidates(venue,{...intent,targetIds:["photo-zone"]});
  expect(shots).toHaveLength(4);
  for(const shot of shots){
   const camera=new PerspectiveCamera(shot.fov,shot.aspect,.01,1000);
   camera.position.fromArray(shot.eye);camera.lookAt(...shot.target);camera.updateMatrixWorld(true);
   const backdrop=[-2,2].flatMap(x=>[0,3].flatMap(y=>[-1.3,-1.1].map(z=>new Vector3(x,y,z))));
   const floor=[-2,2].flatMap(x=>[-1.5,1.5].map(z=>new Vector3(x,0,z)));
   expect([...backdrop,...floor].map(p=>p.project(camera)).every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1)).toBe(true);
  }
 });
 it("회전된 구역 안의 미지정 설치물은 포함하고 바깥의 높은 설치물이나 구역 전체를 덮는 구조물은 제외한다",()=>{
  const base={kind:"partition" as const,label:"Display",width:.5,depth:.5,rotation:0 as const,color:"#ffffff"};
  const venue:PlanDocument={...room,widthMeters:20,heightMeters:20,zones:[{id:"photo-zone",label:"Photo zone",purpose:"experience",x:.5,y:.5,width:4,depth:3,rotation:90,assignable:false}],objects:[
   {...base,id:"inside",x:.5,y:.55,height:4},
   {...base,id:"outside",x:.6,y:.5,height:15},
   {...base,id:"surrounding",x:.5,y:.5,width:15,depth:15,elevation:10,height:1},
  ]};
  const shots=generatePhotoCandidates(venue,{...intent,targetIds:["photo-zone"]});
  expect(shots).toHaveLength(4);
  expect(shots[0].target).toEqual([0,2,0]);
  expect(Math.hypot(...shots[0].eye.map((value,i)=>value-shots[0].target[i]))).toBeLessThan(12);
  for(const shot of shots){
   const camera=new PerspectiveCamera(shot.fov,shot.aspect,.01,1000);
   camera.position.fromArray(shot.eye);camera.lookAt(...shot.target);camera.updateMatrixWorld(true);
   const corners=[-.25,.25].flatMap(x=>[0,4].flatMap(y=>[.75,1.25].map(z=>new Vector3(x,y,z).project(camera))));
   expect(corners.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1)).toBe(true);
  }
 });

});
