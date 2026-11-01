import { objectBounds } from './design';
import type { PlanDocument } from './schema';
import type { DesignBrief } from './design-review';

import { polygonArea, clipFloorPolygon, clippedFloorArea, allocatedFloorArea } from './floor-area';
export type FloorCoverageIssue = {code:'floor_boundary_required'|'unallocated_floor'|'unfurnished_zone'|'sparse_zone';message:string;zoneId?:string};
const EPS=1e-9;
export function requiresWholeFloor(document:PlanDocument,brief:string) {
 if(!(document.objects?.length||document.zones?.length))return true;
 return /(?:whole|entire|all)\s*(?:drawing|floor|hall|venue|space)|(?:도면|공간|홀|행사장|바닥)(?:\s*(?:내의?|안의?|내부의?))?\s*(?:전체|모든)|(?:전체|모든)\s*(?:도면|영역|공간|홀|행사장|바닥)/i.test(brief);
}
/** Whole-space design means a furnished interior unless the user asks only for zoning.
 * This server hint prevents the model from relaxing a physical design into coloured areas.
 * It does not expand a targeted edit into a whole-floor redesign.
 */
export function requiresWholeFloorInterior(document:PlanDocument,brief:string) {
 if(!requiresWholeFloor(document,brief))return false;
 const furnishing=/(?:decorat|furnish|interior|installations?|꾸[미며민밀]|인테리어|가구|설치물|장식)/i.test(brief);
 const zoning=/(?:\bzoning\b|\bzone\s+(?:the|this|entire|whole|all)\b|\bzones?[- ]only\b|\bonly\s+zones?\b|\ballocate\s+(?:(?:the|activity|functional)\s+)*zones?\b|조닝|구역(?:만|\s*(?:배치|구분|나누|설정))|존\s*(?:배치|구분))/i.test(brief);
 return furnishing||!zoning;
}
export function reviewFloorCoverage(document:PlanDocument,scope:DesignBrief['scope']) {
 const issues:FloorCoverageIssue[]=[];
 const sparseZones:{zoneId:string;label:string;zoneArea:number;installationSpan:{width:number;depth:number};zoneSpan:{width:number;depth:number}}[]=[];
 const polygon=document.floorBoundary;
 if(!polygon?.length||!document.scaleConfirmed||!document.widthMeters||!document.heightMeters){
  issues.push({code:'floor_boundary_required',message:'Review the interior floor outline and confirm scale in Drawing settings before designing the whole floor. Image margins are not event space.'});
  return {complete:false,floorArea:0,allocatedArea:0,unallocatedArea:0,issues,sparseZones};
 }
 const scale=document.widthMeters*document.heightMeters, floorArea=polygonArea(polygon)*scale;
 const zones=document.zones??[], rects=zones.map(z=>objectBounds(z,document));
 const allocated=Math.min(floorArea,allocatedFloorArea(polygon,rects)*scale),unallocated=Math.max(0,floorArea-allocated);
 // Numerical tolerance only, not a percentage of the room that may remain unplanned.
 if(unallocated>Math.max(1e-6,floorArea*1e-9))issues.push({code:'unallocated_floor',message:`${unallocated.toFixed(2)} m² of ${floorArea.toFixed(2)} m² is unallocated. Assign the entire reviewed floor to purposeful activity, operations, or connected circulation zones; do not shrink the event footprint.`});
 if(scope==='interior')for(let i=0;i<zones.length;i++){
  const zone=zones[i],bounds=rects[i],zoneArea=clippedFloorArea(polygon,bounds)*scale;
  if(zone.purpose==='circulation'||zoneArea<=EPS)continue;
  const content=(document.objects??[]).filter(o=>(o.elevation??0)<1.8&&!['light','hanging-sign','canopy','beam'].includes(o.kind)).map(o=>objectBounds(o,document)).filter(r=>r.x>=bounds.x-EPS&&r.y>=bounds.y-EPS&&r.x+r.width<=bounds.x+bounds.width+EPS&&r.y+r.height<=bounds.y+bounds.height+EPS);
  if(!content.length){issues.push({code:'unfurnished_zone',zoneId:zone.id,message:`${zone.label} has no floor-level installations. Furnish this functional zone; a coloured reservation is not a completed interior.`});continue;}
  const span={width:(Math.max(...content.map(r=>r.x+r.width))-Math.min(...content.map(r=>r.x)))*document.widthMeters,depth:(Math.max(...content.map(r=>r.y+r.height))-Math.min(...content.map(r=>r.y)))*document.heightMeters};
  const clipped=clipFloorPolygon(polygon,bounds);
  const zoneSpan={width:(Math.max(...clipped.map(p=>p.x))-Math.min(...clipped.map(p=>p.x)))*document.widthMeters,depth:(Math.max(...clipped.map(p=>p.y))-Math.min(...clipped.map(p=>p.y)))*document.heightMeters};
  // Product completeness rule for whole-floor interiors, not an occupancy/safety
  // standard or an aesthetic score. Use smaller meaningful zones and real furnishings.
  if(span.width+EPS<zoneSpan.width/2||span.depth+EPS<zoneSpan.depth/2){
   sparseZones.push({zoneId:zone.id,label:zone.label,zoneArea,installationSpan:span,zoneSpan});
   issues.push({code:'sparse_zone',zoneId:zone.id,message:`${zone.label}: installation spread ${span.width.toFixed(2)}×${span.depth.toFixed(2)} m does not span half of its usable ${zoneSpan.width.toFixed(2)}×${zoneSpan.depth.toFixed(2)} m zone in both directions. Distribute real installations throughout the program or divide into meaningful furnished activities and clear circulation. A giant reservation around clustered objects is incomplete.`});
  }
 }
 return {complete:issues.length===0,floorArea,allocatedArea:allocated,unallocatedArea:unallocated,issues,sparseZones};
}
