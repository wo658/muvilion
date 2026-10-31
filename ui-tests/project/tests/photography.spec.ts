import { expect, test, type Page } from '@playwright/test';
import { emptyPlan } from '../../helpers/assets';

// Deterministic model-response fixture only. The real app renders every candidate;
// this regression does not measure live model composition quality.
const scene = {
  ...emptyPlan,
  source: { ...emptyPlan.source, name: '구도 수정 회귀용 비대칭 공간' },
  widthMeters: 18, heightMeters: 12,
  floorBoundary: [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],
  objects: [
    { id: 'exhibit', kind: 'furniture', label: '주요 전시대', x: .5, y: .5, width: 2.4, depth: 1.2, height: 1.2, rotation: 0, color: '#887766' },
    { id: 'backdrop', kind: 'partition', label: '전시 배경 가벽', x: .5, y: .36, width: 4, depth: .2, height: 2.8, rotation: 0, color: '#536a80' },
    { id: 'side-installation', kind: 'equipment', label: '측면 설치물', x: .7, y: .55, width: .8, depth: 1.2, height: 2, rotation: 0, color: '#765c45' },
  ],
};
const intent = {
  title: '전시대와 접근 동선', description: '전시대와 배경 가벽, 오른쪽 접근 공간을 함께 보여준다.',
  targetIds: ['exhibit', 'backdrop'], view: 'interior', azimuth: 45, elevation: 35, distanceScale: 1,
};
const baseShot = {
  id: 'initial-1', eye: [7, 1.65, 4], target: [0, 1.65, -.5], fov: 60, zoom: 1, aspect: 16 / 9,
  cutaway: false, ceilingMode: 'hidden', showStructure: true, showOverhead: true,
};
const initialShots = [[7, 1.65, 4], [8, 1.65, 3], [6, 1.65, 5], [8, 1.65, 5]].map((eye, i) => ({ ...baseShot, id: `initial-${i + 1}`, eye }));
const revisedIntent = { ...intent, azimuth: 135, description: '반대편에서 전시대와 측면 설치물 사이의 접근 공간을 드러낸다.' };
const revisedShots = [[-7, 1.65, 4], [-8, 1.65, 3], [-6, 1.65, 5], [-8, 1.65, 5]].map((eye, i) => ({ ...baseShot, id: `revised-${i + 1}`, eye }));
const revisionReason = '[모델 응답 fixture] 오른쪽 설치물이 접근 공간을 가리므로 반대편 앵글에서 다시 촬영합니다.';
const selectionReason = '[모델 응답 fixture] 다시 촬영한 첫 번째 앵글에서 전시대와 접근 공간이 함께 보입니다.';

type ReviewRequest = {
  phase: string; round: number; brief: string; intent: typeof intent; previousReviews?: unknown[];
  document: { preview: string }; candidates: { shot: typeof baseShot; image: string }[];
};
async function openScene(page: Page) {
  const response = await page.request.post('/api/projects', { data: {
    name: '모델 응답 fixture · 촬영 구도 회귀', state: {
      projectVersion: 1, document: scene, sources: { version: 1, drawingSelected: true, items: [] }, originalDrawingId: null,
    },
  } });
  expect(response.ok()).toBeTruthy();
  const project = await response.json();
  await page.goto(`/?project=${project.id}`);
  await expect(page.locator('canvas')).toBeVisible();
  const composer = page.getByRole('textbox', { name: 'Muse에게 도면에 관해 질문하기' });
  if (!await composer.isVisible()) await page.locator('button[aria-controls="muse-panel"][aria-expanded="false"]').click();
  await expect(composer).toBeVisible();
}
async function pixels(page: Page, image: string) {
  expect(image).toMatch(/^data:image\/(jpeg|png);base64,/);
  return page.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 72;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 128, 72);
    return { width: image.naturalWidth, height: image.naturalHeight, pixels: [...context.getImageData(0, 0, 128, 72).data] };
  }, image);
}

