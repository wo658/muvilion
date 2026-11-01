import { expect, test } from '@playwright/test';
import { emptyPlan } from '../../helpers/assets';

/** 모델 응답만 고정한다. 벽·천장 픽셀은 비어 있는 실제 도면의 생산 렌더러가 만든다. */
test('벽·천장이 없는 도면도 눈높이 촬영에서 실내로 보이고 원본에는 추정 구조를 저장하지 않는다', async ({ page }) => {
  const document = {...emptyPlan, widthMeters:18, heightMeters:12};
  const shot = {id:'enclosed',eye:[0,1.65,3],target:[0,1.65,-3],fov:60,zoom:1,aspect:16/9,cutaway:false,ceilingMode:'solid',showStructure:true,showOverhead:true};
  const intent = {title:'실내 외피 렌더 회귀',description:'가정한 벽과 천장이 눈높이에서 보인다.',targetIds:[],view:'interior',framing:'venue',azimuth:90,elevation:35,distanceScale:1};
  let id = '';
  await test.step('벽선·천장 정보가 없는 격리 도면에서 실제 촬영 흐름 시작',async()=>{
    const response=await page.request.post('/api/projects',{data:{name:'실내 외피 · 모델 응답 fixture',state:{projectVersion:1,document,sources:{version:1,drawingSelected:true,items:[]},originalDrawingId:null}}});
    expect(response.ok()).toBeTruthy();id=(await response.json()).id;
    await page.route('**/api/plans/intent',route=>route.fulfill({json:{intent:'photography',brief:'실내를 촬영해줘',message:'[모델 응답 fixture] 실내 촬영'}}));
    await page.route('**/api/plans/photography',route=>route.fulfill({json:route.request().postDataJSON().phase==='plan'?{intent,candidates:[shot]}:{action:'select',shotId:shot.id,explanation:'[모델 응답 fixture] 실내 외피 확인'}}));
    await page.goto(`/?project=${id}`);await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('textbox',{name:'Muse에게 도면에 관해 질문하기'}).fill('실내를 촬영해줘');
    await page.getByRole('button',{name:'메시지 보내기',exact:true}).click();
    await expect(page.getByTestId('selected-photo')).toBeVisible({timeout:30000});
  });
  await test.step('사진 위쪽 천장과 정면 벽이 외부 캔버스 배경과 다른 실제 표면인지 확인',async()=>{
    const source=(await page.getByTestId('selected-photo').getAttribute('src'))!;
    const samples=await page.evaluate(async source=>{
      const image=new Image();image.src=source;await image.decode();
      const canvas=window.document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
      const sample=(x:number,y:number)=>[...ctx.getImageData(Math.round(x*canvas.width),Math.round(y*canvas.height),1,1).data].slice(0,3);
      const roof=sample(.5,.1),wall=sample(.5,.45);
      ctx.fillStyle=getComputedStyle(window.document.documentElement).getPropertyValue('--sunken').trim();ctx.fillRect(0,0,1,1);
      const background=[...ctx.getImageData(0,0,1,1).data].slice(0,3);
      const distance=(a:number[],b:number[])=>a.reduce((sum,c,i)=>sum+Math.abs(c-b[i]),0);
      return {roof,wall,background,roofDistance:distance(roof,background),wallDistance:distance(wall,background)};
    },source);
    expect(samples.roofDistance).toBeGreaterThan(8);
    expect(samples.wallDistance).toBeGreaterThan(8);
  });
  await test.step('사진 복원·재촬영에서도 외피를 유지하고 원본 도면은 변경하지 않는다',async()=>{
    const panel=page.getByTestId('photography-panel'),photo=page.getByTestId('selected-photo');
    const original=await photo.getAttribute('src');
    await panel.getByText('앵글 미세조정',{exact:true}).click();
    await panel.getByRole('button',{name:'이 앵글로 이동',exact:true}).click();
    await panel.getByRole('button',{name:'다시 촬영',exact:true}).click();
    await expect(photo).toHaveAttribute('src',original!);
    const saved=await(await page.request.get(`/api/projects/${id}`)).json();
    expect(saved.state.document.ceiling).toBeUndefined();
    expect(saved.state.document.lines).toEqual([]);
    expect(saved.state.document.floorBoundary).toEqual(document.floorBoundary);
    expect(saved.state.document.objects).toEqual([]);
  });
});
