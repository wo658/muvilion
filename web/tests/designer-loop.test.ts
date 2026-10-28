import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
const handle = vi.hoisted(() => ({ model: undefined as unknown, savedKey: undefined as string | undefined }));
vi.mock('@/server/agent/model', () => ({getModel:()=>({hasKey:true,model:handle.model})}));
vi.mock("@/server/settings/store", () => ({ storedMetaKey: () => handle.savedKey }));
import { designPlan, DesignRequest } from '@/server/plans/design';

const proposal = { summary:'An open central focal point and balanced perimeter.', objects:[], assumptions:[] };
const usage = { inputTokens: {total:10,noCache:10,cacheRead:undefined,cacheWrite:undefined}, outputTokens:{total:5,text:5,reasoning:undefined} };
function call(name:string, input:unknown) {
  return {content:[{type:'tool-call' as const,toolCallId:crypto.randomUUID(),toolName:name,input:JSON.stringify(input)}],finishReason:{unified:'tool-calls' as const,raw:undefined},usage,warnings:[]};
}
function input() {return DesignRequest.parse({brief:'Design an open gallery',sources:[],document:{schemaVersion:1,source:{name:'hall',format:'pdf',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:20,heightMeters:20,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'pdf-vector'}});}
beforeEach(()=>{handle.savedKey=undefined;vi.stubEnv('MUSE_IMAGE_ENABLED','false');});

describe('Designer Muse SDK loop',()=>{
  it('executes review and delivers image evidence to the next model step before submission',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[call('review_design',proposal),call('submit_design',proposal)]});handle.model=model;
    const result=await designPlan(input(),new AbortController().signal);
    expect(result.phase).toBe('initial');expect(result.artifacts).toHaveLength(2);
    expect(model.doGenerateCalls).toHaveLength(2);
    const prompt=model.doGenerateCalls[1].prompt;
    const images=prompt.filter(m=>m.role==='user').flatMap(m=>m.content).filter(p=>p.type==='file');
    expect(images).toHaveLength(2);
    expect(JSON.stringify(prompt)).toContain('Tool evidence design-1');
  });
  it('enables image tools with a Settings key and preserves locale instructions',async()=>{
    handle.savedKey='stored-test-key';vi.stubEnv('MODEL_API_KEY','');vi.stubEnv('MUSE_IMAGE_ENABLED','true');
    const model=new MockLanguageModelV4({doGenerate:[call('review_design',proposal),call('submit_design',proposal)]});handle.model=model;
    await designPlan({...input(),locale:'ko'},new AbortController().signal);
    expect(model.doGenerateCalls[0].tools?.some(t=>t.name==='generate_design_concept')).toBe(true);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('Korean');
    expect(JSON.stringify(model.doGenerateCalls)).not.toContain('stored-test-key');
  });
  it('never sends a named tool choice and narrows the final step to submit_design',async()=>{
    const model=new MockLanguageModelV4({doGenerate:[...Array.from({length:7},()=>call('review_design',proposal)),call('submit_design',proposal)]});handle.model=model;
    await designPlan(input(),new AbortController().signal);
    expect(model.doGenerateCalls).toHaveLength(8);
    expect(model.doGenerateCalls.every(c=>c.toolChoice?.type==='auto')).toBe(true);
    const final=model.doGenerateCalls[7];
    expect(final.tools?.map(t=>t.name)).toEqual(['submit_design']);
    expect(JSON.stringify(final.prompt)).toContain('Final step: call submit_design');
  });
  it('rejects submission without review',async()=>{
    handle.model=new MockLanguageModelV4({doGenerate:[call('submit_design',proposal)]});
    await expect(designPlan(input(),new AbortController().signal)).rejects.toThrow('not been visually reviewed');
  });
  it('rejects changed geometry after a reviewed candidate',async()=>{
    handle.model=new MockLanguageModelV4({doGenerate:[call('review_design',proposal),call('submit_design',{...proposal,objects:[{id:'new',kind:'stage',label:'New',x:.5,y:.5,width:3,depth:2,height:1,rotation:0,color:'#445566'}]})]});
    await expect(designPlan(input(),new AbortController().signal)).rejects.toThrow('not been visually reviewed');
  });
  it('uses the same loop for revisions and preserves reviewed source geometry',async()=>{
    const request=input();request.document.objects=[{id:'old',kind:'stage',label:'Old',x:.5,y:.5,width:3,depth:2,height:1,rotation:0,color:'#445566'}];
    const original=JSON.stringify(request.document);
    handle.model=new MockLanguageModelV4({doGenerate:[call('review_design',proposal),call('submit_design',proposal)]});
    const result=await designPlan(request,new AbortController().signal);
    expect(result.phase).toBe('revision');expect(result.document.objects).toEqual([]);
    expect(JSON.stringify(request.document)).toBe(original);
  });
});
