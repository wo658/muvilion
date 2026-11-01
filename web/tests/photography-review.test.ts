import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), provider: "meta" }));
vi.mock("@/server/agent/model", () => ({ getModel: () => ({ model: {}, hasKey: true, provider: mocks.provider }) }));
vi.mock("ai", () => ({ generateText: mocks.generate, tool: (value: unknown) => value }));
import { POST } from "@/app/api/plans/photography/route";
import { generatePhotoCandidates, PhotoIntentSchema } from "@/lib/plans/photography";
import type { PlanDocument } from "@/lib/plans/schema";

const document: PlanDocument = { schemaVersion:1,source:{name:"room",format:"image",page:1,pages:1,width:100,height:100},preview:"data:image/png;base64,AA==",widthMeters:20,heightMeters:15,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv",floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],objects:[{id:"stage",kind:"stage",label:"Main stage",x:.6,y:.5,width:3,depth:2,height:1,rotation:0,color:"#ffffff"}] };
const intent = PhotoIntentSchema.parse({ title:"메인 무대", description:"무대와 주변 통로의 관계", targetIds:["stage"], view:"detail", azimuth:45, elevation:35, distanceScale:1 });
const candidate = () => ({shot:generatePhotoCandidates(document,intent)[0],image:"data:image/png;base64,AA=="});
const request = (extra:object={}) => new Request("http://localhost/api/plans/photography", {method:"POST",body:JSON.stringify({phase:"review",document,intent,candidates:[candidate()],round:0,locale:"ko",...extra})});
const decide = (decision:object) => mocks.generate.mockResolvedValue({toolCalls:[{toolName:"review_photo",input:decision}]});
beforeEach(()=>{vi.clearAllMocks();mocks.generate.mockReset();mocks.provider="meta";});

describe("촬영 구도 개선",()=>{
 it("Meta 이미지 검토와 출력 복구는 낮은 추론 강도로 원본 이미지를 유지한다",async()=>{
  const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
  try {
   mocks.generate.mockResolvedValueOnce({toolCalls:[],text:"",finishReason:"length",usage:{outputTokens:2500,outputTokenDetails:{reasoningTokens:2498}}})
    .mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"select",shotId:candidate().shot.id,explanation:"무대와 통로가 선명하게 보입니다.",intent:null}}]});
   expect((await POST(request())).status).toBe(200);
   expect(mocks.generate).toHaveBeenCalledTimes(2);
   const [initial,recovery]=mocks.generate.mock.calls.map(call=>call[0]);
   expect(initial.providerOptions).toEqual({meta:{reasoningEffort:"low"}});
   expect(recovery.providerOptions).toEqual({meta:{reasoningEffort:"low"}});
   expect(recovery.messages).toEqual(initial.messages);
   expect(initial.messages[0].content).toContainEqual({type:"image",image:candidate().image});
   expect(recovery.abortSignal).toBe(initial.abortSignal);
   expect([initial.maxOutputTokens,recovery.maxOutputTokens]).toEqual([2500,8000]);
  } finally {warn.mockRestore();}
 });
 it("다른 제공자의 추론 설정은 Meta 촬영 정책으로 덮어쓰지 않는다",async()=>{
  mocks.provider="baseten";
  decide({action:"select",shotId:candidate().shot.id,explanation:"무대가 보입니다.",intent:null});
  expect((await POST(request())).status).toBe(200);
  expect(mocks.generate.mock.calls[0][0].providerOptions).toBeUndefined();
 });

 it("도면에 없는 벽과 천장은 실측이 아닌 렌더링 가정으로 모델에게 알린다",async()=>{
  decide({action:"select",shotId:candidate().shot.id,explanation:"무대와 공간을 보여줍니다.",intent:null});
  expect((await POST(request())).status).toBe(200);
  const content=mocks.generate.mock.calls[0][0].messages[0].content;
  const {scene}=JSON.parse(content[0].text);
  expect(scene.enclosure).toMatchObject({assumedWalls:true,assumedCeiling:true});
  expect(scene.enclosure.ceiling.height).toBeGreaterThan(1.65);
  expect(scene.ceiling).toBeUndefined();
 });
 it("가려진 장면을 다시 촬영할 때 원래 제목과 설명 목적을 유지한다",async()=>{
  decide({action:"revise",shotId:null,explanation:"전경 가벽이 무대를 가려 반대쪽으로 이동합니다.",intent:{...intent,title:"새로운 장면",description:"다른 기획 의도",azimuth:135}});
  const response=await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({action:"revise",intent:{...intent,azimuth:135},explanation:expect.stringContaining("가벽")});
 });
 it("이전 구도의 문제와 실제 새 이미지를 함께 검토한다",async()=>{
  const previousReviews=[{intent:{...intent,distanceScale:1.5},explanation:"빈 바닥이 너무 많아 대상을 더 크게 담습니다."}];
  decide({action:"select",shotId:candidate().shot.id,explanation:"무대가 충분히 크고 통로가 보여요.",intent:null});
  const response=await POST(request({round:1,previousReviews}));
  expect(response.status).toBe(200);
  const content=mocks.generate.mock.calls[0][0].messages[0].content;
  expect(JSON.parse(content[0].text)).toMatchObject({round:1,remainingRevisions:1,previousReviews});
  expect(content).toContainEqual({type:"image",image:candidate().image});
 });
 it("재검토에는 첫 구도 설명뿐 아니라 원래 사용자의 최종 촬영 목표도 전달한다",async()=>{
  const brief="처음에는 두 배 멀리서 후보를 찍되 최종 사진은 설치물을 크게 담고 빈 바닥을 줄여줘.";
  const provisional={...intent,description:"첫 후보는 두 배 멀리서 촬영",distanceScale:2};
  const candidates=generatePhotoCandidates(document,provisional).map(shot=>({shot,image:"data:image/png;base64,AA=="}));
  decide({action:"revise",shotId:null,explanation:"첫 후보에 빈 바닥이 많아 최종 목표에 맞게 가까이 이동합니다.",intent:{...provisional,distanceScale:1}});
  expect((await POST(request({intent:provisional,candidates,brief}))).status).toBe(200);
  const content=mocks.generate.mock.calls[0][0].messages[0].content;
  expect(JSON.parse(content[0].text)).toMatchObject({brief,intent:provisional});
  expect(content.filter((part:{type:string})=>part.type==="image")).toHaveLength(candidates.length);
 });
 it("눈높이 후보의 대상이 작으면 0.35 거리로 실제 가까운 후보를 다시 생성한다",async()=>{
  const inside={...intent,view:"interior" as const};
  const shots=generatePhotoCandidates(document,inside).map(shot=>({shot,image:"data:image/png;base64,AA=="}));
  decide({action:"revise",shotId:null,explanation:"대상이 너무 작아 더 가까운 통로로 이동합니다.",intent:{...inside,azimuth:90,distanceScale:.35}});
  const response=await POST(request({intent:inside,candidates:shots}));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({action:"revise",intent:{view:"interior",distanceScale:.35}});
 });
 it("각도나 거리 변경 없이 다시 촬영했다고 가장하지 않는다",async()=>{
  decide({action:"revise",shotId:null,explanation:"다시 촬영합니다.",intent});
  expect((await POST(request())).status).toBe(502);expect(mocks.generate).toHaveBeenCalledTimes(2);
 });
 it("최소 여백에 걸린 거리 변경으로 동일한 후보를 다시 촬영하지 않는다",async()=>{
  const currentIntent={...intent,distanceScale:.75};
  const candidates=generatePhotoCandidates(document,currentIntent).map(shot=>({shot,image:"data:image/png;base64,AA=="}));
  decide({action:"revise",shotId:null,explanation:"조금 더 멀리 이동합니다.",intent:{...currentIntent,distanceScale:.8}});
  const response=await POST(request({intent:currentIntent,candidates}));
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({error:expect.stringContaining("달라야")});
 });
 it("같은 구도를 제안하면 원본 증거와 오류 피드백으로 한 번 재판단한다",async()=>{
  const first={toolCalls:[{toolName:"review_photo",input:{action:"revise",shotId:null,explanation:"더 가까이 촬영",intent}}]};
  mocks.generate.mockResolvedValueOnce(first).mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"select",shotId:candidate().shot.id,explanation:"현재 후보가 목표를 충족합니다.",intent:null}}]});
  const previousReviews=[{intent:{...intent,distanceScale:2},explanation:"빈 바닥을 줄입니다."}], brief="무대가 크게 보이도록 촬영";
  const response=await POST(request({brief,previousReviews,round:1}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({action:"select",shotId:candidate().shot.id});
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  const [firstOptions,second]=mocks.generate.mock.calls.map(call=>call[0]);
  expect(second.messages).toEqual(firstOptions.messages);expect(second.abortSignal).toBe(firstOptions.abortSignal);
  expect(second.instructions).toContain("unchanged camera views");
  expect(JSON.parse(second.messages[0].content[0].text)).toMatchObject({brief,previousReviews});
 });
 it("구도 복구 재요청에서도 실제로 바뀐 후보만 반환한다",async()=>{
  const currentIntent={...intent,distanceScale:.75};
  const candidates=generatePhotoCandidates(document,currentIntent).map(shot=>({shot,image:"data:image/png;base64,AA=="}));
  mocks.generate.mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"revise",shotId:null,explanation:"거리 변경",intent:{...currentIntent,distanceScale:.8}}}]})
   .mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"revise",shotId:null,explanation:"다른 방향으로 이동",intent:{...currentIntent,azimuth:135}}}]});
  const response=await POST(request({intent:currentIntent,candidates}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({action:"revise",intent:{azimuth:135}});
  expect(mocks.generate).toHaveBeenCalledTimes(2);
 });
 it.each([
  {action:"reject",shotId:null,explanation:"촬영 불가",intent:null,status:422},
  {action:"select",shotId:"invented",explanation:"가짜 선택",intent:null,status:502},
  {action:"revise",shotId:null,explanation:"대상 변경",intent:{...intent,targetIds:[]},status:502},
 ])("거절이나 잘못된 대상 선택은 구도 복구를 요청하지 않는다",async decision=>{
  decide(decision);expect((await POST(request())).status).toBe(decision.status);expect(mocks.generate).toHaveBeenCalledTimes(1);
 });
 it.each([
  {action:"select",shotId:"invented",explanation:"검토하지 않은 사진",intent:null},
  {action:"revise",shotId:null,explanation:"다른 대상",intent:{...intent,targetIds:[]}},
 ])("복구 응답도 대상과 실제 후보 검증을 우회하지 않는다",async invalid=>{
  mocks.generate.mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"revise",shotId:null,explanation:"같은 구도",intent}}]})
   .mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:invalid}]});
  expect((await POST(request())).status).toBe(502);expect(mocks.generate).toHaveBeenCalledTimes(2);
 });
 it("같은 구도 응답 뒤 취소된 요청은 복구 모델 호출을 하지 않는다",async()=>{
  const controller=new AbortController();
  mocks.generate.mockImplementation(async()=>{controller.abort();return {toolCalls:[{toolName:"review_photo",input:{action:"revise",shotId:null,explanation:"같은 구도",intent}}]};});
  const req=new Request(request(),{signal:controller.signal});
  expect((await POST(req)).status).toBe(502);expect(mocks.generate).toHaveBeenCalledTimes(1);
 });
 it("좋은 첫 후보는 불필요한 재촬영 없이 선택한다",async()=>{
  decide({action:"select",shotId:candidate().shot.id,explanation:"무대와 통로가 충분히 크게 드러납니다.",intent:null});
  expect((await POST(request())).status).toBe(200);expect(mocks.generate).toHaveBeenCalledTimes(1);
 });
 it("마지막 후보도 부적합하면 성공을 강요하지 않는다",async()=>{
  decide({action:"reject",shotId:null,explanation:"모든 후보에서 무대가 가려져 있어요.",intent:null});
  const response=await POST(request({round:2}));
  expect(response.status).toBe(422);expect(await response.json()).toMatchObject({error:expect.stringContaining("가려져")});
 });
 it("진단 정보는 Next 로그에서도 보존되는 문자열로 남긴다",async()=>{
  const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
  try {
   mocks.generate.mockResolvedValue({toolCalls:[],text:"private photo details",finishReason:"content-filter",usage:{outputTokens:100}});
   await POST(request());
   expect(typeof warn.mock.calls[0][1]).toBe("string");
   expect(JSON.parse(warn.mock.calls[0][1])).toMatchObject({phase:"review",attempt:1,finishReason:"content-filter",outputTokens:100});
   expect(warn.mock.calls[0][1]).not.toContain("private photo details");
  } finally {warn.mockRestore();}
 });
 it("눈높이 사진을 검토하다 조감도로 바꾸면 원본 이미지로 다시 결정하도록 한다",async()=>{
  const inside={...intent,view:"interior" as const};
  const shot=generatePhotoCandidates(document,inside)[0];
  mocks.generate.mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"revise",shotId:null,explanation:"높이 올립니다",intent:{...inside,view:"overview",azimuth:135}}}]})
   .mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"revise",shotId:null,explanation:"통로 옆으로 이동합니다",intent:{...inside,azimuth:135}}}]});
  const response=await POST(request({intent:inside,candidates:[{shot,image:"data:image/png;base64,AA=="}]}));
  expect(response.status).toBe(200);
  const result=await response.json();expect(result.intent.view).toBe("interior");
  expect(result.candidates.every((s:{eye:number[];cutaway:boolean})=>s.eye[1]===1.65&&!s.cutaway)).toBe(true);
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  expect(mocks.generate.mock.calls[1][0].messages).toEqual(mocks.generate.mock.calls[0][0].messages);
 });

});
