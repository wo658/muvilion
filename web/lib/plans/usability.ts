import { translate, type Locale } from "@/lib/i18n/messages";
import type { DesignObject, PlanDocument } from "./schema";
import { footprintFitsBoundary, objectBounds, overlaps, segmentHitsRect } from "./design";
import { canTravel, type WalkWorld } from "./walk";
import { deriveWalls } from "./walls";

/** Explicit concept-planning assumptions, not code compliance or a crowd simulation. */
export const USE_CLEARANCE = { chairRear: .75, sofaFront: .35, rowLegroom: .45, aisle: 1.2, rowAccess: .9, tableGapMin: .1, tableGapMax: .35 } as const;
export const isSeat = (o: DesignObject) => o.fixtureType === "event-chair" || o.fixtureType === "lounge-sofa";
export function seatDirection(rotation: number) {
  const angle = rotation * Math.PI / 180;
  return { x: Math.round(Math.sin(angle)) || 0, y: -Math.round(Math.cos(angle)) || 0 };
}
type Rect = { x: number; y: number; width: number; height: number };
export type UseIssue = { code: string; objectId?: string; message: string };
export function reviewUsability(document: PlanDocument) {
  const issues: UseIssue[] = [], objects = document.objects ?? [], seats = objects.filter(isSeat);
  const add = (code: string, message: string, objectId?: string) => issues.push({code, message, objectId});
  for (const object of objects) {
    if (!isSeat(object) && (object.kind === "lounge" || object.appearance === "seat" || object.appearance === "sofa" || object.modelAssetId === "modern_arm_chair_01" || object.modelAssetId === "modular_street_seating"))
      add("unsupported_seating", `${object.label}: seating use geometry is not defined for this asset. Use an event-chair or lounge-sofa fixture for reviewed seating.`, object.id);
  }
  if (!seats.length) return { issues, checkedSeats: 0, connectedSeats: 0, assumptions: USE_CLEARANCE };
  const width = document.widthMeters, depth = document.heightMeters;
  if (!document.scaleConfirmed || !width || !depth) { add("scale", "Confirm metres before reviewing seating usability."); return {issues, checkedSeats:0, connectedSeats:0, assumptions:USE_CLEARANCE}; }
  const bounds = (o: Parameters<typeof objectBounds>[0]): Rect => { const b = objectBounds(o,document);return {x:b.x*width,y:b.y*depth,width:b.width*width,height:b.height*depth}; };
  const normalized = (r: Rect) => ({x:r.x/width,y:r.y/depth,width:r.width/width,height:r.height/depth});
  const world: WalkWorld = {width,depth,objects,walls:deriveWalls(document),boundary:document.floorBoundary?.map(p=>({x:p.x*width,y:p.y*depth})),ceilingHeight:document.ceiling?.height,wallHeight:document.wallHeight};
  const routes = (document.zones ?? []).filter(z=>z.purpose === "circulation").map(z=>({id:z.id,label:z.label,...bounds(z)}));
  const center = (r: Rect) => ({x:r.x+r.width/2,y:r.y+r.height/2});
  const blocked = (r: Rect, except: string[] = []) => objects.some(o=>!except.includes(o.id) && (o.elevation ?? 0)<1.8 && overlaps(r,bounds(o))) || world.walls.some(w=>segmentHitsRect(w.a,w.b,{x:r.x-w.thickness/2,y:r.y-w.thickness/2,width:r.width+w.thickness,height:r.height+w.thickness}));
  const fits = (r: Rect) => r.x>=-1e-6 && r.y>=-1e-6 && r.x+r.width<=width+1e-6 && r.y+r.height<=depth+1e-6 && (!document.floorBoundary || footprintFitsBoundary(normalized(r),document.floorBoundary));
  for (const r of routes) {
    if (Math.min(r.width,r.height)<USE_CLEARANCE.aisle-1e-6) add("aisle_width", `${r.label}: reserve at least 1.2 m clear circulation width.`,r.id);
    if (!fits(r)||blocked(r)) add("aisle_blocked",`${r.label}: the reserved circulation rectangle is blocked or outside the floor.`,r.id);
  }
  if (!routes.length) add("missing_route","Reserve connected circulation zones at least 1.2 m wide; blank floor alone is not a reviewed route.");
  // Join explicitly reserved rectangles only; a clear-looking isolated aisle is not a network.
  const reached = new Set<number>(routes.length ? [0] : []);
  const queue = routes.length ? [0] : [];
  for (let cursor=0;cursor<queue.length;cursor++) for(let j=0;j<routes.length;j++) {
    const i=queue[cursor];
    if(reached.has(j))continue;
    const a=routes[i],b=routes[j],x0=Math.max(a.x,b.x),x1=Math.min(a.x+a.width,b.x+b.width),y0=Math.max(a.y,b.y),y1=Math.min(a.y+a.height,b.y+b.height);
    if(x1<x0-1e-6||y1<y0-1e-6||Math.max(x1-x0,y1-y0)<USE_CLEARANCE.aisle-1e-6)continue;
    const joint={x:(x0+x1)/2,y:(y0+y1)/2};
    if(canTravel(center(a),joint,world,.6)&&canTravel(joint,center(b),world,.6)){reached.add(j);queue.push(j);}
  }
  if(reached.size<routes.length)add("disconnected_routes","Circulation zones must join into one unobstructed internal network.");
  let connectedSeats=0;
  for (const seat of seats) {
    const f=seatDirection(seat.rotation), side={x:-f.y,y:f.x}, c={x:seat.x*width,y:seat.y*depth}, target=objects.find(o=>o.id===seat.useTargetId), sofa=seat.fixtureType==="lounge-sofa";
    const issue=(code:string,text:string)=>add(code,`${seat.label}: ${text}`,seat.id);
    if(!target||target.id===seat.id){issue("seat_target","set useTargetId to the table or stage it serves; do not infer usability from its label.");continue;}
    const stage=target.kind==="stage";
    if(!stage && target.fixtureType!=="work-table" && target.fixtureType!=="meeting-table" && !(sofa&&target.modelAssetId==="modern_coffee_table_01")) {issue("seat_target","target must be a suitable work/meeting table, lounge coffee table, or audience stage.");continue;}
    const t=bounds(target),tc=center(t),delta={x:tc.x-c.x,y:tc.y-c.y},forward=delta.x*f.x+delta.y*f.y,lateral=Math.abs(delta.x*side.x+delta.y*side.y);
    const targetHalf=(Math.abs(f.x)*t.width+Math.abs(f.y)*t.height)/2, targetSide=(Math.abs(side.x)*t.width+Math.abs(side.y)*t.height)/2;
    const gap=forward-targetHalf-seat.depth/2;
    if(forward<=0||(!stage&&(sofa?lateral>Math.max(targetSide,seat.width/2):lateral+seat.width/2>targetSide+.05))|| (stage&&lateral>targetSide+forward*.5))issue("seat_facing","face the served table/stage (fixture front: 0° north, 90° east, 180° south, 270° west). Align the full seat width with the table edge.");
    if(!stage && (gap<(sofa?.35:.1)-.005||gap>(sofa?.6:.35)+.005))issue("seat_reach",`front-to-table gap ${gap.toFixed(2)} m; use ${sofa?"0.35–0.60":"0.10–0.35"} m so the surface is reachable and legs fit.`);
    if(!stage&&!sofa&&(target.height<.68||target.height>.82))issue("table_height","use a seated worktop 0.68–0.82 m high.");
    if((seat.elevation??0)!==0)issue("seat_elevation","raised seating requires a separate access review; this checker supports floor-level seats.");
    const strip=(front:boolean,length:number):Rect=>{
      const d=seat.depth/2+length/2,sign=front?1:-1,w=seat.width+.1;
      const sx=c.x+f.x*d*sign,sy=c.y+f.y*d*sign,rw=Math.abs(side.x)*w+Math.abs(f.x)*length,rh=Math.abs(side.y)*w+Math.abs(f.y)*length;
      return {x:sx-rw/2,y:sy-rh/2,width:rw,height:rh};
    };
    const use=strip(sofa,sofa?USE_CLEARANCE.sofaFront:USE_CLEARANCE.chairRear);
    if(!fits(use)||blocked(use,[seat.id]))issue("seat_clearance",`reserve ${sofa?"0.35 m in front":"0.75 m behind"} for sitting/standing and chair movement.`);
    if(routes.some(r=>overlaps(use,r)||(stage&&overlaps(strip(true,USE_CLEARANCE.rowLegroom),r))))issue("seat_aisle","chair movement/sofa use space overlaps a main circulation zone; move the seat or aisle.");
    if(stage && (!fits(strip(true,USE_CLEARANCE.rowLegroom))||blocked(strip(true,USE_CLEARANCE.rowLegroom),[seat.id])))issue("row_legroom","reserve 0.45 m clear in front of the audience chair.");
    const accessDistance=seat.depth/2+(stage?.5:sofa?.65:.65),sign=sofa?1:-1;
    const start={x:c.x+f.x*accessDistance*sign,y:c.y+f.y*accessDistance*sign};
    const starts=sofa?[-1,1].map(direction=>({x:c.x+f.x*(seat.depth/2+.2)+side.x*(seat.width/2+.65)*direction,y:c.y+f.y*(seat.depth/2+.2)+side.y*(seat.width/2+.65)*direction})):[start];
    const radius=stage?.45:.6;
    const connected=routes.some((r,i)=>{
      if(!reached.has(i)||Math.min(r.width,r.height)<1.2)return false;
      return starts.some(start=>{
        const end={x:Math.max(r.x+.6,Math.min(r.x+r.width-.6,start.x)),y:Math.max(r.y+.6,Math.min(r.y+r.height-.6,start.y))};
        return canTravel(start,end,world,radius);
      });
    });
    if(connected)connectedSeats++;else issue("seat_access",`no clear ${stage?"0.9":"1.2"} m approach from the ${sofa?"front-side":"rear"} to connected circulation; add an aisle/branch or reposition the seating group.`);
  }
  return {issues,checkedSeats:seats.length,connectedSeats,assumptions:USE_CLEARANCE};
}

