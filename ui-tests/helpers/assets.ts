import { expect, type Page } from '@playwright/test';
export const emptyPlan={schemaVersion:1,source:{name:'CC0 에셋 테스트.png',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA5UlEQVR4nO3QQQ0AIAzAwPk3DRbWFyG5U9B0DmvzOuAnZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBRctw8GdrTzzwQAAAABJRU5ErkJggg==',widthMeters:12,heightMeters:12,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:'opencv',floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],objects:[]};
export async function importPlan(page:Page){
 await page.goto('/');
 const blank=page.getByRole('button',{name:'빈 프로젝트로 시작',exact:true});
 await expect(blank.or(page.getByRole('button',{name:'설정',exact:true}))).toBeVisible();
 if(await blank.isVisible()) await blank.click();
 await projectSettings(page);
 await expect(page.getByRole('button',{name:'프로젝트 가져오기'})).toBeEnabled();
 const previousUrl=page.url();
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'프로젝트 가져오기'}).click();
 await (await chooser).setFiles({name:'cc0-plan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(emptyPlan))});
 await expect(page).not.toHaveURL(previousUrl);
 await expect(page.getByRole('region',{name:'도면 작업 공간',exact:true})).toBeVisible();
 if(!await page.getByLabel('Muse에게 도면에 관해 질문하기').isVisible()) await page.locator('button[aria-controls="muse-panel"][aria-expanded="false"]').click();
 await expect(page.getByLabel('Muse에게 도면에 관해 질문하기')).toBeVisible();
}
export async function draft(page:Page){
 // Intent and model HTTP responses are fixtures; approval, persistence and 3D use the real app.
 await page.route('**/api/plans/intent',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({intent:'design',brief:'CC0 의자, 목재 가벽, 조명을 배치해줘',message:'CC0 에셋 배치를 제안합니다.'})}));
 await page.route('**/api/plans/design',async route=>{
  const request=route.request().postDataJSON();
  const objects=[
   {id:'chair',kind:'furniture',label:'CC0 라운지 의자',x:.25,y:.4,width:1,depth:1,height:1,rotation:0,color:'#887766',modelAssetId:'modern_arm_chair_01'},
   {id:'partition',kind:'partition',label:'CC0 목재 가벽',x:.65,y:.5,width:3,depth:.15,height:2.2,rotation:0,color:'#887766',materialAssetId:'Wood051'},
   {id:'light',kind:'light',label:'CC0 펜던트',x:.4,y:.65,width:.7,depth:.7,height:1,elevation:2,rotation:0,color:'#eeeeee',modelAssetId:'modern_ceiling_lamp_01'},
  ];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:'[모델 응답 fixture] CC0 의자·목재 가벽·펜던트 제안',document:{...request.document,objects:objects.map(o=>({...o,provenance:'ai'}))}})});
 });
 await page.getByLabel('Muse에게 도면에 관해 질문하기').fill('CC0 의자, 목재 가벽, 조명을 배치해줘');
 await page.getByRole('button',{name:'메시지 보내기',exact:true}).click();
 await expect(page.getByRole('button',{name:'변경 적용',exact:true})).toBeEnabled({timeout:60000});
}
export async function projectSettings(page:Page){
 await page.getByRole('button',{name:'설정',exact:true}).click();
 await page.getByRole('dialog',{name:'설정',exact:true}).getByRole('button',{name:'프로젝트',exact:true}).click();
}
export async function exportPlan(page:Page){
 await projectSettings(page);
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'내보내기',exact:true}).click();
 const stream=await(await event).createReadStream();await page.getByRole('dialog',{name:'설정',exact:true}).getByRole('button',{name:'닫기',exact:true}).click();const chunks:Buffer[]=[];for await(const c of stream)chunks.push(Buffer.from(c));const bundle=JSON.parse(Buffer.concat(chunks).toString());return bundle.projectVersion===2?bundle.state:bundle;
}
export async function showAssets(page:Page){
 if((page.viewportSize()?.width??1920)<800) await page.locator('button[aria-controls="muse-panel"][aria-expanded="true"]').click();
 const loaded=[
  page.waitForResponse(r=>r.url().endsWith('modern_arm_chair_01_1k.gltf')&&r.status()===200),
  page.waitForResponse(r=>r.url().endsWith('modern_ceiling_lamp_01_1k.gltf')&&r.status()===200),
  page.waitForResponse(r=>r.url().endsWith('Wood051_1K-JPG_Color.jpg')&&r.status()===200),
 ];
 await page.getByRole('button',{name:'3D',exact:true}).click();
 await Promise.all(loaded);
 await page.waitForLoadState("networkidle");
 await expect(page.locator('canvas')).toBeVisible();
 await expect(page.getByText('이 브라우저에서는 3D를 사용할 수 없어요.')).not.toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
}
