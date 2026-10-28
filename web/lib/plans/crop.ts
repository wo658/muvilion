import type { PlanDocument, PlanLine } from "./schema";
type Point = { x: number; y: number };
export type CropRegion = { x: number; y: number; width: number; height: number };

export function cropEvidence(document: PlanDocument, region: CropRegion): Omit<PlanDocument, "preview"> {
  const {x,y,width,height} = region;
  if (![x,y,width,height].every(Number.isFinite) || width < 0.01 || height < 0.01 || x < 0 || y < 0 || x+width > 1.000001 || y+height > 1.000001) throw new Error("Select a larger region inside the drawing.");
  const remap = (point:Point) => ({x:Math.max(0,Math.min(1,(point.x-x)/width)),y:Math.max(0,Math.min(1,(point.y-y)/height))});
  const lines: PlanLine[] = [];
  for (const line of document.lines) {
    const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y;
    let start=0,end=1,keep=true;
    for (const [p,q] of [[-dx,line.a.x-x],[dx,x+width-line.a.x],[-dy,line.a.y-y],[dy,y+height-line.a.y]]) {
      if(p===0){if(q<0){keep=false;break;}}
      else {const t=q/p;if(p<0)start=Math.max(start,t);else end=Math.min(end,t);if(start>end){keep=false;break;}}
    }
    if (keep && start < end) lines.push({...line,a:remap({x:line.a.x+start*dx,y:line.a.y+start*dy}),b:remap({x:line.a.x+end*dx,y:line.a.y+end*dy})});
  }
  const old=document.source.crop??{x:0,y:0,width:1,height:1};
  return {
    ...document,
    source:{...document.source,width:Math.max(1,Math.round(document.source.width*width)),height:Math.max(1,Math.round(document.source.height*height)),crop:{x:old.x+x*old.width,y:old.y+y*old.height,width:old.width*width,height:old.height*height}},
    lines, texts:document.texts.filter(t=>t.x>=x&&t.x<=x+width&&t.y>=y&&t.y<=y+height).map(t=>({...t,...remap(t)})),
    widthMeters:document.widthMeters ? document.widthMeters*width:null,heightMeters:document.heightMeters ? document.heightMeters*height:null,
    scaleConfirmed:false,objects:[],warnings:[...document.warnings,"Source cropped to the selected space. Reconfirm its scale; previous concept objects were cleared."].slice(-100),
  };
}

export async function cropPlan(document:PlanDocument,a:Point,b:Point):Promise<PlanDocument>{
  // Align to actual pixels, ensuring geometry uses exactly the same crop as the preview.
  const x=Math.floor(Math.min(a.x,b.x)*document.source.width),y=Math.floor(Math.min(a.y,b.y)*document.source.height);
  const width=Math.ceil(Math.max(a.x,b.x)*document.source.width)-x,height=Math.ceil(Math.max(a.y,b.y)*document.source.height)-y;
  const evidence=cropEvidence(document,{x:x/document.source.width,y:y/document.source.height,width:width/document.source.width,height:height/document.source.height});
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Could not crop the source preview."));image.src=document.preview;});
  const canvas=window.document.createElement("canvas");canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d");if(!context)throw new Error("Your browser cannot crop this preview.");
  context.drawImage(image,x,y,width,height,0,0,width,height);
  return {...evidence,preview:canvas.toDataURL("image/png")};
}
