import { afterEach, describe, expect, it, vi } from 'vitest';
import { photograph, type PhotoRequest } from '@/lib/plans/photography-client';
import { boothExample } from '@/lib/booths/example';
import { PhotographyRequestSchema, type PhotoIntent, type PhotoShot } from '@/lib/plans/photography';
const intent: PhotoIntent = { title: 'Entry', framing:'subjects', description: 'Show the entry', targetIds: [], view: 'overview', azimuth: 45, elevation: 40, distanceScale: 1 };
const shot: PhotoShot = { id: 'first', eye: [5,5,5], target: [0,0,0], fov:40,zoom:1,aspect:16/9,cutaway:true,ceilingMode:'hidden',showStructure:true,showOverhead:true };
const request: PhotoRequest = {id:'request',brief:'Show entry',locale:'en',history:[]};
afterEach(() => vi.unstubAllGlobals());
describe('촬영 클라이언트', () => {
  it('실제로 촬영한 픽셀을 검토에 보내고 수정 후 선택한 사진을 반환한다', async () => {
    const revised={...shot,id:'revised',eye:[-5,5,5] as [number,number,number]};
    const fetch=vi.fn().mockResolvedValueOnce(Response.json({intent,candidates:[shot]})).mockResolvedValueOnce(Response.json({action:'revise',intent,candidates:[revised],explanation:'Move left'})).mockResolvedValueOnce(Response.json({action:'select',shotId:'revised',explanation:'Entry is visible'}));
    vi.stubGlobal('fetch',fetch);
    const capture=vi.fn(async (shot:PhotoShot)=>({shot,image:`data:image/jpeg;base64,${shot.id}`}));
    const reviewed=vi.fn();
    const result=await photograph(request,boothExample(),{signal:new AbortController().signal,capture,progress:vi.fn(),reviewed});
    expect(result.shot).toEqual(revised);
    expect(JSON.parse(fetch.mock.calls[2][1].body).brief).toBe(request.brief);
    expect(JSON.parse(fetch.mock.calls[2][1].body).previousReviews).toEqual([{intent:expect.objectContaining({title:intent.title}),explanation:'Move left'}]);
    expect(result.reviews.map(review=>review.action)).toEqual(['revise','select']);
    expect(reviewed).toHaveBeenCalledTimes(2);
    expect(result.reviews[0].candidates[0].image).toBe('data:image/jpeg;base64,first');
    for (const [, options] of fetch.mock.calls) expect(PhotographyRequestSchema.safeParse(JSON.parse(options.body)).success).toBe(true);
    expect(capture.mock.calls.map(call=>call[0].id)).toEqual(['first','revised']);
    expect(JSON.parse(fetch.mock.calls[2][1].body).candidates[0].image).toBe('data:image/jpeg;base64,revised');
  });
  it('촬영 중 취소하면 늦게 도착한 이미지를 모델에 보내지 않는다', async () => {
    const controller=new AbortController();
    const fetch=vi.fn().mockResolvedValueOnce(Response.json({intent,candidates:[shot]}));vi.stubGlobal('fetch',fetch);
    await expect(photograph(request,boothExample(),{signal:controller.signal,progress:vi.fn(),capture:async()=>{controller.abort();return{shot,image:'data:image/jpeg;base64,AAAA'};}})).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
