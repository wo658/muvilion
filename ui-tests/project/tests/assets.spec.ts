import { expect,test } from '@playwright/test';
import { draft,exportPlan,importPlan,showAssets } from '../../helpers/assets';
/** 실제 앱과 모델 응답 fixture를 통해 제안 승인 경계 및 에셋 보존을 검증한다. */
test('에셋 제안은 Apply 후 반영되고 내보내기와 새로고침에 보존된다',async({page})=>{
 await test.step('스케일 확정된 빈 도면을 프로젝트 입력으로 열기',()=>importPlan(page));
 await test.step('모델 응답 fixture로 CC0 에셋 제안 준비',()=>draft(page));
 await test.step('Apply 전 현재 문서가 변경되지 않았는지 확인',async()=>{
  const before=await exportPlan(page);expect(before.document.objects).toEqual([]);
 });
 await test.step('제안 적용 후 모델·재질 ID 보존 확인',async()=>{
  await page.getByRole('button',{name:'변경 적용',exact:true}).click();
  const result=await exportPlan(page);
  expect(result.document.objects.find((o:any)=>o.id==='gallery-wall')).toMatchObject({kind:'partition',modelAssetId:'gallery_wall'});
  expect(result.document.objects.map((o:any)=>o.modelAssetId??o.materialAssetId)).toEqual(['modern_arm_chair_01','Wood051','gallery_wall','modern_ceiling_lamp_01']);
 });
 await test.step('3D에서 GLB 전시 가벽·glTF·재질 실제 로딩 확인',()=>showAssets(page));
 await test.step('새로고침 후 저장된 에셋 참조 확인',async()=>{
  await page.getByRole("button",{name:"프로젝트 목록 펼치기",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"저장됨"})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'설정',exact:true})).toBeEnabled();
  const restored=await exportPlan(page);expect(restored.document.objects[0].modelAssetId).toBe('modern_arm_chair_01');expect(restored.document.objects[1].materialAssetId).toBe('Wood051');expect(restored.document.objects.find((o:any)=>o.id==='gallery-wall')).toMatchObject({kind:'partition',modelAssetId:'gallery_wall'});
 });
});
