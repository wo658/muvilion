export type FloorPoint = {x:number;y:number};
const cross=(a:FloorPoint,b:FloorPoint,c:FloorPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function isSimpleFootprint(points:FloorPoint[]):boolean {
  if(points.length<3)return false;
  let area=0;
  const on=(a:FloorPoint,b:FloorPoint,p:FloorPoint)=>Math.abs(cross(a,b,p))<1e-10 && p.x>=Math.min(a.x,b.x)-1e-10 && p.x<=Math.max(a.x,b.x)+1e-10 && p.y>=Math.min(a.y,b.y)-1e-10 && p.y<=Math.max(a.y,b.y)+1e-10;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(Math.hypot(a.x-b.x,a.y-b.y)<1e-6)return false;
    area+=a.x*b.y-b.x*a.y;
    for(let j=i+1;j<points.length;j++){
      if(j===i+1 || (i===0&&j===points.length-1))continue;
      const c=points[j],d=points[(j+1)%points.length];
      if((cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return false;
    }
  }
  return Math.abs(area)>1e-6;
}
