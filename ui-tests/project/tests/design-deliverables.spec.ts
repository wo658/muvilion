import { expect, test } from '@playwright/test';
import { captureDeliverable, createDeliverableProject, openDeliverableProject } from '../../helpers/deliverables';
import { emptyPlan } from '../../helpers/assets';

// UI and storage are real; this scenario needs no model response or external brand fetch.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('muvilion.settings.language.v1', 'en'));
});

/** 브랜드 자료를 저장한 공간을 실제 렌더로 캡처하고 동일 스냅샷의 PDF 기획서를 출력한다. */
test('역할 구분 없는 공간에서 브랜드 자료와 3D 캡처를 PDF 기획서로 연결한다', async ({ page, context }, info) => {
  test.setTimeout(180000);
  let id = '';
  const brandNotes = '차분한 전시 공간 <script>window.brandInjected=true</script> & 브랜드 체험';
  await test.step('도면 프로젝트를 열고 역할 전환 없이 자료에 접근한다', async () => {
    const project = await createDeliverableProject(page); id = project.id;
    await openDeliverableProject(page, id);
    await expect(page.getByRole('button', { name: /organizer|participant|Booth pricing|applications/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Project settings', exact: true }).click();
    await page.getByRole('button', { name: 'Sources', exact: true }).click();
  });
  await test.step('브랜드 링크와 노트를 실제 자료 폼에 추가하고 저장한다', async () => {
    const sources = page.getByRole('dialog', { name: 'Sources', exact: true });
    await sources.getByRole('button', { name: 'Add source', exact: true }).click();
    await sources.getByRole('button', { name: '＋ Brand URL', exact: true }).click();
    await sources.getByLabel('Brand URL', { exact: true }).fill('https://example.com/brand');
    await sources.getByLabel('Brand name', { exact: true }).fill('출력 검증 브랜드');
    await sources.getByLabel('Brand notes', { exact: true }).fill(brandNotes);
    await sources.getByRole('button', { name: 'Add brand', exact: true }).click();
    await expect(sources.getByRole('button', { name: /^출력 검증 브랜드/ })).toBeVisible();
    await sources.getByRole('button', { name: 'Add source', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await sources.getByRole('button', { name: '＋ Concept image', exact: true }).click();
    await (await chooser).setFiles({ name: '브랜드 로고.png', mimeType: 'image/png', buffer: Buffer.from(emptyPlan.preview.split(',')[1], 'base64') });
    await expect(sources.getByRole('button', { name: /^브랜드 로고.png/ })).toBeVisible();
    await sources.getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(async () => {
      const stored = await (await page.request.get(`/api/projects/${id}`)).json();
      return { notes: stored.state.sources.items[0]?.notes, original: Boolean(stored.state.sources.items[1]?.originalAssetId) };
    }).toEqual({ notes: brandNotes, original: true });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Capture · PDF', exact: true })).toBeVisible();
  });
  await test.step('현재 3D 구도를 캡처하고 비어 있지 않은 JPEG를 내려받는다', async () => {
    const panel = await captureDeliverable(page);
    const image = await page.getByTestId('deliverable-capture').getAttribute('src');
    expect(image).toMatch(/^data:image\/jpeg;base64,/);
    const evidence = await page.evaluate(async src => {
      const image = new Image(); image.src = src!; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 72;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0, 128, 72);
      const data = ctx.getImageData(0, 0, 128, 72).data;
      const colors = new Set<string>();
      for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return { width: image.naturalWidth, height: image.naturalHeight, colors: colors.size };
    }, image);
    expect(evidence.width).toBe(1280); expect(evidence.height).toBe(720); expect(evidence.colors).toBeGreaterThan(20);
    const downloaded = page.waitForEvent('download');
    await panel.getByRole('link', { name: 'Download capture', exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toMatch(/\.jpg$/);
    const stream = await download.createReadStream(); const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    await panel.getByLabel('Report title', { exact: true }).fill('브랜드 공간 기획서 — 한글 출력');
    await panel.getByLabel('Design intent', { exact: true }).fill('체험 안내대와 브랜드 전시 벽을 함께 보여주는 공간입니다.');
  });
  await test.step('동일 캡처와 브랜드 노트가 있는 안전한 인쇄 문서를 PDF로 만든다', async () => {
    // Headless Chromium has no OS print dialog; page.pdf exercises the browser PDF engine.
    const popupEvent = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Open planning PDF', exact: true }).click();
    const report = await popupEvent;
    await expect(report.getByRole('heading', { name: '브랜드 공간 기획서 — 한글 출력', exact: true })).toBeVisible();
    await expect(report.locator('body')).toContainText(brandNotes);
    await expect(report.locator('body')).toContainText('체험 안내대와 브랜드 전시 벽을 함께 보여주는 공간입니다.');
    await expect(report.locator('body')).toContainText('브랜드 공간 도면.png');
    await expect(report.locator('body')).toContainText('브랜드 로고.png');
    await expect(report.locator('script')).toHaveCount(0);
    await expect(report.locator('body')).toHaveAttribute('data-report-snapshot', /.+/);
    await report.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    const selected = await page.getByTestId('deliverable-capture').getAttribute('src');
    expect(await report.locator('img').evaluateAll(images => images.map(image => (image as HTMLImageElement).src))).toContain(selected);
    const pdf = await report.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10000);
    await info.attach('기획서 PDF · 실제 브라우저 출력', { body: pdf, contentType: 'application/pdf' });
    // Re-import through the real extraction service: visible HTML alone cannot prove PDF text survived.
    const imported = await page.request.post('/api/sources/pdf', {
      multipart: { file: { name: 'planning-report.pdf', mimeType: 'application/pdf', buffer: pdf } },
      timeout: 150000,
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const extracted = await imported.json();
    const text = extracted.text.replace(/\s+/g, '');
    expect(text).toContain('브랜드공간기획서—한글출력');
    expect(text).toContain('체험안내대와브랜드전시벽을함께보여주는공간입니다.');
    expect(extracted.previews.length).toBeGreaterThan(0);
    await report.close();
  });
  await test.step('브랜드 자료 수정 후 이전 캡처로 새 기획서를 출력하지 않는다', async () => {
    await page.getByRole('button', { name: 'Project settings', exact: true }).click();
    await page.getByRole('button', { name: 'Sources', exact: true }).click();
    const sources = page.getByRole('dialog', { name: 'Sources', exact: true });
    await sources.getByRole('button', { name: /^출력 검증 브랜드/ }).click();
    const preview = page.getByRole('dialog', { name: '출력 검증 브랜드', exact: true });
    await preview.getByLabel('Notes for Muse', { exact: true }).fill('새 브랜드 방향 · 이전 캡처 이후 변경');
    await preview.getByRole('button', { name: 'Close source preview', exact: true }).click();
    await sources.getByRole('button', { name: 'Close', exact: true }).click();
    if (!await page.getByTestId('deliverables-panel').isVisible())
      await page.getByRole('button', { name: 'Capture · PDF', exact: true }).click();
    await expect(page.getByTestId('deliverable-capture')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open planning PDF', exact: true })).toBeDisabled();
  });
});

/** 작은 화면에서도 출력 패널을 닫고 같은 도면의 편집을 계속할 수 있다. */
test('모바일에서 출력 패널과 한국어 화면이 키보드로 닫히고 가로로 넘치지 않는다', async ({ page }) => {
  const project = await createDeliverableProject(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await openDeliverableProject(page, project.id);
  const trigger = page.getByRole('button', { name: 'Capture · PDF', exact: true });
  await trigger.click();
  await expect(page.getByTestId('deliverables-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('deliverables-panel')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#app-language').selectOption('ko');
  await page.getByRole('dialog', { name: '설정', exact: true }).getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
});


/** 촬영 의도와 선택 응답만 fixture이며, 전환과 캡처는 실제 앱에서 실행한다. */
test('수동 출력 패널을 연 상태에서 AI 촬영 요청이 같은 3D 뷰를 인계받는다', async ({ page }) => {
  test.setTimeout(90000);
  const project = await createDeliverableProject(page, true);
  const intent = { title: 'Brand display', description: 'The brand wall and demonstration counter.', targetIds: ['brand-wall', 'demo-counter'], view: 'interior', azimuth: 45, elevation: 35, distanceScale: 1 };
  const shot = { id: 'handoff-shot', eye: [7, 1.65, 4], target: [0, 1.65, -1], fov: 60, zoom: 1, aspect: 16 / 9, cutaway: false, ceilingMode: 'hidden', showStructure: true, showOverhead: true };
  let reviewedImage = '';
  await test.step('실제 도면에서 수동 출력 패널을 연다', async () => {
    await openDeliverableProject(page, project.id);
    await page.getByRole('button', { name: 'Capture · PDF', exact: true }).click();
    await expect(page.getByTestId('deliverables-panel')).toBeVisible();
    await page.route('**/api/plans/intent', route => route.fulfill({ json: { intent: 'photography', brief: 'Photograph the brand display.', message: 'Preparing a photograph.' } }));
    await page.route('**/api/plans/photography', route => {
      const body = route.request().postDataJSON();
      if (body.phase === 'plan') return route.fulfill({ json: { intent, candidates: [shot] } });
      reviewedImage = body.candidates[0].image;
      return route.fulfill({ json: { action: 'select', shotId: shot.id, explanation: '[Model-response fixture] Brand wall and counter are visible.' } });
    });
  });
  await test.step('채팅 촬영 요청이 수동 패널을 닫고 실제 후보 이미지를 검토한다', async () => {
    const input = page.getByRole('textbox', { name: 'Ask Muse about your drawing', exact: true });
    if (!await input.isVisible()) await page.locator('button[aria-controls="muse-panel"][aria-expanded="false"]').click();
    await input.fill('Photograph the brand display.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByTestId('deliverables-panel')).toHaveCount(0);
    await expect(page.getByTestId('selected-photo')).toBeVisible({ timeout: 60000 });
    expect(reviewedImage).toMatch(/^data:image\/jpeg;base64,/);
    await expect(page.getByTestId('selected-photo')).toHaveAttribute('src', reviewedImage);
  });
  await test.step('AI 촬영을 닫아도 이전 수동 출력 패널이 되살아나지 않는다', async () => {
    await page.getByTestId('photography-panel').getByRole('button', { name: 'Close photography', exact: true }).click();
    await expect(page.getByTestId('photography-panel')).toHaveCount(0);
    await expect(page.getByTestId('deliverables-panel')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Capture · PDF', exact: true })).toHaveAttribute('aria-expanded', 'false');
  });
});
