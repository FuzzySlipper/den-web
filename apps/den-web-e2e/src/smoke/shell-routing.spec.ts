import { expect, test } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

test.use({ timezoneId: 'America/Los_Angeles' });

test('deep-links directly into a feature route', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/messages');

  await expect(page).toHaveURL(/\/messages$/);
  await expect(page.getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();

  await page.goto('/documents');
  await expect(page.getByRole('link', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
});

test('supports browser back and forward between sections', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByRole('link', { name: 'Documents' }).click();
  await expect(page).toHaveURL(/\/documents$/);
  await page.getByRole('link', { name: 'Knowledge' }).click();
  await expect(page).toHaveURL(/\/knowledge$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/documents$/);
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(page.getByRole('link', { name: 'Knowledge' })).toHaveAttribute('aria-current', 'page');
});

test('redirects unknown and empty URLs to tasks', async ({ page }) => {
  await mockDenServices(page);

  await page.goto('/definitely-not-a-section');
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page');

  await page.goto('/');
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
});

test('keeps the workspace list docked below the nav rail', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  const workspace = page.getByRole('complementary', { name: 'Workspace' });
  await expect(workspace.getByRole('button', { name: /Den Web den-web/ })).toBeVisible();
  await expect(workspace.getByRole('button', { name: /Asha Studio asha/ })).toBeVisible();

  await page.getByRole('link', { name: 'Documents' }).click();
  await expect(workspace.getByRole('button', { name: /Den Web den-web/ })).toBeVisible();
});
