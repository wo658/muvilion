import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(()=>({run:vi.fn()}));
vi.mock('@/server/plans/design',async original=>({...await original<typeof import('@/server/plans/design')>(),designPlan:mock.run}));
vi.mock('@/server/settings/store',()=>({storedMetaKey:()=>undefined}));
import { POST } from '@/app/api/plans/design/route';
import { PlanServiceError } from '@/server/plans/errors';
const document={schemaVersion:1,source:{name:'hall',format:'pdf',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:20,heightMeters:20,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'pdf-vector'};
const request=()=>new Request('http://localhost/api/plans/design',{method:'POST',headers:{Accept:'application/x-ndjson'},body:JSON.stringify({document,brief:'design',sources:[]})});
describe('design stream HTTP lifecycle',()=>{
  it('delivers preview before the model finishes and closes with final result',async()=>{
    let finish!:(value:unknown)=>void;
    mock.run.mockImplementation(async (_input,_signal,emit)=>{emit({type:'preview',revision:1});return new Promise(resolve=>{finish=resolve;});});
    const response=await POST(request());
    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    const reader=response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('preview');
    finish({document,summary:'Reviewed'});
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('complete');
    expect((await reader.read()).done).toBe(true);
  });
  it('propagates disconnect cancellation to the active model',async()=>{
    let active!:AbortSignal;
    mock.run.mockImplementation(async (_input,signal)=>{active=signal;await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true}));});
    const response=await POST(request());
    await response.body!.cancel();
    expect(active.aborted).toBe(true);
  });
  it('sends a safe terminal error instead of a final proposal',async()=>{
    mock.run.mockRejectedValue(new PlanServiceError('Review failed.',502));
    const response=await POST(request());
    expect(await response.text()).toBe('{"type":"error","error":"Review failed."}\n');
    mock.run.mockRejectedValue(new Error('private provider headers'));
    const unexpected=await POST(request());
    const text=await unexpected.text();expect(text).not.toContain('private');expect(text).toContain('unchanged');
  });
});
