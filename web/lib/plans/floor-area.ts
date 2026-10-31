type Point = {x:number;y:number};
type Rect = {x:number;y:number;width:number;height:number};
const EPS = 1e-9;
export const polygonArea = (polygon:Point[]) => Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
/** Axis-aligned clipping preserves signed area even when a concave polygon splits. */
export function clipFloorPolygon(polygon:Point[],rect:Rect) {
 let points=polygon;
 for(const [axis,bound,keepAbove] of [['x',rect.x,true],['x',rect.x+rect.width,false],['y',rect.y,true],['y',rect.y+rect.height,false]] as const){
  const clipped:Point[]=[];
  for(let i=0;i<points.length;i++){
   const p=points[i],q=points[(i+1)%points.length],inside=(v:Point)=>keepAbove?v[axis]>=bound:v[axis]<=bound;
   const pin=inside(p),qin=inside(q);
   if(pin)clipped.push(p);
   if(pin!==qin){const t=(bound-p[axis])/(q[axis]-p[axis]);clipped.push({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)});}
  }
  points=clipped;if(!points.length)return [];
 }
 return points;
}
export function clippedFloorArea(polygon:Point[],rect:Rect) { return polygonArea(clipFloorPolygon(polygon,rect)); }
/** Exact rectangle union area inside the reviewed floor; overlap never inflates coverage.
 * Sweep uses at most 2N x strips and N merged intervals per strip (N <= 200).
 */
export function allocatedFloorArea(polygon:Point[],rects:Rect[]) {
 const xs=[...new Set(rects.flatMap(r=>[r.x,r.x+r.width]))].sort((a,b)=>a-b);let result=0;
 for(let i=0;i<xs.length-1;i++){
  const x=xs[i],end=xs[i+1],mid=(x+end)/2;
  const spans=rects.filter(r=>r.x<=mid&&r.x+r.width>=mid).map(r=>[r.y,r.y+r.height]).sort((a,b)=>a[0]-b[0]);
  let lo:number|undefined,hi=0;
  for(const [a,b] of spans){if(lo===undefined){lo=a;hi=b;}else if(a<=hi+EPS)hi=Math.max(hi,b);else{result+=clippedFloorArea(polygon,{x,y:lo,width:end-x,height:hi-lo});lo=a;hi=b;}}
  if(lo!==undefined)result+=clippedFloorArea(polygon,{x,y:lo,width:end-x,height:hi-lo});
 }
 return result;
}
