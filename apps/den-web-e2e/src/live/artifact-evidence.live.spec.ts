import { expect, test } from '@playwright/test';
import { writeEvidencePacket } from './support/artifact-collector';
import { requireLiveRun } from './support/live-gate';

const artifactTaskId = process.env['ARTIFACT_EVIDENCE_TASK_ID'] ?? '3480';
const artifactLogicalName = 'den-web-artifact-evidence-live-proof.png';
const artifactSha256 = '1801ae0e406e38b58696ed505a01ae4295e17e33f4511e6862141484e7820889';

test.describe('live artifact evidence', () => {
  requireLiveRun();

  test('renders a ref-only Den artifact thumbnail and full-size viewer', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Den Web den-web/ }).click();
    await page.getByLabel('Search tasks').fill(artifactTaskId);
    await page.getByRole('button', { name: new RegExp(`#${artifactTaskId}\\b`) }).click();

    await expect(page.getByLabel('Task detail').getByRole('heading', {
      name: new RegExp(`#${artifactTaskId}\\b`),
    })).toBeVisible();

    const evidence = page.getByLabel('Artifact evidence');
    await expect(evidence.getByText(artifactLogicalName)).toBeVisible();
    await expect(evidence.getByText('image/png', { exact: true })).toBeVisible();
    await expect(evidence.getByText('860.3 KiB', { exact: true })).toBeVisible();
    await expect(evidence.getByText('1440 x 5895', { exact: true })).toBeVisible();
    await expect(evidence.getByText(artifactSha256, { exact: true })).toBeVisible();
    await expect(evidence.getByText('normal', { exact: true })).toBeVisible();
    await expect(evidence.getByText('retained', { exact: true })).toBeVisible();

    const thumbnail = evidence.getByRole('img', { name: artifactLogicalName });
    await expect(thumbnail).toHaveAttribute(
      'src',
      /^\/api\/v1\/artifacts\/art_[a-z0-9]+\/content$/,
    );
    await expect.poll(async () => thumbnail.evaluate((image: HTMLImageElement) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }))).toEqual({ complete: true, naturalWidth: 1440, naturalHeight: 5895 });

    await evidence.getByRole('button', { name: `Open artifact ${artifactLogicalName}` }).click();
    const viewer = page.getByRole('dialog', { name: 'Artifact preview' });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('img', { name: artifactLogicalName })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('artifact-evidence-full-size.png'),
      fullPage: true,
    });

    await writeEvidencePacket(page, testInfo, {
      scenario: 'artifact-evidence',
      baseUrl: process.env['BASE_URL'] ?? '',
      milestones: [
        `task ${artifactTaskId} loaded`,
        'artifact metadata rendered from a den-artifact ref',
        'artifact content loaded through the same-origin content endpoint',
        'full-size viewer opened',
      ],
      nonClaims: [
        'Does not prove sensitive-artifact authorization policy.',
        'Does not prove deleted-artifact rendering.',
      ],
    });
  });
});
