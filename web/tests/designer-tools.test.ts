import { describe, expect, it } from "vitest";
import { tool } from "ai";
import { z } from "zod";
import { createToolRegistry } from "@/server/agent/tools/registry";
import { createDesignTools } from "@/server/agent/tools/design-tools";
import type { DesignToolContext } from "@/server/agent/tools/design-context";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import sharp from "sharp";

function context(): DesignToolContext {
  const base = PlanDocumentSchema.parse({ schemaVersion: 1, source: { name: 'hall', format: 'pdf', page: 1, pages: 1, width: 100, height: 100 }, preview: 'data:image/png;base64,AA==', widthMeters: 20, heightMeters: 20, scaleConfirmed: true, lines: [], texts: [], warnings: [], method: 'pdf-vector' });
  return { brief: {scope:'interior',direction:'Stage focal point',requirements:[{id:'stage',label:'Stage',target:'objects',kinds:['stage'],minimum:1}]}, base, draft: base, phase: 'initial', revision: 0, sources: [], env: {}, signal: new AbortController().signal, artifacts: [], pendingImages: [], calls: new Map() };
}
const proposal = { coverage:[{requirementId:'stage',ids:['stage'],decision:'Stage focal point.'}], summary: 'Focal point', objects: [{ id:'stage', kind:'stage', label:'Stage', x:.5,y:.5,width:5,depth:3,height:1,rotation:0,color:'#335577' }], assumptions: [] };
const options = { toolCallId: 'test', messages: [], context: {} };

describe('shared Designer Muse tools', () => {
  it('blocks unusable collision-free seats without consuming review budget', async () => {
    const c=context(), review=createDesignTools(c).review_design;
    const seat={id:'chair',kind:'furniture' as const,label:'Chair',fixtureType:'event-chair' as const,x:.5,y:.3,width:.5,depth:.55,height:.85,rotation:0 as const,color:'#335577',useTargetId:'stage'};
    const result=await review.execute!({...proposal,objects:[proposal.objects[0],seat]},options) as {usability:{issues:{code:string}[]}};
    expect(result.usability.issues.map(i=>i.code)).toContain('seat_facing');
    expect(c.artifacts).toHaveLength(0);expect(c.calls.get('review_design')).toBeUndefined();
  });

  it('makes the same tools available in initial and revision phases, with asset extensions', () => {
    const c = context();
    const asset = { name:'find_design_asset', category:'asset' as const, phases:['initial','revision'] as const, create: () => tool({inputSchema:z.object({}),execute:async()=>({items:[]})}) };
    const initial = Object.keys(createDesignTools(c,[asset]));
    c.phase='revision';
    expect(Object.keys(createDesignTools(c,[asset]))).toEqual(initial);
    expect(initial).toContain('find_design_asset');
    expect(initial).not.toContain('generate_design_concept');
    c.env.MODEL_API_KEY='test';
    expect(createDesignTools(c)).toHaveProperty('generate_design_concept');
    c.env.MUSE_IMAGE_ENABLED='false';
    expect(createDesignTools(c)).not.toHaveProperty('generate_design_concept');
  });
  it('rejects registration collisions even when a registration is unavailable', () => {
    const entry = { name:'same', category:'design' as const, phases:['initial'] as const, available:()=>false, create:()=>tool({inputSchema:z.object({})}) };
    expect(()=>createToolRegistry([entry,entry],{},'initial')).toThrow('duplicate');
  });
  it('renders a candidate, queues image evidence, and preserves the original document', async () => {
    const c=context(), original=JSON.stringify(c.base), review=createDesignTools(c).review_design;
    await review.execute!(proposal,options);
    expect(JSON.stringify(c.base)).toBe(original);
    expect(c.draft.objects?.[0].id).toBe('stage');
    expect(c.pendingImages).toHaveLength(2);
    expect(c.artifacts[0].revision).toBe(1);
    const metadata=await sharp(Buffer.from(c.artifacts[0].image.split(',')[1],'base64')).metadata();
    expect(metadata.format).toBe('png'); expect(metadata.width).toBe(960);
    await review.execute!(proposal,options); await review.execute!(proposal,options);
    await expect(review.execute!(proposal,options)).rejects.toThrow('budget');
  });
  it('returns missing coverage before spending the visual review budget', async () => {
    const c=context(), review=createDesignTools(c).review_design;
    for (let i=0;i<4;i++) await review.execute!({...proposal,objects:[]},options);
    expect(c.review?.complete).toBe(false);
    expect(c.artifacts).toHaveLength(0);
    expect(c.calls.get('review_design')).toBeUndefined();
    await review.execute!(proposal,options);
    expect(c.review?.complete).toBe(true);
    expect(c.calls.get('review_design')).toBe(1);
    expect(c.pendingImages).toHaveLength(2);
  });
  it('returns overlapping physical envelopes before consuming visual review budget', async () => {
    const c=context(), review=createDesignTools(c).review_design;
    const collision={...proposal,objects:[proposal.objects[0],{...proposal.objects[0],id:'other'}]};
    const failed=await review.execute!(collision,options) as {geometryWarnings?:string[]};
    expect(failed.geometryWarnings?.join(' ')).toContain('overlaps');
    expect(c.artifacts).toHaveLength(0);
    expect(c.calls.get('review_design')).toBeUndefined();
    await review.execute!({...collision,objects:[proposal.objects[0],{...proposal.objects[0],id:'other',x:.85}]},options);
    expect(c.pendingImages).toHaveLength(2);
  });
  it('does not mutate draft state on invalid proposals or cancelled requests', async () => {
    const c=context(), review=createDesignTools(c).review_design;
    await expect(review.execute!({...proposal,objects:[proposal.objects[0],proposal.objects[0]]},options)).rejects.toThrow('unique');
    expect(c.revision).toBe(0); expect(c.artifacts).toHaveLength(0);
    const controller=new AbortController();controller.abort();c.signal=controller.signal;
    await expect(review.execute!(proposal,options)).rejects.toThrow();
    expect(c.revision).toBe(0);
  });
  it('keeps the original brief fixed and rejects review before a brief', async () => {
    const c=context(); c.brief=undefined;
    const tools=createDesignTools(c);
    await expect(tools.review_design.execute!(proposal,options)).rejects.toThrow('set_design_brief');
    const brief=context().brief!;
    await tools.set_design_brief.execute!(brief,options);
    await expect(tools.set_design_brief.execute!({...brief,direction:'Shrink the scope'},options)).rejects.toThrow('budget');
    expect(c.brief).toEqual(brief);
  });

});
