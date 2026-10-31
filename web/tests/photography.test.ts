import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), hasKey: true }));
vi.mock("@/server/agent/model", () => ({ getModel: () => ({ model: {}, hasKey: mocks.hasKey }) }));
vi.mock("ai", () => ({ generateText: mocks.generate, tool: (value: unknown) => value }));
import { generatePhotoCandidates, PhotoIntentSchema, PhotoShotSchema } from "@/lib/plans/photography";
import { POST } from "@/app/api/plans/photography/route";
import type { PlanDocument } from "@/lib/plans/schema";
const document: PlanDocument = { schemaVersion:1,source:{name:"room",format:"image",page:1,pages:1,width:100,height:100},preview:"data:image/png;base64,AA==",widthMeters:20,heightMeters:15,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv",floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],objects:[{id:"stage",kind:"stage",label:"Main stage",x:.6,y:.5,width:3,depth:2,height:1,rotation:0,color:"#ffffff"}] };
const intent = PhotoIntentSchema.parse({title:"메인 무대",description:"무대와 주변 통로의 관계",targetIds:["stage"],view:"detail",azimuth:45,elevation:35,distanceScale:1});
const request = (body:unknown) => new Request("http://localhost/api/plans/photography",{method:"POST",body:JSON.stringify(body)});
const decide = (name:string,input:unknown) => mocks.generate.mockResolvedValue({toolCalls:[{toolName:name,input}]});
beforeEach(()=>{vi.clearAllMocks();mocks.hasKey=true;});
describe("공간 촬영",()=>{
 it("선택한 대상 주위를 촬영하고 도면을 변경하지 않는다",()=>{
  const before=JSON.stringify(document); const shots=generatePhotoCandidates(document,intent);
  expect(shots).toHaveLength(4);expect(shots.every(shot=>PhotoShotSchema.safeParse(shot).success)).toBe(true);
  expect(shots[0].target).toEqual([expect.closeTo(2),.5,0]);expect(JSON.stringify(document)).toBe(before);
  expect(generatePhotoCandidates(document,{...intent,targetIds:["missing"]})).toEqual([]);
 });
 it("실내 촬영은 바닥 경계와 충분한 공간이 필요하다",()=>{
  expect(generatePhotoCandidates({...document,floorBoundary:undefined},{...intent,view:"interior"})).toEqual([]);
  expect(generatePhotoCandidates({...document,ceiling:{height:1,status:"confirmed",color:"#ffffff"}},{...intent,view:"interior"})).toEqual([]);
  expect(generatePhotoCandidates(document,{...intent,view:"interior"}).every(shot=>shot.eye[1]===1.65 && !shot.cutaway)).toBe(true);
 });
 it("촬영 의도와 대상에서 후보를 만든다",async()=>{
  decide("plan_photo",intent);const response=await POST(request({phase:"plan",document,brief:"무대를 찍어줘",locale:"ko"}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({intent,candidates:expect.any(Array)});
 });

 it("첫 촬영 계획에 기존 벽과 좌표 기준을 제공한다",async()=>{
  decide("plan_photo",intent);
  const wall={id:"wall",a:{x:.1,y:.1},b:{x:.9,y:.1},kind:"wall",origin:"manual",confidence:1};
  await POST(request({phase:"plan",document:{...document,lines:[wall]},brief:"무대를 찍어줘"}));
  const scene=JSON.parse(mocks.generate.mock.calls[0][0].messages[0].content).scene;
  expect(scene.walls).toEqual([{id:"wall",a:wall.a,b:wall.b}]);
  expect(scene.wallCount).toBe(1);expect(scene.wallsTruncated).toBe(false);
  expect(scene.coordinateSystem).toContain("normalized");
 });
 it("미확정 축척에서는 모델을 호출하지 않는다",async()=>{
  expect((await POST(request({phase:"plan",document:{...document,scaleConfirmed:false},brief:"촬영"}))).status).toBe(422);
  expect(mocks.generate).not.toHaveBeenCalled();
 });
 it("실제 후보 이미지를 모델에 전달하고 존재하는 컷만 선택한다",async()=>{
  const shot=generatePhotoCandidates(document,intent)[0], image="data:image/png;base64,AA==";
  decide("review_photo",{action:"select",shotId:shot.id,explanation:"무대와 통로가 함께 보여요.",intent:null});
  const req=request({phase:"review",document,intent,candidates:[{shot,image}],round:0});
  expect((await POST(req)).status).toBe(200);
  const options=mocks.generate.mock.calls[0][0];expect(options.messages[0].content).toContainEqual({type:"image",image});expect(options.abortSignal.aborted).toBe(false);
  decide("review_photo",{action:"select",shotId:"invented",explanation:"좋아요",intent:null});
  expect((await POST(request({phase:"review",document,intent,candidates:[{shot,image}],round:0}))).status).toBe(502);
 });
 it("가림 문제로 수정한 의도에서 새 후보를 만들고 반복 한도를 지킨다",async()=>{
  const shot=generatePhotoCandidates(document,intent)[0], revised={...intent,azimuth:135};
  decide("review_photo",{action:"revise",shotId:null,explanation:"반대쪽에서 통로를 보여줍니다.",intent:revised});
  const body={phase:"review",document,intent,candidates:[{shot,image:"data:image/png;base64,AA=="}],round:0};
  const response=await POST(request(body));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({action:"revise",intent:revised,candidates:[expect.objectContaining({id:"photo-1-1"}),expect.anything(),expect.anything(),expect.anything()]});
  expect((await POST(request({...body,round:2}))).status).toBe(422);
 });
 it("잘못된 대상이나 외부 이미지 URL은 실행하지 않는다",async()=>{
  decide("plan_photo",{...intent,targetIds:["missing"]});expect((await POST(request({phase:"plan",document,brief:"촬영"}))).status).toBe(502);
  mocks.generate.mockClear();const shot=generatePhotoCandidates(document,intent)[0];
  expect((await POST(request({phase:"review",document,intent,candidates:[{shot,image:"https://example.com/image.png"}],round:0}))).status).toBe(400);
  expect(mocks.generate).not.toHaveBeenCalled();
 });

 it("수정 과정에서 촬영 대상이 바뀌면 성공으로 처리하지 않는다",async()=>{
  const shot=generatePhotoCandidates(document,intent)[0];
  decide("review_photo",{action:"revise",shotId:null,explanation:"다른 대상을 봅니다.",intent:{...intent,view:"overview",targetIds:[]}});
  expect((await POST(request({phase:"review",document,intent,candidates:[{shot,image:"data:image/png;base64,AA=="}],round:0}))).status).toBe(502);
 });

 it("도구 호출이 생략되면 원본 이미지를 유지하여 한 번만 재요청한다",async()=>{
  const shot=generatePhotoCandidates(document,intent)[0], image="data:image/png;base64,AA==";
  mocks.generate.mockResolvedValueOnce({toolCalls:[],text:"이미지를 살펴봅니다",finishReason:"length",usage:{outputTokens:2500,outputTokenDetails:{reasoningTokens:2400}}})
    .mockResolvedValueOnce({toolCalls:[{toolName:"review_photo",input:{action:"select",shotId:shot.id,explanation:"무대가 보여요",intent:null}}],finishReason:"tool-calls"});
  const response=await POST(request({phase:"review",document,intent,candidates:[{shot,image}],round:0}));
  expect(response.status).toBe(200);expect(mocks.generate).toHaveBeenCalledTimes(2);
  const [first,second]=mocks.generate.mock.calls.map(call=>call[0]);
  expect(second.messages).toEqual(first.messages);expect(second.messages[0].content).toContainEqual({type:"image",image});
  expect(second.instructions).toContain("No tool call");expect(second.maxOutputTokens).toBe(8000);
  expect(second.abortSignal).toBe(first.abortSignal);
 });
 it("두 번 모두 도구 호출이 없으면 촬영 성공으로 표시하지 않는다",async()=>{
  mocks.generate.mockResolvedValue({toolCalls:[],text:"No tool",finishReason:"stop"});
  expect((await POST(request({phase:"plan",document,brief:"촬영"}))).status).toBe(502);
  expect(mocks.generate).toHaveBeenCalledTimes(2);
 });
 it.each(["content-filter","error","interrupted"])("%s 중단은 재요청하지 않는다",async finishReason=>{
  mocks.generate.mockResolvedValue({toolCalls:[],finishReason});
  expect((await POST(request({phase:"plan",document,brief:"촬영"}))).status).toBe(502);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
 });
 it("중복 호출을 재시도하거나 첫 호출만 선택하지 않는다",async()=>{
  mocks.generate.mockResolvedValue({toolCalls:[{toolName:"plan_photo",input:intent},{toolName:"plan_photo",input:intent}],finishReason:"tool-calls"});
  expect((await POST(request({phase:"plan",document,brief:"촬영"}))).status).toBe(502);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
 });
 it("요청이 취소되면 복구 호출을 시작하지 않는다",async()=>{
  const controller=new AbortController();
  mocks.generate.mockImplementation(async()=>{controller.abort();return{toolCalls:[],finishReason:"stop"};});
  const req=new Request("http://localhost/api/plans/photography",{method:"POST",body:JSON.stringify({phase:"plan",document,brief:"촬영"}),signal:controller.signal});
  expect((await POST(req)).status).toBe(502);expect(mocks.generate).toHaveBeenCalledTimes(1);
 });

 it("진단 기록은 모델 응답이나 이미지 없이 수치와 종료 상태만 남긴다",async()=>{
  const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
  try {
   mocks.generate.mockResolvedValue({toolCalls:[],text:"private scene description",finishReason:"content-filter",usage:{inputTokens:100,outputTokens:50,outputTokenDetails:{reasoningTokens:40},raw:{private:"provider payload"}}});
   await POST(request({phase:"plan",document,brief:"촬영"}));
   expect(warn.mock.calls[0][0]).toBe("Muvi photography response omitted a single decision");
   expect(JSON.parse(warn.mock.calls[0][1])).toMatchObject({phase:"plan",attempt:1,finishReason:"content-filter",textCharacters:25,inputTokens:100,outputTokens:50,reasoningTokens:40});
   const serialized=JSON.stringify(warn.mock.calls);expect(serialized).not.toContain("private scene");expect(serialized).not.toContain("provider payload");expect(serialized).not.toContain("base64");
  } finally { warn.mockRestore(); }
 });
 it("모델 실패를 성공한 촬영으로 대체하지 않는다",async()=>{
  mocks.hasKey=false;expect((await POST(request({phase:"plan",document,brief:"촬영"}))).status).toBe(503);
  mocks.hasKey=true;decide("plan_photo",{});expect((await POST(request({phase:"plan",document,brief:"촬영"}))).status).toBe(502);
 });
});
