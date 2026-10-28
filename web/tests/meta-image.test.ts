import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { generateConceptImage } from '@/server/agent/tools/meta-image';
afterEach(()=>vi.unstubAllGlobals());

describe('Meta concept image adapter',()=>{
  it('sends selected inline references to the edits endpoint and normalizes the result',async()=>{
    const png=await sharp({create:{width:8,height:8,channels:3,background:'#334455'}}).png().toBuffer();
    const fetcher=vi.fn().mockResolvedValue(Response.json({data:[{b64_json:png.toString('base64')}]}));vi.stubGlobal('fetch',fetcher);
    const reference=`data:image/png;base64,${png.toString('base64')}`;
    const output=await generateConceptImage('Explore a restrained blue palette',[reference],new AbortController().signal,{MODEL_API_KEY:'test'});
    const [url,options]=fetcher.mock.calls[0];
    expect(url).toBe('https://api.meta.ai/v1/images/edits');
    expect(JSON.parse(options.body).images).toEqual([{image_url:reference}]);
    expect(output).toMatch(/^data:image\/webp;base64,/);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('uses generations for reference-free initial ideation',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response('',{status:503}));vi.stubGlobal('fetch',fetcher);
    await expect(generateConceptImage('Concept',[],new AbortController().signal,{MODEL_API_KEY:'test'})).rejects.toThrow('503');
    expect(fetcher.mock.calls[0][0]).toContain('/images/generations');
  });
  it('does not fetch returned image URLs or expose provider error bodies',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({data:[{url:'https://untrusted.invalid/image'}]}));vi.stubGlobal('fetch',fetcher);
    await expect(generateConceptImage('Concept',[],new AbortController().signal,{MODEL_API_KEY:'test'})).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('passes caller cancellation to the external request',async()=>{
    const controller=new AbortController();controller.abort();
    vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{options.signal.throwIfAborted();return new Response();}));
    await expect(generateConceptImage('Concept',[],controller.signal,{MODEL_API_KEY:'test'})).rejects.toThrow();
  });
});
