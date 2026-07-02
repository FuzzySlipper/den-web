import { expect } from '@playwright/test';
import { test } from '@playwright/test';
import { writeEvidencePacket } from './support/artifact-collector';
import { requireLiveRun } from './support/live-gate';

test.describe('live boot', () => {
  requireLiveRun();

  test('writes evidence packet', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Den Web' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('boot.png'), fullPage: true });

    await writeEvidencePacket(page, testInfo, {
      scenario: 'boot',
      baseUrl: process.env['BASE_URL'] ?? '',
      milestones: ['root route loaded', 'successor cockpit heading visible'],
      nonClaims: ['Does not prove task data loaded.', 'Does not prove deployed static service behavior.'],
    });
  });
});
