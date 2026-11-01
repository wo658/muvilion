import { expect, test } from 'vitest';
import { createSteps } from './steps';

const document = {schemaVersion:1,source:{name:'전체 홀 검증',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:90,heightMeters:63,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'opencv',objects:[]};

/** 큰 홀의 저장 계약과 설계 입력이 동일한 200개 객체를 손실 없이 수용한다. */
test('큰 홀의 200개 설치물을 저장·재조회하고 전체 설계 입력으로 전달한다',async context=>{
  const step=createSteps(context);
  const objects=Array.from({length:200},(_,i)=>({id:`fixture-${i}`,kind:'equipment',label:`설치물 ${i+1}`,x:(i%20+.5)/20,y:(Math.floor(i/20)+.5)/10,width:1,depth:1,height:1,rotation:0,color:'#445566'}));
  const scene={...document,floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],objects};
  const project=await step('200개 설치물의 격리 프로젝트 저장',async()=>{
    const response=await fetch(`${process.env.WEB_URL}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'전체 홀 계약 검증',state:{projectVersion:1,document:scene,sources:{version:1,drawingSelected:true,items:[]},originalDrawingId:null}})});
    expect(response.ok).toBe(true);return response.json();
  });
  const saved=await step('저장한 도면 재조회 및 설치물 보존 확인',async()=>{
    const response=await fetch(`${process.env.WEB_URL}/api/projects/${project.id}`);
    expect(response.ok).toBe(true);const saved=await response.json();
    expect(saved.state.document.objects).toEqual(objects);return saved;
  });
  await step('동일 도면을 전체 꾸미기 API에 전달하여 본문 수용 확인',async()=>{
    const response=await fetch(`${process.env.WEB_URL}/api/plans/design`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:saved.state.document,sources:[],brief:'도면 전체 공간을 꾸며줘',locale:'ko'})});
    // 격리 환경에는 모델 키가 없다. 도면 크기/객체 수 오류 대신 설정 단계까지 도달해야 한다.
    expect(response.status).toBe(503);
  });
});
