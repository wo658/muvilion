import { expect, test } from '@playwright/test';

test('sample preparation stays cancellable and a late response cannot navigate', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('muvilion.settings.language.v1', 'en'));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/api/projects/samples', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [{ id: 'fixture', name: 'Cancellation sample', drawings: [{ name: 'Hall', file: 'venue/hall.png' }] }] });
      return;
    }
    requests++;
    if (requests === 1) await held;
    await route.fulfill({ status: 503, json: { error: 'Sample analysis unavailable in this test.' } }).catch(() => {});
  });
  await page.goto('/');
  const start = page.getByRole('heading', { name: 'How would you like to start?', exact: true });
  await expect(start.or(page.getByRole('button', { name: 'New project', exact: true })).first()).toBeVisible();
  if (!await start.isVisible()) await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: /Start with a sample/ }).click();
  await page.getByRole('button', { name: /Cancellation sample/ }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(page.getByText('Muse is reading the sample drawings. This may take a few minutes.', { exact: true })).toBeVisible();
  const before = page.url();
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
  await expect(page.getByText('Sample preparation cancelled.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start with an empty project', exact: true })).toBeEnabled();
  release();
  await expect(start).toBeVisible();
  await expect(page).toHaveURL(before);
  await page.getByRole('button', { name: /Cancellation sample/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Sample analysis unavailable in this test.' })).toBeVisible();
  expect(requests).toBe(2);
});
