import { expect, test } from '@playwright/test';
import { emptyPlan, exportPlan, importPlan } from '../../helpers/assets';

// Model responses are fixtures; routing, rendering, input and approval use the real app.
test('Muse preserves intent routing, IME input, cancellation and bilingual Markdown UI', async ({ page }) => {
  const created = await page.request.post('/api/projects', { data: { name: 'Muse UI regression' } });
  expect(created.ok()).toBeTruthy();
  const project = await created.json();
  await page.goto(`/?project=${project.id}`);
  const input = page.getByRole('textbox', { name: 'Muse에게 도면에 관해 질문하기' });
  let calls = 0;
  await page.route('**/api/plans/intent', async route => {
    calls++;
    expect(route.request().postDataJSON().locale).toBe('ko');
    await route.fulfill({ json: { intent: 'clarify', message: '**검토 결과**\n\n- 동선 확인\n\n`폭` [문서](https://example.com)', brief: '' } });
  });
  await input.fill('동선을 검토해줘');
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true });
  await input.press('Shift+Enter');
  expect(calls).toBe(0);
  await input.press('Enter');
  await expect(page.locator('[data-streamdown="strong"]')).toHaveText('검토 결과');
  await expect(page.getByRole('link', { name: '문서', exact: true })).toHaveAttribute('href', 'https://example.com/');
  expect(calls).toBe(1);
  const colors = await page.locator('[data-streamdown="inline-code"]').evaluate(el => {
    const sample = document.createElement('div'); sample.style.background = 'var(--sunken)'; el.append(sample);
    const expected = getComputedStyle(sample).backgroundColor; sample.remove();
    return { actual: getComputedStyle(el).backgroundColor, expected };
  });
  expect(colors.actual).toBe(colors.expected);
  await page.unroute('**/api/plans/intent');
  await page.route('**/api/plans/intent', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({ json: { intent: 'clarify', message: '늦은 응답', brief: '' } });
  });
  await input.fill('중지할 요청');
  await input.press('Enter');
  await page.getByRole('button', { name: '중지', exact: true }).click();
  await expect(input).toHaveValue('중지할 요청');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.locator('#app-language').selectOption('en');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Ask Muse about your drawing' })).toHaveValue('중지할 요청');
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
  await page.unroute('**/api/plans/intent');
  await page.route('**/api/plans/intent', route => route.fulfill({ json: { intent: 'chat', message: 'Reviewing', brief: '' } }));
  await page.route('**/api/plans/chat', route => {
    expect(route.request().postDataJSON().locale).toBe('en');
    const chunks = [
      { type: 'start', messageId: 'stream-test' },
      { type: 'text-start', id: 'text' },
      { type: 'text-delta', id: 'text', delta: Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1} of the response.\n\n`).join('') },
      { type: 'text-end', id: 'text' },
      { type: 'finish', finishReason: 'stop' },
    ];
    return route.fulfill({ contentType: 'text/event-stream', headers: { 'x-vercel-ai-ui-message-stream': 'v1' }, body: chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n' });
  });
  await page.getByRole('textbox').fill('Review the plan');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Paragraph 60 of the response.', { exact: true })).toBeVisible();
  const scroll = page.getByRole('log').locator(':scope > div').first();
  await scroll.hover();
  await page.mouse.wheel(0, -2000);
  const latest = page.getByRole('button', { name: 'Scroll to latest message', exact: true });
  await expect(latest).toBeVisible();
  await latest.click();
  await expect(latest).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('textbox')).toBeInViewport();
});

test('AI Elements composer preserves explicit proposal approval and source access', async ({ page }) => {
  await importPlan(page);
  await page.route('**/api/plans/intent', route => route.fulfill({ json: { intent: 'design', brief: '공간 제안', message: '배치를 제안합니다.' } }));
  await page.route('**/api/plans/design', route => route.fulfill({ json: { document: { ...emptyPlan, objects: [{ id: 'chair', kind: 'furniture', label: '새 의자', x: .5, y: .5, width: 1, depth: 1, height: 1, rotation: 0, color: "#887766" }] }, summary: '새 의자 제안' } }));
  await page.getByRole('textbox', { name: 'Muse에게 도면에 관해 질문하기' }).fill('공간 제안');
  await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeEnabled();
  expect((await exportPlan(page)).document.objects).toEqual([]);
  await page.getByRole('button', { name: '변경 적용', exact: true }).click();
  expect((await exportPlan(page)).document.objects[0].label).toBe('새 의자');
  await page.getByRole('button', { name: '자료 추가', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