/** 모델 판단은 명시적인 fixture이며 후보·재촬영 이미지는 실제 3D 렌더러가 만든다. */
test('모델 응답 fixture · 구도 검토 후 다른 앵글로 재촬영하고 사용자가 미세조정한다', async ({ page }, info) => {
  const reviews: ReviewRequest[] = [];
  await test.step('비대칭 공간과 결정론적 모델 응답 fixture 준비', async () => {
    await openScene(page);
    await page.route('**/api/plans/intent', route => route.fulfill({ json: {
      intent: 'photography', brief: '전시대를 촬영해줘.', message: '촬영 앵글을 검토할게요.',
    } }));
    await page.route('**/api/plans/photography', route => {
      const body = route.request().postDataJSON();
      if (body.phase === 'plan') return route.fulfill({ json: { intent, candidates: initialShots } });
      reviews.push(body);
      return route.fulfill({ json: reviews.length === 1
        ? { action: 'revise', intent: revisedIntent, candidates: revisedShots, explanation: revisionReason }
        : { action: 'select', shotId: 'revised-1', explanation: selectionReason },
      });
    });
  });
  await test.step('채팅에서 촬영 요청 후 두 차례 이미지 검토 완료', async () => {
    await page.getByRole('textbox', { name: 'Muse에게 도면에 관해 질문하기' }).fill('전시대와 배경 가벽, 접근 동선을 함께 촬영해줘.');
    await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
    await expect(page.getByTestId('photography-panel').getByRole('img', { name: intent.title, exact: true })).toBeVisible({ timeout: 60000 });
    expect(reviews).toHaveLength(2);
    expect(reviews.map(review => review.round)).toEqual([0, 1]);
    // 라우터의 축약문이 아니라 사용자가 요청한 전체 촬영 목적을 끝까지 전달한다.
    expect(reviews[1].brief).toBe('전시대와 배경 가벽, 접근 동선을 함께 촬영해줘.');
    expect(reviews.map(review => review.candidates.length)).toEqual([4, 4]);
    expect(reviews[0].document.preview).toMatch(/^data:image\/png;base64,/);
    expect(reviews[1].candidates.map(candidate => candidate.shot.eye)).toEqual(revisedShots.map(shot => shot.eye));
    // 두 번째 검토는 처음의 의도와 수정 이유를 기억해야 한다.
    expect(JSON.stringify(reviews[1].previousReviews)).toContain(revisionReason);
    expect(JSON.stringify(reviews[1].previousReviews)).toContain(intent.description);
  });
  await test.step('실제 후보 이미지가 비어 있지 않고 수정 전후 구도가 달라졌는지 확인', async () => {
    const before = await pixels(page, reviews[0].candidates[0].image);
    const after = await pixels(page, reviews[1].candidates[0].image);
    expect(before.width / before.height).toBeCloseTo(16 / 9, 2);
    expect(after.width).toBeGreaterThanOrEqual(640);
    const colors = new Set(after.pixels.reduce<string[]>((values, _, i, all) => {
      if (i % 4 === 0) values.push(`${all[i]},${all[i + 1]},${all[i + 2]}`); return values;
    }, []));
    expect(colors.size).toBeGreaterThan(20);
    const changed = before.pixels.reduce((sum, value, i) => sum + Math.abs(value - after.pixels[i]), 0) / before.pixels.length;
    // 임의 ID 변경만으로는 통과하지 않는다. 픽셀 차이로 재렌더링을 확인한다.
    expect(changed).toBeGreaterThan(2);
    await info.attach('결정론적 회귀 / 모델 응답 fixture / 최초 실제 렌더', { body: Buffer.from(reviews[0].candidates[0].image.split(',')[1], 'base64'), contentType: 'image/jpeg' });
    await info.attach('결정론적 회귀 / 모델 응답 fixture / 수정 후 실제 렌더', { body: Buffer.from(reviews[1].candidates[0].image.split(',')[1], 'base64'), contentType: 'image/jpeg' });
  });
  const panel = page.getByTestId('photography-panel');
  await test.step('선택 후에도 수정 이유와 구도 검토 이력이 유지되는지 확인', async () => {
    await panel.getByText('구도 검토 기록', { exact: true }).click();
    const history = page.getByTestId('photography-review-history');
    await expect(history.getByText('앵글 수정 후 다시 촬영', { exact: true })).toBeVisible();
    await expect(history.getByText('사진 선택', { exact: true })).toBeVisible();
    await expect(history.getByText(revisionReason, { exact: true })).toBeVisible();
    await expect(history.getByRole('img')).toHaveCount(8);
  });
  await test.step('선택된 사진의 정확한 앵글 복원 후 미세조정하여 재촬영', async () => {
    const image = page.getByTestId('selected-photo');
    const selectedImage = await image.getAttribute('src');
    expect(selectedImage).toBe(reviews[1].candidates[0].image);
    await panel.getByText('앵글 미세조정', { exact: true }).click();
    await panel.getByText('카메라 상세', { exact: true }).click();
    const cameraDetails = panel.getByLabel('카메라 상세', { exact: true });
    await expect(cameraDetails).toContainText('"eye":[-7,1.65,4]');
    await panel.getByRole('button', { name: '오른쪽으로 회전', exact: true }).click();
    await expect(cameraDetails).not.toContainText('"eye":[-7,1.65,4]');
    await panel.getByRole('button', { name: '이 앵글로 이동', exact: true }).click();
    await expect(cameraDetails).toContainText('"eye":[-7,1.65,4]');
    await expect(cameraDetails).toContainText('"target":[0,1.65,-0.5]');
    await panel.getByRole('button', { name: '다시 촬영', exact: true }).click();
    await expect(image).toHaveAttribute('src', selectedImage!);
    await panel.getByRole('button', { name: '오른쪽으로 회전', exact: true }).click();
    await panel.getByRole('button', { name: '다시 촬영', exact: true }).click();
    await expect(image).not.toHaveAttribute('src', selectedImage!);
    // 사용자 조정은 모델을 다시 호출하지 않으며 구도 검토 기록을 보존한다.
    expect(reviews).toHaveLength(2);
    await expect(page.getByTestId('photography-review-history').getByText(revisionReason, { exact: true })).toBeVisible();
  });
});
