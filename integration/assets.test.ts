import { expect, test } from 'vitest';
import { createSteps } from './steps';
const document = {schemaVersion:1,source:{name:'asset-test.png',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNioAAAAASUVORK5CYII=',widthMeters:12,heightMeters:12,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'opencv',objects:[]};
const post=(doc:unknown=document)=>fetch(`${process.env.WEB_URL}/api/plans/design`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:doc,brief:'CC0 의자와 가벽을 배치해줘',sources:[]})});
/** 실제 앱이 제공하는 모델과 참조 이미지가 다운로드된 로컬 에셋인지 확인한다. */
test('다운로드한 모델과 재질을 앱에서 제공',async context=>{
 const step=createSteps(context);
 const gltf=await step('실제 glTF 모델 요청',async()=>{const response=await fetch(`${process.env.WEB_URL}/assets/cc0/models/modern_arm_chair_01/modern_arm_chair_01_1k.gltf`);expect(response.status).toBe(200);return response.json();});
 await step('모델 버전과 의존 파일 제공 확인',async()=>{
  expect(gltf.asset.version).toBe('2.0');
  for(const item of [...gltf.buffers,...gltf.images]){const response=await fetch(`${process.env.WEB_URL}/assets/cc0/models/modern_arm_chair_01/${item.uri}`);expect(response.status).toBe(200);expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);}
 });
 await step('실제 목재 재질 이미지 확인',async()=>{const response=await fetch(`${process.env.WEB_URL}/assets/cc0/materials/Wood051/Wood051_1K-JPG_Color.jpg`);expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('image/jpeg');});
});
/** 실제 전시용 원본 모델을 제공하는 공개 경로를 확인한다. */
test('전시용 GLB 원본 9종을 앱에서 제공', async context => {
 const step = createSteps(context);
 const ids = ['gallery_wall', 'movable_partition', 'display_plinth', 'display_vitrine', 'reception_desk', 'floor_plan_board', 'track_spot', 'truss_horizontal', 'truss_vertical'];
 for (const id of ids) await step(`${id} GLB 제공 및 헤더 검증`, async () => {
  const response = await fetch(`${process.env.WEB_URL}/assets/cc0/models/${id}/model.glb`);
  expect(response.status).toBe(200);
  const bytes = new DataView(await response.arrayBuffer());
  expect(bytes.getUint32(0, true)).toBe(0x46546c67);
  expect(bytes.getUint32(4, true)).toBe(2);
  expect(bytes.getUint32(8, true)).toBe(bytes.byteLength);
 });
});
/** 알려지지 않은 모델 ID가 포함된 외부 입력을 모델 호출 전에 거부한다. */
test('유효하지 않은 에셋 ID를 API 입력에서 거부',async context=>{
 const step=createSteps(context);const response=await step('가짜 에셋을 가진 문서 제출',()=>post({...document,objects:[{id:'chair',kind:'furniture',label:'chair',x:.3,y:.3,width:1,depth:1,height:1,rotation:0,color:'#888888',modelAssetId:'invented-chair'}]}));
 await step('입력 검증 오류 확인',()=>expect(response.status).toBe(400));
});
/** 확정되지 않은 도면에 디자인을 생성하지 않는 기존 경계를 보존한다. */
test('스케일 확인 전 디자인을 거부',async context=>{const step=createSteps(context);const response=await step('스케일 미확인 도면 제출',()=>post({...document,scaleConfirmed:false}));await step('입력 오류 응답 확인',()=>expect(response.status).toBe(400));});
/** 테스트 환경에 실제 모델 키가 없을 때 성공한 디자인을 꾸며내지 않는다. */
test('모델 설정이 없으면 명시적 실패를 반환',async context=>{const step=createSteps(context);const response=await step('유효한 도면으로 디자인 요청',()=>post());await step('모델 미설정 응답 확인',async()=>{expect(response.status).toBe(503);expect((await response.json()).error).toContain('MODEL_API_KEY');});});
