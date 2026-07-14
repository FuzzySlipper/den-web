import { expect, test } from '@playwright/test';
import { writeEvidencePacket } from './support/artifact-collector';
import { requireLiveRun } from './support/live-gate';

test.describe('live project tasks', () => {
  requireLiveRun();

  test('records workspace and task cockpit evidence', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Den Web' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('project-tasks.png'), fullPage: true });

    await writeEvidencePacket(page, testInfo, {
      scenario: 'project-tasks',
      baseUrl: process.env['BASE_URL'] ?? '',
      milestones: ['root route loaded', 'workspace and task cockpit rendered'],
      nonClaims: ['Does not prove a specific project contained task rows.', 'Does not prove static service cutover behavior.'],
    });
  });

  test('records compact desktop task layout evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 720 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();

    const bounds = await page.locator('.task-list').evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const controls = Array.from(element.querySelectorAll('.toolbar > *'));
      return {
        panelRight: panel.right,
        controlsRight: Math.max(...controls.map((control) => control.getBoundingClientRect().right)),
      };
    });
    expect(bounds.controlsRight).toBeLessThanOrEqual(bounds.panelRight + 0.5);

    await page.screenshot({ path: testInfo.outputPath('project-tasks-compact-1100.png'), fullPage: true });
    await writeEvidencePacket(page, testInfo, {
      scenario: 'project-tasks-compact-layout',
      baseUrl: process.env['BASE_URL'] ?? '',
      milestones: ['task cockpit rendered at 1100px', 'task controls remained inside the list panel'],
      nonClaims: ['Does not prove every compact desktop width.', 'Does not prove deployed static service behavior.'],
    });
  });
});
