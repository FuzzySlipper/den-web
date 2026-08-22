import { expect } from '@playwright/test';
import { test } from '@playwright/test';
import { writeEvidencePacket } from './support/artifact-collector';
import { requireLiveRun } from './support/live-gate';

const SPACE_IDS = ['house', 'research', 'patch'] as const;

test.describe('live workspace spaces toggle', () => {
  requireLiveRun();

  test('hides spaces until show spaces is enabled', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 2400 });
    await page.goto('/');
    const panel = page.locator('den-project-workspace-panel');
    await expect(panel).toBeVisible();

    const showSpaces = panel.getByRole('checkbox', { name: 'Show spaces' });
    await expect(showSpaces).toBeVisible();
    await expect(showSpaces).not.toBeChecked();

    const itemIds = panel.locator('.workspace-list .item-id');
    await expect(itemIds.first()).toBeVisible();
    const defaultCount = await itemIds.count();
    await page.screenshot({ path: testInfo.outputPath('spaces-hidden-default.png'), fullPage: true });

    await showSpaces.check();
    await expect(showSpaces).toBeChecked();
    for (const spaceId of SPACE_IDS) {
      await expect(itemIds.filter({ hasText: spaceId }).first()).toBeVisible();
    }
    const expandedCount = defaultCount + SPACE_IDS.length;
    await expect(itemIds).toHaveCount(expandedCount);
    await page.screenshot({ path: testInfo.outputPath('spaces-shown.png'), fullPage: true });

    await showSpaces.uncheck();
    await expect(showSpaces).not.toBeChecked();
    await expect(itemIds).toHaveCount(defaultCount);
    for (const spaceId of SPACE_IDS) {
      await expect(itemIds.filter({ hasText: spaceId })).toHaveCount(0);
    }
    await page.screenshot({ path: testInfo.outputPath('spaces-hidden-again.png'), fullPage: true });

    await writeEvidencePacket(page, testInfo, {
      scenario: 'workspace-spaces-toggle',
      baseUrl: process.env['BASE_URL'] ?? '',
      milestones: [
        'workspace panel renders with show spaces unchecked',
        `default list (${defaultCount} items) omits house/research/patch`,
        `checking show spaces reveals them (${expandedCount} items)`,
        'unchecking restores the default list',
      ],
      nonClaims: [
        'Does not prove archived and hidden visibility toggling.',
        'Does not prove workspace selection scoping in other features.',
        'Runs the local successor dev server against a remote edge; not deploy evidence.',
      ],
    });
  });
});
