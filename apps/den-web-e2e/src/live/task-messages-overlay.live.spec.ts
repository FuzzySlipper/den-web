import { expect } from '@playwright/test';
import { test } from '@playwright/test';
import { writeEvidencePacket } from './support/artifact-collector';
import { requireLiveRun } from './support/live-gate';

test.describe('live task messages overlay', () => {
  requireLiveRun();

  const projectId = process.env['TASK_MESSAGES_LIVE_PROJECT'] ?? '';
  const taskId = process.env['TASK_MESSAGES_LIVE_TASK_ID'] ?? '';

  test('shows the full task message window and opens a detail overlay', async ({ page }, testInfo) => {
    test.skip(!projectId || !taskId, 'TASK_MESSAGES_LIVE_PROJECT and TASK_MESSAGES_LIVE_TASK_ID are required');

    await page.setViewportSize({ width: 1280, height: 2400 });
    await page.goto('/');

    await page.locator('den-project-workspace-panel').getByRole('button', { name: new RegExp(projectId) }).click();
    await page.getByLabel('Task status filter').selectOption('__all');
    const taskRow = page.locator('.task-list .row').filter({ hasText: `#${taskId}` }).first();
    await expect(taskRow).toBeVisible();
    await taskRow.click();

    const recent = page.getByLabel('Recent messages');
    const messageRows = recent.locator('.message-reference');
    await expect(messageRows.first()).toBeVisible();
    const messageCount = await messageRows.count();
    await page.screenshot({ path: testInfo.outputPath('task-messages-list.png'), fullPage: true });

    await messageRows.first().click();
    const overlay = page.getByRole('dialog', { name: 'Task message' });
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(`Task #${taskId}`);
    await page.screenshot({ path: testInfo.outputPath('task-message-overlay.png'), fullPage: true });

    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);

    await messageRows.first().click();
    await expect(overlay).toBeVisible();
    await page.locator('.message-overlay-backdrop').click({ position: { x: 8, y: 8 } });
    await expect(overlay).toHaveCount(0);

    await writeEvidencePacket(page, testInfo, {
      scenario: 'task-messages-overlay',
      baseUrl: process.env['BASE_URL'] ?? '',
      milestones: [
        `project ${projectId} task #${taskId} renders ${messageCount} task messages, newest first, in a scrollable section`,
        'clicking the newest message opens an overlay labeled with the parent task',
        'escape closes the overlay',
        'backdrop click closes the overlay',
      ],
      nonClaims: [
        'Does not prove messages beyond the 100-item service window are reachable.',
        'Does not prove overlay behavior on mobile viewports.',
        'Observes the deployed den-srv instance; not a local-build claim.',
      ],
    });
  });
});
