import { cropPlan, type CropRegion } from "./crop";
import type { PlanDocument } from "./schema";

export type RegionBatch = { id: string; region: CropRegion; lineIds: string[] };

/** Keep every source line. Route structural-size unknown candidates by spatial ownership,
 * not PDF object order. Tiny symbols remain explicitly deferred, never deleted. */
export function planRegions(document: PlanDocument, minPixels = 12) {
  if (!Number.isFinite(minPixels) || minPixels < 2 || minPixels > 24) throw new Error("Candidate length must be 2–24 preview pixels.");
  const unknown = document.lines.filter(line => line.kind === "unknown");
  const candidates = unknown.filter(line => Math.hypot((line.b.x-line.a.x)*document.source.width, (line.b.y-line.a.y)*document.source.height) >= minPixels);
  const buckets = Array.from({length:16}, () => [] as string[]);
  for (const line of candidates) {
    const col = Math.min(3, Math.floor((line.a.x+line.b.x)/2*4));
    const row = Math.min(3, Math.floor((line.a.y+line.b.y)/2*4));
    buckets[row*4+col].push(line.id);
  }
  const batches: RegionBatch[] = [];
  buckets.forEach((ids,index) => {
    const col=index%4,row=Math.floor(index/4),x=Math.max(0,col/4-.035),y=Math.max(0,row/4-.035);
    const region={x,y,width:Math.min(1,(col+1)/4+.035)-x,height:Math.min(1,(row+1)/4+.035)-y};
    for(let offset=0;offset<ids.length;offset+=250) batches.push({id:`r${row+1}c${col+1}-${offset/250+1}`,region,lineIds:ids.slice(offset,offset+250)});
  });
  return {batches,candidateCount:candidates.length,deferredCount:unknown.length-candidates.length};
}

export async function regionDocument(document:PlanDocument,batch:RegionBatch):Promise<PlanDocument> {
  const ids=new Set(batch.lineIds);
  const region=batch.region;
  const cropped=await cropPlan({...document,lines:document.lines.filter(line=>ids.has(line.id)),objects:[],warnings:[]},
    {x:region.x,y:region.y},{x:region.x+region.width,y:region.y+region.height});
  return {...cropped, warnings:[`Region ${batch.id}. Geometry is clipped to this image; use visible local evidence. Whole-plan scale remains separately confirmed by the user.`]};
}

export type RegionStats={completed:number;total:number;failed:number;candidates:number;deferred:number};
export function combineRegionalResults(base:PlanDocument,results:PlanDocument[],stats:RegionStats):PlanDocument {
  const allowed=new Map(base.lines.filter(line=>line.kind==="unknown").map(line=>[line.id,line]));
  const decisions=new Map<string,PlanDocument["lines"][number]>();
  for(const result of results) for(const line of result.lines) {
    if(!allowed.has(line.id)) throw new Error("Regional result contains an unrequested or already classified line.");
    if(decisions.has(line.id)) throw new Error("Regional line ownership must be unique.");
    decisions.set(line.id,line);
  }
  return {...base,lines:base.lines.map(line=>{
    const decision=decisions.get(line.id);
    return decision && decision.confidence>=.7 ? {...line,kind:decision.kind,confidence:decision.confidence} : line;
  }), warnings:[...base.warnings.filter(w=>!w.startsWith("Regional Muse:")),
    ...[...new Set(results.flatMap(result=>result.warnings).filter(w=>!w.startsWith("Region ")&&!w.includes("Source cropped")&&!w.startsWith("Muse classifications")))].slice(0,24),
    `Regional Muse: ${stats.completed}/${stats.total} batches completed; ${stats.failed} failed; ${decisions.size}/${stats.candidates} candidate lines reviewed. ${stats.deferred} short lines retained but deferred. Review wall candidates against the source; coverage is not accuracy.`].slice(-100)};
}
