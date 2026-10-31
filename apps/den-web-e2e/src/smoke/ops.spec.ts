import { expect, test, type Page } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

function run(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    job_id: 'den-agents-git', run_id: '20261028T212037-2462905', host: 'den-agents', kind: 'backup', engine: 'borg',
    runner: 'borgmatic', state: 'success', terminal: true, phase: 'create', started_at: minutesAgo(600),
    updated_at: minutesAgo(593), finished_at: minutesAgo(593), exit_code: 0, error: '', reason: '', warnings: [], notices: [],
    target: '/mnt/storage/backup/den-agents/borg', archive_id: 'e7f64bce', archive_name: 'den-agents-git-2026-10-29T04-24-43',
    original_bytes: 283373557310, compressed_bytes: 194479790574, deduplicated_bytes: 132660210, file_count: 1020550,
    duration_seconds: 424, complete: true, log_path: '', manifest_path: '', run_directory: '/home/agent/.local/state/den-agents-backup/runs/x',
    recovery_pointer: '', received_at: minutesAgo(593), report_count: 1, ...overrides,
  };
}

function job(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const success = run();
  return {
    job_id: 'den-agents-git', host_id: 'den-agents', display_name: 'den-agents Git projects', engine: 'borg', kind: 'backup',
    source: 'den-agents:/home/agent,/data', scope: 'Git repositories', target: 'den-nas:/mnt/storage/backup/den-agents/borg',
    schedule: { timezone: 'America/Los_Angeles', times: ['07:00'], weekdays: [], grace_seconds: 10800 },
    heartbeat_stale_after_seconds: 600, retention: '30 daily, 12 weekly, 12 monthly, 3 yearly',
    recovery_pointer: 'den-nas:/mnt/storage/backup/den-agents/recovery/', notes: '', registered: true, enabled: true,
    status: 'ok', status_reason: 'latest finished run 20261028T212037-2462905 succeeded', freshness: 'fresh',
    expected_by: minutesAgo(60), next_due_at: new Date(Date.now() + 3_600_000).toISOString(), evaluated_at: minutesAgo(0),
    current_run: null, heartbeat_state: null, heartbeat_age_seconds: null, last_attempt: success, last_finished: success,
    last_success: success, last_archive: success,
    last_verification: null,
    last_restore_test: { job_id: 'den-agents-git', verification_id: 'restore-1', run_id: '', kind: 'restore_test', check_type: '', state: 'success', at: minutesAgo(590), scope: 'real den-services project', archive: 'den-agents-git-2026-10-29T04-24-43', full_data_read: null, evidence_path: '/restore', checked: [], received_at: minutesAgo(590) },
    ...overrides,
  };
}

const failedRun = run({ job_id: 'den-nas-config', run_id: 'nas-2', state: 'failed', complete: false, archive_name: '', archive_id: '', deduplicated_bytes: null, error: 'Failed to acquire /run/lock/snapraid-maintenance.lock', exit_code: 2, started_at: minutesAgo(90) });
const summary = {
  generated_at: minutesAgo(0),
  status: 'failed',
  counts: { failed: 1, overdue: 1, ok: 1 },
  hosts: [
    { host_id: 'den-agents', display_name: 'den-agents', role: 'agent workstation VM', notes: '', registered: true, coverage: 'configured', job_count: 1, status: 'ok' },
    { host_id: 'den-nas', display_name: 'den-nas', role: 'NAS', notes: '', registered: true, coverage: 'configured', job_count: 2, status: 'failed' },
    { host_id: 'den-win11', display_name: 'den-win11', role: 'Windows test box', notes: '', registered: true, coverage: 'not_configured', job_count: 0, status: 'unknown' },
  ],
  jobs: [
    job(),
    job({ job_id: 'den-nas-config', host_id: 'den-nas', display_name: 'den-nas configuration', notes: 'B2 bucket held 27.59 GB as observed at 2026-10-30T10:40:57Z.', status: 'failed', status_reason: 'latest finished run nas-2 failed', last_attempt: failedRun, last_finished: failedRun }),
    job({ job_id: 'snapraid-sync', host_id: 'den-nas', display_name: 'SnapRAID sync', engine: 'snapraid', kind: 'maintenance', status: 'overdue', freshness: 'overdue', status_reason: 'no run started for the slot due by 2026-10-29T18:00:00Z', last_restore_test: null }),
  ],
};
const detail = { job: job(), runs: [run(), run({ run_id: '20261028T194755-2050010', state: 'warning', complete: false, warnings: ['Could not inspect Git dependencies'] })], verifications: [] };

