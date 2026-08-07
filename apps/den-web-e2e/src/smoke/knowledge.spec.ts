import { expect, test } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

test('renders global Knowledge and keeps it independent from workspace selection', async ({ page }, testInfo) => {
  const listRequests: string[] = [];
  const detailRequests: string[] = [];
  await mockDenServices(page);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/knowledge/entries') listRequests.push(request.url());
    if (url.pathname.startsWith('/api/v1/knowledge/entries/')) detailRequests.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Knowledge' }).click();
  await expect(page.getByRole('heading', { name: 'Knowledge' })).toBeVisible();
  await expect(page.getByTestId('knowledge-list-item')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Successor boundaries successor-boundaries/ })).toBeVisible();

  await page.getByRole('button', { name: /Global entry with long body global-entry-long-body/ }).click();
  await expect(page.getByLabel('Knowledge detail').getByRole('heading', { name: 'Global entry with long body' })).toBeVisible();
  await expect(page.getByText('Knowledge detail bottom sentinel.')).toBeVisible();

  const listRequestCount = listRequests.length;
  const detailRequestCount = detailRequests.length;
  await page.getByRole('button', { name: /Asha Studio asha/ }).click();

  await expect(page.getByLabel('Knowledge detail').getByRole('heading', { name: 'Global entry with long body' })).toBeVisible();
  expect(listRequests).toHaveLength(listRequestCount);
  expect(detailRequests).toHaveLength(detailRequestCount);
  expect(listRequests.every((url) => !url.includes('project_id'))).toBe(true);
  expect(detailRequests.every((url) => !url.includes('project_id'))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('knowledge-global-after-project-switch.png'), fullPage: true });
});

test('keeps long Knowledge detail content inside the responsive detail panel', async ({ page }) => {
  await mockDenServices(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Knowledge' }).click();
  await page.getByRole('button', { name: /Global entry with long body global-entry-long-body/ }).click();

  const detailBody = page.getByLabel('Knowledge detail').locator('.detail-body');
  await expect(async () => {
    const metrics = await detailBody.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + 300);
  }).toPass();
});
