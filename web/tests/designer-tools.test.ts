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
  return { base, draft: base, phase: 'initial', revision: 0, sources: [], env: {}, signal: new AbortController().signal, artifacts: [], pendingImages: [], calls: new Map() };
}
const proposal = { summary: 'Focal point', objects: [{ id:'stage', kind:'stage', label:'Stage', x:.5,y:.5,width:5,depth:3,height:1,rotation:0,color:'#335577' }], assumptions: [] };
const options = { toolCallId: 'test', messages: [], context: {} };

describe('shared Designer Muse tools', () => {
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
  it('does not mutate draft state on invalid proposals or cancelled requests', async () => {
    const c=context(), review=createDesignTools(c).review_design;
    await expect(review.execute!({...proposal,objects:[proposal.objects[0],proposal.objects[0]]},options)).rejects.toThrow('unique');
    expect(c.revision).toBe(0); expect(c.artifacts).toHaveLength(0);
    const controller=new AbortController();controller.abort();c.signal=controller.signal;
    await expect(review.execute!(proposal,options)).rejects.toThrow();
    expect(c.revision).toBe(0);
  });
});
