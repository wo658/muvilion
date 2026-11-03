import { describe, expect, it } from "vitest";
import { applyDesignPatch, designPreview, previewDocument, readDesignStream, type DesignPreview } from "@/lib/plans/design-stream";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { createDesignTools } from "@/server/agent/tools/design-tools";
import type { DesignToolContext } from "@/server/agent/tools/design-context";
const base = PlanDocumentSchema.parse({ schemaVersion: 1, source: { name: 'hall', format: 'pdf', page: 1, pages: 1, width: 100, height: 100 }, preview: 'data:image/png;base64,AA==', widthMeters: 20, heightMeters: 20, scaleConfirmed: true, lines: [], texts: [], warnings: [], method: 'pdf-vector', floorBoundary:[{x:.4,y:.425},{x:.6,y:.425},{x:.6,y:.575},{x:.4,y:.575}],zones:[{id:'stage-area',label:'Stage area',purpose:'stage',x:.5,y:.5,width:4,depth:3,rotation:0,assignable:false}] });
const object = {id:'stage',kind:'stage' as const,label:'무대',x:.5,y:.5,width:4,depth:3,height:1,rotation:0 as const,color:'#335577'};
const patch = {label:'무대 설치',objects:[object],zones:[],removeObjects:[],removeZones:[]};
function response(events: unknown[], tail = '') {
  const bytes = new TextEncoder().encode(events.map(x=>JSON.stringify(x)+'\n').join('')+tail);
  return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}));
}
describe('live design drafts',()=>{
  it('adds grouped furnishings beyond eighty up to the document limit without losing streamed geometry',async()=>{
    const objects=Array.from({length:80},(_,i)=>({...object,id:`installation-${i}`}));
    let draft={...base,objects};
    const saved=JSON.stringify(draft);
    for(let offset=80;offset<200;offset+=32){
      const group=Array.from({length:Math.min(32,200-offset)},(_,i)=>({...object,id:`installation-${offset+i}`}));
      draft=applyDesignPatch(draft,{...patch,objects:group}) as typeof draft;
    }
    expect(draft.objects).toHaveLength(200);
    expect(JSON.parse(saved).objects).toHaveLength(80);
    const delta=designPreview({...base,objects},draft,1,'Furnish the entire hall');
    const events:DesignPreview[]=[];
    await readDesignStream(response([delta,{type:'complete',result:{}}]),event=>events.push(event));
    expect(previewDocument({...base,objects},events[0]).objects).toEqual(draft.objects);
    expect(()=>applyDesignPatch(draft,{...patch,objects:[{...object,id:'over-limit'}]})).toThrow();
    expect(()=>applyDesignPatch(base,{...patch,objects:objects.slice(0,33)})).toThrow();
  });
  it('atomically adds, edits and removes without changing the saved base',()=>{
    const draft=applyDesignPatch(base,patch);
    expect(base.objects).toBeUndefined();
    const updated=applyDesignPatch(draft,{...patch,objects:[{...object,x:.7}]});
    expect(updated.objects?.[0].x).toBe(.7);
    expect(draft.objects?.[0].x).toBe(.5);
    expect(applyDesignPatch(updated,{...patch,objects:[],removeObjects:['stage']}).objects).toEqual([]);
    expect(()=>applyDesignPatch(draft,{...patch,removeObjects:['stage']})).toThrow('Conflicting');
    expect(()=>applyDesignPatch(draft,{...patch,objects:[{...object,zoneId:'missing'}]})).toThrow();
    expect(draft.objects?.[0].zoneId).toBeUndefined();
  });
  it('streams only validated groups and invalidates review after a correction',async()=>{
    const events: DesignPreview[]=[];
    const abort=new AbortController();
    const c:DesignToolContext={base,draft:base,revision:0,phase:'initial',sources:[],signal:abort.signal,env:{},artifacts:[],pendingImages:[],calls:new Map(),emitPreview:e=>events.push(e),brief:{scope:'interior',direction:'Stage',requirements:[{id:'stage',label:'Stage',target:'objects',kinds:['stage'],minimum:1}]}};
    const tools=createDesignTools(c), options={toolCallId:'test',messages:[],context:{}};
    await tools.edit_design.execute!(patch,options);
    await tools.review_design.execute!({summary:'Review',assumptions:[],coverage:[{requirementId:'stage',ids:['stage'],decision:'Present'}]},options);
    expect(c.review?.complete).toBe(true);
    await tools.edit_design.execute!({...patch,objects:[{...object,height:1.2}]},options);
    expect(c.review).toBeUndefined();
    expect(events.map(e=>e.revision)).toEqual([1,2,3]);
    expect(previewDocument(base,events[2]).objects?.[0].height).toBe(1.2);
    // A group whose only item adds a geometry problem saves nothing and emits nothing.
    const before=c.draft;
    await expect(tools.edit_design.execute!({...patch,objects:[{...object,x:.7}]},options)).rejects.toThrow('Group rejected');
    expect(c.draft).toBe(before);
    expect(events).toHaveLength(3);
    abort.abort();
    await expect(tools.edit_design.execute!(patch,options)).rejects.toThrow();
    expect(events).toHaveLength(3);
    expect(c.base).toBe(base);
  });
  it('saves the clean items of a group and holds back only the conflicting ones',async()=>{
    const events: DesignPreview[]=[];
    const c:DesignToolContext={base,draft:base,revision:0,phase:'initial',sources:[],signal:new AbortController().signal,env:{},artifacts:[],pendingImages:[],calls:new Map(),emitPreview:e=>events.push(e),brief:{scope:'interior',direction:'Stage',requirements:[{id:'stage',label:'Stage',target:'objects',kinds:['stage'],minimum:1}]}};
    const tools=createDesignTools(c), options={toolCallId:'test',messages:[],context:{}};
    const lectern={...object,id:'lectern',label:'Lectern',width:.6,depth:.5,x:.5,y:.47};
    const outside={...object,id:'outside',label:'Outside',width:.6,depth:.5,x:.9,y:.9};
    const result=await tools.edit_design.execute!({...patch,objects:[object,lectern,outside]},options) as {held:{id:string}[];next:string};
    // The stage is saved; the lectern overlaps it and the other item leaves the floor.
    expect(c.draft.objects?.map(o=>o.id)).toEqual(['stage']);
    expect(result.held.map(h=>h.id)).toEqual(['lectern','outside']);
    expect(result.next).toContain('overlaps Lectern');expect(result.next).toContain('Lectern (lectern) footprint');
    expect(events).toHaveLength(1);
    await tools.edit_design.execute!({...patch,label:'Lectern',objects:[{...lectern,height:.5,elevation:1}]},options);
    expect(c.draft.objects?.map(o=>o.id)).toEqual(['stage','lectern']);
  });
  it('transmits only changed elements and reconstructs grouped removal',()=>{
    const first=applyDesignPatch(base,patch);
    const second=applyDesignPatch(first,{...patch,objects:[{...object,id:'second',x:.8}]});
    const delta=designPreview(first,second,2,'Add second');
    expect(delta.objects.map(x=>x.id)).toEqual(['second']);
    const restored=previewDocument(first,delta);
    expect(restored.objects).toEqual(second.objects);
    const third=applyDesignPatch(second,{...patch,objects:[],removeObjects:['stage']});
    expect(previewDocument(restored,designPreview(second,third,3,'Remove first')).objects).toEqual(third.objects);
  });
  it('decodes split UTF-8 and exposes previews before terminal completion',async()=>{
    const event={type:'preview',revision:1,label:'무대',objects:[object],zones:[],warnings:[],removeObjects:[],removeZones:[]};
    const seen:DesignPreview[]=[];
    const result=await readDesignStream(response([event,{type:'complete',result:{document:base}}]),e=>seen.push(e));
    expect(seen[0].label).toBe('무대');expect(result.document).toEqual(base);
  });
  it('rejects truncated, failed, out-of-order and post-completion streams',async()=>{
    const e={type:'preview',revision:2,label:'x',objects:[],zones:[],warnings:[],removeObjects:[],removeZones:[]};
    await expect(readDesignStream(response([e]),()=>{})).rejects.toThrow('Out-of-order');
    await expect(readDesignStream(response([],'{"type":'),()=>{})).rejects.toThrow('before completion');
    await expect(readDesignStream(response([{type:'error',error:'failed'}]),()=>{})).rejects.toThrow('failed');
    await expect(readDesignStream(response([{type:'complete',result:{}},e]),()=>{})).rejects.toThrow('after completion');
  });
});
