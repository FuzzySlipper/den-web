import { expect, test } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

test('backlog is hidden from Active and searchable in All', async ({ page }, testInfo) => {
  await mockDenServices(page);
  const backlog = { id: 9991, project_id: 'den-web', title: 'Deferred backlog work', status: 'backlog', priority: 2, parent_id: null };
  await page.route('**/api/v1/projects/den-web/tasks?**', route => route.fulfill({ json: [backlog] }));
  await page.route('**/api/v1/projects/den-web/tasks/9991', route => route.fulfill({ json: { task: backlog, dependencies: [], subtasks: [], recent_messages: [] } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
  const row = page.getByRole('button', { name: /#9991 Deferred backlog work/ });
  await expect(row).toHaveCount(0);
  await page.getByLabel('Task status filter').selectOption('__all');
  await page.getByLabel('Search tasks').fill('Deferred backlog');
  await expect(row).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('backlog-all.png'), fullPage: true });
  await page.getByLabel('Task status filter').selectOption('backlog');
  await expect(row).toBeVisible();
  await page.getByLabel('Task status filter').selectOption('active');
  await expect(row).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('backlog-active.png'), fullPage: true });
});
