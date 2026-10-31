import {describe,it,expect} from "vitest";
import {PlanDocumentSchema,DesignObjectSchema} from "@/lib/plans/schema";
import {getModelAsset} from '@/lib/assets/catalog';
import {FIXTURES} from "@/lib/assets/fixtures";
import {reviewUsability,seatDirection} from "@/lib/plans/usability";
import {designWarnings,objectBounds} from "@/lib/plans/design";
import {canTravel} from "@/lib/plans/walk";
const base=PlanDocumentSchema.parse({schemaVersion:1,source:{name:'hall',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:20,heightMeters:20,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'opencv'});
const table=DesignObjectSchema.parse({id:'table',label:'Table',fixtureType:'meeting-table',...FIXTURES['meeting-table'],x:.5,y:.5,rotation:0,color:'#445566'});
const chair=DesignObjectSchema.parse({id:'chair',label:'Chair',fixtureType:'event-chair',...FIXTURES['event-chair'],x:.5,y:10.825/20,rotation:0,color:'#445566',useTargetId:'table'});
const aisle={id:'aisle',label:'Aisle',purpose:'circulation' as const,x:7/20,y:.5,width:1.5,depth:8,rotation:0 as const,assignable:false};
const doc={...base,objects:[table,chair],zones:[aisle]};
describe('seating use envelopes and connected approaches',()=>{
 it('accepts opposing table seats with rear movement and a clear route',()=>{
  const d={...doc,objects:[table,chair,{...chair,id:'opposite',y:9.175/20,rotation:180 as const}]};
  expect(designWarnings(d)).toEqual([]);expect(reviewUsability(d).issues).toEqual([]);expect(reviewUsability(d).connectedSeats).toBe(2);
 });
 it('rejects collision-free seats facing away, unreachable tables and missing targets',()=>{
  expect(designWarnings({...doc,objects:[table,{...chair,rotation:180}]})).toEqual([]);
  expect(reviewUsability({...doc,objects:[table,{...chair,rotation:180}]}).issues.some(i=>i.code==='seat_facing')).toBe(true);
  expect(reviewUsability({...doc,objects:[table,{...chair,y:.6}]}).issues.some(i=>i.code==='seat_reach')).toBe(true);
  expect(reviewUsability({...doc,objects:[table,{...chair,useTargetId:undefined}]}).issues[0].code).toBe('seat_target');
 });
 it('rejects a wall behind a chair without physical overlap',()=>{
  const wall={id:'wall',kind:'wall' as const,a:{x:.4,y:11.3/20},b:{x:.6,y:11.3/20}};
  const d={...doc,lines:[{...wall,origin:'manual' as const,confidence:1}]};
  expect(designWarnings(d)).toEqual([]);expect(reviewUsability(d).issues.map(i=>i.code)).toContain('seat_clearance');
 });
 it('does not accept disconnected or narrow aisle reservations',()=>{
  expect(reviewUsability({...doc,zones:[]}).issues.map(i=>i.code)).toContain('missing_route');
  expect(reviewUsability({...doc,zones:[{...aisle,width:.8}]}).issues.map(i=>i.code)).toContain('aisle_width');
  expect(reviewUsability({...doc,zones:[aisle,{...aisle,id:'isolated',x:.9}]}).issues.map(i=>i.code)).toContain('disconnected_routes');
 });
 it('rejects a nominal aisle behind an inaccessible enclosure',()=>{
  const d={...doc,lines:[{id:'wall',kind:'wall' as const,a:{x:.4,y:0},b:{x:.4,y:1},origin:'manual' as const,confidence:1}]};
  expect(reviewUsability(d).issues.map(i=>i.code)).toContain('seat_access');
 });
 it('allows wider sofas around a coffee table with side approaches',()=>{
  const a=getModelAsset('modern_coffee_table_01')!;
  const coffee={...table,fixtureType:undefined,modelAssetId:a.id,width:a.width,depth:a.depth,height:a.height};
  const sofa=DesignObjectSchema.parse({...chair,...FIXTURES['lounge-sofa'],fixtureType:'lounge-sofa',y:(10+a.depth/2+.4+.4)/20});
  expect(reviewUsability({...doc,objects:[coffee,sofa]}).issues).toEqual([]);
 });
 it('supports all four facing directions with unchanged local dimensions',()=>{
  expect([0,90,180,270].map(seatDirection)).toEqual([{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}]);
  for(const rotation of [180,270] as const)expect(DesignObjectSchema.safeParse({...chair,rotation}).success).toBe(true);
  expect(objectBounds({...chair,rotation:270},base)).toEqual(objectBounds({...chair,rotation:90},base));
 });
 it('does not silently pass legacy seat models with no use profile',()=>{
  expect(reviewUsability({...doc,objects:[{...chair,fixtureType:undefined,modelAssetId:'modern_arm_chair_01'}]}).issues.map(i=>i.code)).toContain('unsupported_seating');
 });
 it('does not join routes through a zero-width corner contact',()=>{
  const corner={...aisle,id:'corner',x:(7+.75+.75)/20,y:(10+4+4)/20};
  expect(reviewUsability({...doc,zones:[aisle,corner]}).issues.map(i=>i.code)).toContain('disconnected_routes');
 });
 it('preserves usable groups under every quarter turn',()=>{
  for(const turn of [0,90,180,270] as const){
   const radians=turn*Math.PI/180;
   const rotate=(x:number,y:number)=>({x:.5+(x-.5)*Math.cos(radians)-(y-.5)*Math.sin(radians),y:.5+(x-.5)*Math.sin(radians)+(y-.5)*Math.cos(radians)});
   const objects=doc.objects.map(o=>({...o,...rotate(o.x,o.y),rotation:((o.rotation+turn)%360) as 0|90|180|270}));
   const zones=[{...aisle,...rotate(aisle.x,aisle.y),rotation:(turn%180) as 0|90}];
   expect(reviewUsability({...doc,objects,zones}).issues).toEqual([]);
  }
 });
 it('rejects collision-free audience rows with insufficient legroom',()=>{
  const stage={...table,id:'stage',fixtureType:undefined,kind:'stage' as const,width:5,depth:2,height:.45,x:.5,y:.75};
  const a={...chair,useTargetId:'stage',rotation:180 as const,y:.5},b={...a,id:'row2',y:.54};
  const d={...doc,objects:[stage,a,b]};
  expect(designWarnings(d)).toEqual([]);
  expect(reviewUsability(d).issues.map(i=>i.code)).toContain('row_legroom');
 });
 it('keeps the existing walking radius and permits explicit wider route checks',()=>{
  const world={width:20,depth:20,objects:[table],walls:[]};
  expect(canTravel({x:8,y:10.8},{x:12,y:10.8},world)).toBe(true);
  expect(canTravel({x:8,y:10.8},{x:12,y:10.8},world,.6)).toBe(false);
 });
});
