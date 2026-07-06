import { expect, test } from '@playwright/test';
import { writeEvidencePacket } from './support/artifact-collector';
import { requireLiveRun } from './support/live-gate';

const featureTabs = ['Conversation', 'Notifications', 'Messages', 'Documents', 'Guidance', 'Librarian', 'Agents', 'Preferences'] as const;

test.describe('live inherited features', () => {
  requireLiveRun();

  for (const tab of featureTabs) {
    test(`${tab} renders inherited feature surface`, async ({ page }, testInfo) => {
      await page.goto('/');
      await page.getByRole('button', { name: tab }).click();
      await expect(page.getByRole('heading', { name: tab })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${tab.toLowerCase()}.png`), fullPage: true });
      await writeEvidencePacket(page, testInfo, {
        scenario: `feature-${tab.toLowerCase()}`,
        baseUrl: process.env['BASE_URL'] ?? '',
        milestones: [`${tab} tab rendered`, 'classified loading/error/data branch visible if backend is unavailable'],
        nonClaims: ['Does not prove deployed static service behavior.', 'Does not prove full backend data parity on local dev server.'],
      });
    });
  }
});
