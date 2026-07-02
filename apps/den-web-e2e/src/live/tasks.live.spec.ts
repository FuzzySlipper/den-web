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
});
