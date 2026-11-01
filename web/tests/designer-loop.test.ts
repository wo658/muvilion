import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
const handle = vi.hoisted(() => ({ model: undefined as unknown, savedKey: undefined as string | undefined }));
vi.mock('@/server/agent/model', () => ({getModel:()=>({hasKey:true,model:handle.model})}));
vi.mock("@/server/settings/store", () => ({ storedMetaKey: () => handle.savedKey }));
import { designPlan, DesignRequest } from '@/server/plans/design';

const brief = { scope: 'zoning', direction: 'Open gallery', requirements: [{id:'open',label:'Keep an open gallery',target:'objects',kinds:[],minimum:0}] };
const coverage = [{requirementId:'open',ids:[],decision:'Intentionally empty gallery.'}];
const proposal = { zones:[{id:'program',label:'Open gallery',purpose:'exhibition',x:.5,y:.5,width:20,depth:20,rotation:0,assignable:false}], summary:'An open central focal point and balanced perimeter.', objects:[], assumptions:[] };
const usage = { inputTokens: {total:10,noCache:10,cacheRead:undefined,cacheWrite:undefined}, outputTokens:{total:5,text:5,reasoning:undefined} };
function call(name:string, input:unknown) {
  if(name === 'review_design') input = {...input as object, coverage};
  return {content:[{type:'tool-call' as const,toolCallId:crypto.randomUUID(),toolName:name,input:JSON.stringify(input)}],finishReason:{unified:'tool-calls' as const,raw:undefined},usage,warnings:[]};
}
function prose(reason:'stop'|'length'|'content-filter'='stop') {
  return {content:[{type:'text' as const,text:'The reviewed layout is ready.'}],finishReason:{unified:reason,raw:undefined},usage,warnings:[]};
}
function input() {return DesignRequest.parse({brief:'Design only the zoning of an open gallery',sources:[],document:{schemaVersion:1,source:{name:'hall',format:'pdf',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:20,heightMeters:20,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'pdf-vector',floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]}});}
beforeEach(()=>{handle.savedKey=undefined;vi.stubEnv('MUSE_IMAGE_ENABLED','false');});