async function mockOps(page: Page, summaryStatus: () => number = () => 200): Promise<void> {
  await mockDenServices(page);
  await page.route('**/api/v1/ops/summary', (route) => {
    const status = summaryStatus();
    return status === 200
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(summary) })
      : route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: 'bad_gateway', message: 'ops upstream unavailable' } }) });
  });
  await page.route('**/api/v1/ops/jobs/den-agents-git?**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(detail) }));
}

test('Operations shows failures, overdue jobs, uncovered machines and history', async ({ page }, testInfo) => {
  await mockOps(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Operations' }).click();
  await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
  await expect(page.getByTestId('ops-overall')).toHaveText('Failed');

  const jobs = page.getByTestId('ops-job');
  await expect(jobs).toHaveCount(3);
  await expect(jobs.nth(0).getByTestId('ops-job-status')).toHaveText('Failed');
  await expect(jobs.nth(1).getByTestId('ops-job-status')).toHaveText('Overdue');
  await expect(jobs.nth(2).getByTestId('ops-job-status')).toHaveText('OK');

  const failed = page.getByRole('article', { name: 'den-nas configuration' });
  await expect(failed.getByText('Failed to acquire /run/lock/snapraid-maintenance.lock')).toBeVisible();
  await expect(failed.getByText('den-agents-git-2026-10-29T04-24-43').first()).toBeVisible();
  await expect(failed.getByTestId('ops-job-notes')).toContainText('27.59 GB as observed at 2026-10-30T10:40:57Z');
  await expect(page.getByRole('article', { name: 'SnapRAID sync' }).getByTestId('ops-job-notes')).toHaveCount(0);
  await expect(page.getByTestId('ops-host').filter({ hasText: 'den-win11' })).toContainText('Not configured · No backup tracked');

  const healthy = page.getByRole('article', { name: 'den-agents Git projects' });
  await expect(healthy.getByText('126.5 MiB new')).toBeVisible();
  await healthy.getByRole('button', { name: 'Show history' }).click();
  await expect(healthy.getByTestId('ops-history').getByRole('row')).toHaveCount(3);
  await expect(healthy.getByTestId('ops-history')).toContainText('Could not inspect Git dependencies');
  await page.screenshot({ path: testInfo.outputPath('ops-overview.png'), fullPage: true });
});

test('Operations says protection is unknown when Ops cannot be reached', async ({ page }, testInfo) => {
  await mockOps(page, () => 502);
  await page.goto('/ops');
  await expect(page.getByRole('alert')).toContainText('Could not load backup status');
  await expect(page.getByRole('alert')).toContainText('Backup protection is unknown');
  await expect(page.getByTestId('ops-job')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('ops-unavailable.png'), fullPage: true });
});

test('a failed refresh keeps the last status but drops the green', async ({ page }, testInfo) => {
  let fail = false;
  await mockOps(page, () => (fail ? 503 : 200));
  await page.goto('/ops');
  const okPill = page.getByRole('article', { name: 'den-agents Git projects' }).getByTestId('ops-job-status');
  await expect(okPill).toHaveClass(/tone-ok/);
  fail = true;
  const ops = page.getByRole('region', { name: 'Operations' });
  await ops.getByRole('button', { name: 'Refresh backup status' }).click();
  await expect(ops.getByRole('status')).toContainText('current protection is unknown');
  await expect(okPill).toHaveClass(/tone-muted/);
  await expect(ops.locator('.tone-ok')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('ops-refresh-failed.png'), fullPage: true });
});

test('the Operations page scrolls to content below the fold', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await mockOps(page);
  await page.goto('/ops');
  const last = page.getByTestId('ops-job').last();
  await expect(last).toBeVisible();
  await expect(last.getByText('Retention and recovery')).not.toBeInViewport();
  // Scroll the way a person does: the wheel over the panel, not scrollIntoView.
  await page.getByRole('heading', { name: 'Operations' }).hover();
  await page.mouse.wheel(0, 5000);
  await expect(last.getByText('Retention and recovery')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('ops-scrolled.png') });
});
