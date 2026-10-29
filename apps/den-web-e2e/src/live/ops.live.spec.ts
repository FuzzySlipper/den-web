import { expect, test } from '@playwright/test';
import { writeEvidencePacket } from './support/artifact-collector';
import { requireLiveRun } from './support/live-gate';

test.describe('live operations', () => {
  requireLiveRun();

  test('Operations renders real backup status from /api/v1/ops', async ({ page }, testInfo) => {
    const opsResponses: string[] = [];
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/v1/ops/')) opsResponses.push(`${response.status()} ${url.pathname}${url.search}`);
    });

    await page.goto('/');
    await page.getByRole('link', { name: 'Operations' }).click();
    const ops = page.getByRole('region', { name: 'Operations' });
    await expect(ops.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await expect(ops.getByTestId('ops-overall').or(ops.getByRole('alert'))).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('ops-live-overview.png'), fullPage: true });

    // The live ledger has at least the registered den-agents-git job.
    const jobs = ops.getByTestId('ops-job');
    await expect(jobs.first()).toBeVisible();
    const first = jobs.first();
    const firstStatus = await first.getByTestId('ops-job-status').innerText();
    await first.getByRole('button', { name: 'Show history' }).click();
    const history = first.getByTestId('ops-history');
    await expect(history.getByRole('table').first()).toBeVisible();
    await history.scrollIntoViewIfNeeded();
    await history.screenshot({ path: testInfo.outputPath('ops-live-history.png') });
    const milestones = [
      'Operations route rendered',
      `ops responses: ${opsResponses.join(', ') || 'none'}`,
      `${await jobs.count()} job card(s) rendered; first job status: ${firstStatus}`,
      'history table rendered for first job',
    ];

    await writeEvidencePacket(page, testInfo, {
      scenario: 'operations-backups',
      baseUrl: process.env['BASE_URL'] ?? '',
      milestones,
      nonClaims: [
        'Does not prove that any backup ran; it shows what Ops has recorded.',
        'Failure, overdue and unreachable rendering are covered by the mocked smoke spec, not this live run.',
      ],
    });
  });
});