const USE_MESSAGES = {
  "unsupported_seating": "This seat has no reviewed use envelope. Use a supported seating fixture.",
  "seat_target": "Seat target needs review.",
  "seat_facing": "Seat must face its table or stage.",
  "seat_reach": "Seat-to-table distance needs adjustment.",
  "table_height": "Seated worktop height needs review.",
  "seat_elevation": "Raised seating access needs separate review.",
  "seat_clearance": "Clear space for sitting and chair movement is insufficient.",
  "seat_aisle": "Seat use space overlaps a main aisle.",
  "row_legroom": "Audience legroom is insufficient.",
  "seat_access": "Seat approach is not connected to the circulation network.",
  "missing_route": "Reserve connected circulation zones at least 1.2 m wide.",
  "aisle_width": "Circulation width is below the 1.2 m planning allowance.",
  "aisle_blocked": "Reserved circulation is obstructed or outside the floor.",
  "disconnected_routes": "Circulation zones are disconnected.",
  "scale": "Confirm scale before reviewing seating."
} as const;
export function usabilityWarnings(document: PlanDocument, locale: Locale = "en"): string[] {
  return reviewUsability(document).issues.map(issue => {
    const label = [...(document.objects ?? []), ...(document.zones ?? [])].find(item => item.id === issue.objectId)?.label;
    const message = translate(locale, USE_MESSAGES[issue.code as keyof typeof USE_MESSAGES]);
    return label ? `${label}: ${message}` : message;
  });
}
