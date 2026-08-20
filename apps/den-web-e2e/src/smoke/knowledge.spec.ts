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
  await page.getByRole('link', { name: 'Knowledge' }).click();
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
  await page.getByRole('link', { name: 'Knowledge' }).click();
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

test('shows a visible empty state when the global Knowledge list is empty', async ({ page }) => {
  await mockDenServices(page);
  await page.route('**/api/v1/knowledge/entries', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [], count: 0 }),
  }));

  await page.goto('/');
  await page.getByRole('link', { name: 'Knowledge' }).click();

  await expect(page.getByText('No knowledge entries')).toBeVisible();
  await expect(page.getByTestId('knowledge-list-item')).toHaveCount(0);
  await expect(page.getByText('Select a knowledge entry')).toBeVisible();
});

test('shows a visible error state for a list failure', async ({ page }) => {
  await mockDenServices(page);
  await page.route('**/api/v1/knowledge/entries', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Knowledge unavailable' }),
  }));

  await page.goto('/');
  await page.getByRole('link', { name: 'Knowledge' }).click();
  await expect(page.getByText(/server: .*Knowledge unavailable/)).toBeVisible();
  await expect(page.getByText('Select a knowledge entry')).toBeVisible();
});

test('shows a visible error state for an invalid detail response', async ({ page }) => {
  await mockDenServices(page);
  await page.route('**/api/v1/knowledge/entries/global-entry-long-body', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({}),
  }));
  await page.goto('/');
  await page.getByRole('link', { name: 'Knowledge' }).click();
  await page.getByRole('button', { name: /Global entry with long body global-entry-long-body/ }).click();

  await expect(page.getByText('invalid-response: Knowledge detail response is missing required fields.')).toBeVisible();
});

test('supports mobile Knowledge list, detail, and back navigation', async ({ page }) => {
  await mockDenServices(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Knowledge' }).click();

  const entry = page.getByRole('button', { name: /Global entry with long body global-entry-long-body/ });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.getByLabel('Knowledge detail').getByRole('heading', { name: 'Global entry with long body' })).toBeVisible();
  const back = page.getByRole('button', { name: 'Back to knowledge' });
  await expect(back).toBeVisible();
  await back.click();

  await expect(entry).toBeVisible();
  await expect(back).toBeHidden();
});