describe('Designer Muse SDK loop',()=>{
  it.each(['stop','length'] as const)('recovers one missing submission after a successful visual review (%s)',async reason=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),prose(reason),call('submit_design',{revision:1,summary:'Reviewed submission'})]});handle.model=model;
    const request=input(),original=JSON.stringify(request.document);
    const result=await designPlan(request,new AbortController().signal);
    expect(result.summary).toBe('Reviewed submission');expect(result.document.zones).toEqual(proposal.zones);
    expect(JSON.stringify(request.document)).toBe(original);
    expect(model.doGenerateCalls).toHaveLength(4);
    const seen=model.doGenerateCalls[2],recovery=model.doGenerateCalls[3];
    const images=(prompt:typeof seen.prompt)=>prompt.filter(m=>m.role==='user').flatMap(m=>m.content).filter(p=>p.type==='file');
    expect(images(recovery.prompt)).toEqual(images(seen.prompt));expect(images(recovery.prompt)).toHaveLength(2);
    expect(JSON.stringify(recovery.prompt)).toContain(request.brief);
    expect(JSON.stringify(recovery.prompt)).toContain('The reviewed layout is ready.');
    expect(recovery.tools?.map(t=>t.name)).toEqual(['submit_design']);expect(recovery.toolChoice?.type).toBe('auto');
  });
  it('does not keep retrying when the single submission recovery returns prose again',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),prose(),prose()]});handle.model=model;
    await expect(designPlan(input(),new AbortController().signal)).rejects.toMatchObject({status:502});
    expect(model.doGenerateCalls).toHaveLength(4);
  });
  it('rejects a stale revision produced by the submission recovery',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),call('review_design',proposal),prose(),call('submit_design',{revision:1,summary:'Stale'})]});handle.model=model;
    await expect(designPlan(input(),new AbortController().signal)).rejects.toThrow('not been visually reviewed');
    expect(model.doGenerateCalls).toHaveLength(5);
  });
  it('does not request submission of an unreviewed draft',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),prose()]});handle.model=model;
    await expect(designPlan(input(),new AbortController().signal)).rejects.toMatchObject({status:502});
    expect(model.doGenerateCalls).toHaveLength(2);
  });
  it('does not begin a submission recovery when the caller cancels after review',async()=>{
    const controller=new AbortController();let step=0;
    const model=new MockLanguageModelV4({doGenerate:async()=>{
      if(step++===0)return call('set_design_brief',brief);
      if(step===2)return call('review_design',proposal);
      controller.abort();return prose();
    }});handle.model=model;
    await expect(designPlan(input(),controller.signal)).rejects.toMatchObject({status:499});
    expect(model.doGenerateCalls).toHaveLength(3);
  });
  it('does not retry a filtered response even after a valid review',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),prose('content-filter')]});handle.model=model;
    await expect(designPlan(input(),new AbortController().signal)).rejects.toMatchObject({status:502});
    expect(model.doGenerateCalls).toHaveLength(3);
  });
  it('does not request submission after failed floor coverage preflight',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',{...proposal,zones:[]}),prose()]});handle.model=model;
    await expect(designPlan(input(),new AbortController().signal)).rejects.toMatchObject({status:502});
    expect(model.doGenerateCalls).toHaveLength(3);
  });
  it('rejects a zoning-only answer to a request to decorate the entire floor',async()=>{
    const request=input();request.brief='Decorate the entire hall with a complete event interior';
    handle.model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),call('submit_design',{revision:1,summary:proposal.summary})]});
    await expect(designPlan(request,new AbortController().signal)).rejects.toMatchObject({status:502});
  });
  it('rejects an initial whole-floor request without an outline before invoking the model',async()=>{
    const request=input();request.document.floorBoundary=undefined;
    const model=new MockLanguageModelV4({doGenerate:async()=>{throw new Error('must not call');}});handle.model=model;
    await expect(designPlan(request,new AbortController().signal)).rejects.toMatchObject({status:400});
    expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('streams the agent-selected operation before each grouped preview without changing the base',async()=>{
    const patch={operation:'paint',label:'Finish study',objects:[],zones:[],removeObjects:[],removeZones:[]};
    handle.model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('edit_design',patch),call('review_design',proposal),call('submit_design',{revision:2,summary:proposal.summary})]});
    const events: string[]=[], request=input(), original=JSON.stringify(request.document);
    const operations: import('@/lib/muvi/operations').MuviOperation[]=[];
    const result=await designPlan(request,new AbortController().signal,e=>events.push(`preview:${e.revision}`),e=>{operations.push(e);events.push(e.operation);});
    expect(events).toEqual(['inspect','paint','preview:1','measure','preview:2']);
    expect(operations.map(e=>e.sequence)).toEqual([1,2,3]);
    expect(operations.every(e=>e.runId===result.runId)).toBe(true);
    expect(JSON.stringify(request.document)).toBe(original);
    expect(JSON.stringify(result.document)).not.toContain('"operation"');
  });

  it('executes review and delivers image evidence to the next model step before submission',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),call('submit_design',{revision:1,summary:proposal.summary})]});handle.model=model;
    const result=await designPlan(input(),new AbortController().signal);
    expect(result.phase).toBe('initial');expect(result.artifacts).toHaveLength(2);
    expect(model.doGenerateCalls).toHaveLength(3);
    const prompt=model.doGenerateCalls[2].prompt;
    const images=prompt.filter(m=>m.role==='user').flatMap(m=>m.content).filter(p=>p.type==='file');
    expect(images).toHaveLength(2);
    expect(JSON.stringify(prompt)).toContain('Tool evidence design-1');
  });
  it('enables image tools with a Settings key and preserves locale instructions',async()=>{
    handle.savedKey='stored-test-key';vi.stubEnv('MODEL_API_KEY','');vi.stubEnv('MUSE_IMAGE_ENABLED','true');
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),call('submit_design',{revision:1,summary:proposal.summary})]});handle.model=model;
    await designPlan({...input(),locale:'ko'},new AbortController().signal);
    expect(model.doGenerateCalls[1].tools?.some(t=>t.name==='generate_design_concept')).toBe(true);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('Korean');
    expect(JSON.stringify(model.doGenerateCalls)).not.toContain('stored-test-key');
  });
  it('never sends a named tool choice and narrows the final step to submit_design',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),...Array.from({length:8},()=>call('review_design',proposal)),call('submit_design',{revision:3,summary:proposal.summary})]});handle.model=model;
    await designPlan(input(),new AbortController().signal);
    expect(model.doGenerateCalls).toHaveLength(10);
    expect(model.doGenerateCalls.every(c=>c.toolChoice?.type==='auto')).toBe(true);
    const final=model.doGenerateCalls[9];
    expect(final.tools?.map(t=>t.name)).toEqual(['submit_design']);
    expect(JSON.stringify(final.prompt)).toContain('Final step: call submit_design');
  });
  it('reserves the final reviewed revision for submission when review budget is exhausted',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),call('review_design',proposal),call('review_design',proposal),call('submit_design',{revision:3,summary:proposal.summary})]});handle.model=model;
    await designPlan(input(),new AbortController().signal);
    const final=model.doGenerateCalls[4];
    expect(final.tools?.map(tool=>tool.name)).toEqual(['submit_design']);
    expect(JSON.stringify(final.prompt)).toContain('current revision=3');
    expect(JSON.stringify(final.prompt)).toContain('reviews remaining=0');
  });
  it('rejects submission without review',async()=>{
    handle.model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('submit_design',{revision:1,summary:proposal.summary})]});
    await expect(designPlan(input(),new AbortController().signal)).rejects.toThrow('not been visually reviewed');
  });
  it('rejects stale revisions after a second review',async()=>{
    handle.model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),call('review_design',proposal),call('submit_design',{revision:1,summary:'Stale'})]});
    await expect(designPlan(input(),new AbortController().signal)).rejects.toThrow('not been visually reviewed');
  });
  it('returns the exact reviewed geometry and assumptions without regenerating them at submission',async()=>{
    const candidate={...proposal,objects:[{id:'stage',kind:'stage',label:'Stage',x:.5,y:.5,width:3,depth:2,height:1,rotation:0,color:'#445566'}],assumptions:['Provisional height']};
    handle.model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',candidate),call('submit_design',{revision:1,summary:'Reviewed design'})]});
    const result=await designPlan(input(),new AbortController().signal);
    expect(result.document.objects?.[0]).toMatchObject(candidate.objects[0]);
    expect(result.document.warnings).toContain('Provisional height');
  });
  it('uses the same loop for revisions and preserves reviewed source geometry',async()=>{
    const request=input();request.document.objects=[{id:'old',kind:'stage',label:'Old',x:.5,y:.5,width:3,depth:2,height:1,rotation:0,color:'#445566'}];
    const original=JSON.stringify(request.document);
    handle.model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',brief),call('review_design',proposal),call('submit_design',{revision:1,summary:proposal.summary})]});
    const result=await designPlan(request,new AbortController().signal);
    expect(result.phase).toBe('revision');expect(result.document.objects).toEqual([]);
    expect(JSON.stringify(request.document)).toBe(original);
  });
  it('refuses a reviewed but unfurnished interior instead of treating zero geometry warnings as completion',async()=>{
    const interior={scope:'interior',direction:'Furnished lounge',requirements:[{id:'chairs',label:'Two chairs',target:'objects',kinds:['furniture'],minimum:2}]};
    handle.model=new MockLanguageModelV4({doGenerate:[call('set_design_brief',interior),call('review_design',proposal),call('submit_design',{revision:1,summary:proposal.summary})]});
    await expect(designPlan(input(),new AbortController().signal)).rejects.toThrow('missing requested elements');
  });
  it('returns a distinct cancellation and logs only safe run metadata',async()=>{
    const log=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const controller=new AbortController();controller.abort(new Error('private-provider-secret'));
    handle.model=new MockLanguageModelV4({doGenerate:async()=>{throw new Error('private-provider-secret');}});
    await expect(designPlan(input(),controller.signal)).rejects.toMatchObject({status:499});
    expect(JSON.stringify(log.mock.calls)).toContain('cancelled');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-provider-secret');
    log.mockRestore();
  });

});
