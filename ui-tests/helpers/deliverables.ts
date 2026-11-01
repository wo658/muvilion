import { expect, type Page } from '@playwright/test';
import { emptyPlan } from './assets';

/** Authored scene fixture. Captures use the application's real WebGL renderer. */
export const deliverableScene = {
  ...emptyPlan,
  source: { ...emptyPlan.source, name: '브랜드 공간 도면.png' },
  widthMeters: 18, heightMeters: 12,
  warnings: ['기획용 예시 · 실제 시공 치수는 현장 확인이 필요합니다.'],
  wallHeight: 3,
  zones: [
    { id: 'A1', label: 'A1 · Brand showcase', purpose: 'booth', assignable: true, x: .3, y: .35, width: 4, depth: 3, rotation: 0 },
    { id: 'A2', label: 'A2 · Partner experience', purpose: 'booth', assignable: true, x: .7, y: .35, width: 3, depth: 3, rotation: 0 },
  ],
  objects: [
    { id: 'brand-wall', kind: 'partition', label: '브랜드 전시 벽', x: .5, y: .3, width: 5, depth: .2, height: 2.8, rotation: 0, color: '#536a80' },
    { id: 'demo-counter', kind: 'furniture', label: '체험 안내대', x: .5, y: .5, width: 2, depth: 1, height: 1.2, rotation: 0, color: '#887766' },
  ],
};
export async function createDeliverableProject(page: Page, withBrand = false) {
  const response = await page.request.post('/api/projects', { data: {
    name: '브랜드 공간 기획 · 출력 회귀',
    state: {
      projectVersion: 1, document: deliverableScene, originalDrawingId: null,
      sources: { version: 1, drawingSelected: true, items: withBrand ? [{
        id: 'brand-fixture', kind: 'brand', selected: true, name: 'Muvilion Studio',
        url: 'https://example.com/brand', text: '', notes: '방문객이 체험하는 브랜드 공간', images: [],
      }] : [] },
    },
  } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
export async function openDeliverableProject(page: Page, id: string) {
  await page.goto(`/?project=${id}`);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Planning document', exact: true })).toBeVisible();
}
