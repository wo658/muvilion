import { expect, test, type Page } from '@playwright/test';
import { emptyPlan } from '../../helpers/assets';

// Geometry fixture only; this test does not claim a live model furnished the floor.
// Its concave cut-out must remain workspace canvas, never become event floor.
const boundary = [{x:.1,y:.1},{x:.5,y:.1},{x:.5,y:.5},{x:.9,y:.5},{x:.9,y:.9},{x:.1,y:.9}];
const document = {...emptyPlan,source:{...emptyPlan.source,name:'Concave event floor · rendering regression'},floorBoundary:boundary,zones:[{id:'event-program',label:'전체 행사 프로그램',purpose:'experience',x:.5,y:.5,width:9.6,depth:9.6,rotation:0,assignable:false}]};

async function topView(page: Page) {
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('canvas')).toBeVisible();
  const expanded = page.locator('button[aria-controls="muse-panel"][aria-expanded="true"]');
  if(await expanded.isVisible()) await expanded.click();
  await page.getByRole('button',{name:'위에서',exact:true}).click();
  await expect(page.getByRole('button',{name:'위에서',exact:true})).toHaveAttribute('aria-pressed','true');
}
async function renderedSamples(page: Page) {
  const png = await page.locator('canvas').screenshot({animations:'disabled',scale:'css'});
  return sampleImage(page,`data:image/png;base64,${png.toString('base64')}`,12);
}
async function sampleImage(page: Page,source:string,distance:number) {
  return page.evaluate(async ({source,distance}) => {
    const image = new Image();image.src=source;await image.decode();
    const canvas = window.document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    // Production top camera has y=max(width,depth)=12 m, fov=40 degrees.
    const pixelsPerMetre=canvas.height/(2*distance*Math.tan(20*Math.PI/180));
    const sample=(worldX:number,worldY:number)=>{
      const x=Math.round(canvas.width/2+worldX*pixelsPerMetre),y=Math.round(canvas.height/2+worldY*pixelsPerMetre);
      const pixels=ctx.getImageData(x-4,y-4,9,9).data;
      return [0,1,2].map(channel=>Array.from({length:81},(_,i)=>pixels[i*4+channel]).sort((a,b)=>a-b)[40]);
    };
    const interior=sample(-2,-2),cutout=sample(2,-2),lowerInterior=sample(2,2),outside=sample(-6,2);
    ctx.fillStyle=getComputedStyle(window.document.documentElement).getPropertyValue('--sunken').trim();ctx.fillRect(0,0,1,1);
    const expectedCanvas=[...ctx.getImageData(0,0,1,1).data].slice(0,3);
    const colorDistance=(a:number[],b:number[])=>a.reduce((sum,value,i)=>sum+Math.abs(value-b[i]),0);
    return {interior,cutout,lowerInterior,outside,expectedCanvas,cutoutError:colorDistance(cutout,expectedCanvas),outsideError:colorDistance(outside,expectedCanvas),interiorDifference:colorDistance(interior,cutout),lowerDifference:colorDistance(lowerInterior,cutout)};
  },{source,distance});
}

/** 실제 3D에서 오목한 도면 경계 안만 바닥이고, 외부와 잘려나간 부분은 캔버스로 남는다. */
test('도면 내부와 비도면 캔버스를 구분하고 저장된 경계와 축척을 유지한다',async({page})=>{
  let id:string;
  await test.step('오목한 검토 경계를 가진 격리 프로젝트 열기',async()=>{
    const response=await page.request.post('/api/projects',{data:{name:'도면 경계와 캔버스 회귀',state:{projectVersion:1,document,sources:{version:1,drawingSelected:true,items:[]},originalDrawingId:null}}});
    expect(response.ok()).toBeTruthy();id=(await response.json()).id;await page.goto(`/?project=${id}`);await topView(page);
  });
  await test.step('실제 렌더에서 행사 구역은 바닥 안에만 표시되고 오목한 외부는 캔버스로 남는지 확인',async()=>{
    await expect.poll(async()=>{
      const samples=await renderedSamples(page);
      return samples.cutoutError<=6 && samples.outsideError<=6 && samples.interiorDifference>6 && samples.lowerDifference>6;
    },{timeout:15000,message:'경계의 오목한 빈 부분과 바깥은 캔버스 토큰이고 두 내부 지점은 실제 바닥이어야 한다.'}).toBe(true);
  });
  await test.step('사진 전용 렌더러에서도 도면 밖 행사 구역이 잘리는지 확인',async()=>{
    // 모델 응답만 고정한다. 사진 픽셀은 실제 별도 WebGL 렌더러에서 생성된다.
    const intent={title:'도면 경계 사진 fixture',description:'실제 렌더러의 경계 마스크 확인',targetIds:['event-program'],view:'overview',framing:'venue',azimuth:0,elevation:75,distanceScale:1};
    const shot={id:'boundary-top',eye:[0,24,.001],target:[0,0,0],fov:40,zoom:1,aspect:16/9,cutaway:true,ceilingMode:'hidden',showStructure:true,showOverhead:true};
    await page.route('**/api/plans/intent',route=>route.fulfill({json:{intent:'photography',brief:'도면 전체를 촬영해줘',message:'[모델 응답 fixture] 경계 사진을 촬영합니다.'}}));
    await page.route('**/api/plans/photography',route=>route.fulfill({json:route.request().postDataJSON().phase==='plan'?{intent,candidates:[shot]}:{action:'select',shotId:shot.id,explanation:'[모델 응답 fixture] 경계 검증용 사진'}}));
    await page.locator('button[aria-controls="muse-panel"][aria-expanded="false"]').click();
    await page.getByRole('textbox',{name:'Muse에게 도면에 관해 질문하기'}).fill('도면 전체를 촬영해줘');
    await page.getByRole('button',{name:'메시지 보내기',exact:true}).click();
    const photo=page.getByTestId('selected-photo');await expect(photo).toBeVisible({timeout:30000});
    const samples=await sampleImage(page,(await photo.getAttribute('src'))!,24);
    expect(samples.cutoutError).toBeLessThanOrEqual(9);expect(samples.outsideError).toBeLessThanOrEqual(9);
    expect(samples.interiorDifference).toBeGreaterThan(6);expect(samples.lowerDifference).toBeGreaterThan(6);
  });
  await test.step('새로고침 후에도 실제 경계와 12m 축척이 보존되는지 확인',async()=>{
    await page.reload();await topView(page);
    const saved=await(await page.request.get(`/api/projects/${id}`)).json();
    // 화면을 채우려고 도면을 축소하거나 외곽 사각형으로 바꿔서는 안 된다.
    expect(saved.state.document.floorBoundary).toEqual(boundary);
    expect(saved.state.document.zones).toEqual(document.zones);
    expect(saved.state.document.widthMeters).toBe(12);expect(saved.state.document.heightMeters).toBe(12);
    await expect.poll(async()=>(await renderedSamples(page)).cutoutError,{timeout:15000}).toBeLessThanOrEqual(6);
  });
});
