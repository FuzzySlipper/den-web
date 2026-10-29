import { describe, expect, it } from 'vitest';
import type { DenOpsJob, DenOpsRun, DenOpsSummary } from '@den-web/protocol';
import { formatBytes, formatDuration, projectOpsOverview, scheduleLabel } from './ops';

const now = new Date('2026-10-29T18:00:00Z');

describe('projectOpsOverview', () => {
  it('shows a fresh successful job as OK with its restore point and pointers', () => {
    const view = projectOpsOverview(summary([job()]), now, { refreshFailed: false });
    expect(view.overallTone).toBe('ok');
    expect(view.trustNotice).toBeNull();
    const row = view.jobs[0];
    expect(row?.tone).toBe('ok');
    expect(row?.lastSuccess?.archiveName).toBe('den-agents-git-2026-10-29T04-24-43');
    expect(row?.lastSuccess?.newBytesLabel).toBe('126.5 MiB');
    expect(row?.lastSuccess?.durationLabel).toBe('7m 4s');
    expect(row?.scheduleLabel).toBe('Daily 07:00 America/Los_Angeles (grace 3h)');
  });

  it('never shows green when the refresh failed or the data is old', () => {
    const failed = projectOpsOverview(summary([job()]), now, { refreshFailed: true });
    expect(failed.overallTone).toBe('muted');
    expect(failed.jobs[0]?.tone).toBe('muted');
    expect(failed.jobs[0]?.lastSuccess?.tone).toBe('muted');
    expect(failed.trustNotice).toContain('unknown');

    const old = projectOpsOverview(summary([job()], '2026-10-29T17:00:00Z'), now, { refreshFailed: false });
    expect(old.overallTone).toBe('muted');
    expect(old.trustNotice).toContain('out of date');
  });

  it('keeps the last restore point visible beside a failure and sorts worst first', () => {
    const failed = job({
      job_id: 'b-failed',
      status: 'failed',
      status_reason: 'latest finished run r2 failed',
      last_attempt: run({ run_id: 'r2', state: 'failed', complete: false, archive_name: '', error: 'repository locked', exit_code: 2 }),
    });
    const view = projectOpsOverview(summary([job({ job_id: 'a-ok' }), failed], now.toISOString(), 'failed'), now, { refreshFailed: false });
    expect(view.jobs.map((row) => row.id)).toEqual(['b-failed', 'a-ok']);
    expect(view.overallTone).toBe('danger');
    const row = view.jobs[0];
    expect(row?.lastAttempt?.error).toBe('repository locked');
    expect(row?.lastSuccess?.runId).toBe('20261028T212037-2462905');
  });

  it('marks uncovered machines and an empty ledger as unprotected, not healthy', () => {
    const empty: DenOpsSummary = {
      generated_at: now.toISOString(),
      status: 'unknown',
      counts: {},
      hosts: [{ host_id: 'den-win11', display_name: 'den-win11', role: '', notes: '', registered: true, coverage: 'not_configured', job_count: 0, status: 'unknown' }],
      jobs: [],
    };
    const view = projectOpsOverview(empty, now, { refreshFailed: false });
    expect(view.overallLabel).toBe('No jobs tracked');
    expect(view.overallTone).toBe('danger');
    expect(view.hosts[0]).toMatchObject({ coverageLabel: 'Not configured', statusLabel: 'No backup tracked', tone: 'warning' });
  });

  it('flags a running job whose heartbeat stopped', () => {
    const current = run({ run_id: 'r3', state: 'running', terminal: false, finished_at: null, updated_at: '2026-10-29T17:30:00Z', phase: 'create' });
    const view = projectOpsOverview(
      summary([job({ status: 'unknown', current_run: current, heartbeat_state: 'stale', heartbeat_age_seconds: 1800, last_attempt: current })], now.toISOString(), 'unknown'),
      now,
      { refreshFailed: false },
    );
    expect(view.jobs[0]?.currentRun).toMatchObject({ runId: 'r3', heartbeatStale: true, heartbeatAgeLabel: '30m ago' });
    expect(view.jobs[0]?.tone).toBe('danger');
  });
});

describe('ops formatting', () => {
  it('formats sizes, durations and schedules', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(283373557310)).toBe('263.9 GiB');
    expect(formatDuration(3700)).toBe('1h 1m');
    expect(formatDuration(45)).toBe('45s');
    expect(scheduleLabel(null)).toContain('Unscheduled');
    expect(scheduleLabel({ timezone: 'America/Los_Angeles', times: ['09:00'], weekdays: ['sat'], grace_seconds: 21600 })).toBe('Sat 09:00 America/Los_Angeles (grace 6h)');
  });
});

function summary(jobs: readonly DenOpsJob[], generatedAt = now.toISOString(), status: DenOpsJob['status'] = 'ok'): DenOpsSummary {
  const counts: Record<string, number> = {};
  for (const item of jobs) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return {
    generated_at: generatedAt,
    status,
    counts,
    hosts: [{ host_id: 'den-agents', display_name: 'den-agents', role: 'agent workstation VM', notes: '', registered: true, coverage: 'configured', job_count: jobs.length, status }],
    jobs,
  };
}

function job(overrides: Partial<DenOpsJob> = {}): DenOpsJob {
  const success = run();
  return {
    job_id: 'den-agents-git',
    host_id: 'den-agents',
    display_name: 'den-agents Git projects',
    engine: 'borg',
    kind: 'backup',
    source: 'den-agents:/home/agent',
    scope: 'Git repositories',
    target: 'den-nas:/mnt/storage/backup/den-agents/borg',
    schedule: { timezone: 'America/Los_Angeles', times: ['07:00'], weekdays: [], grace_seconds: 10800 },
    heartbeat_stale_after_seconds: 600,
    retention: '30 daily, 12 weekly, 12 monthly, 3 yearly',
    recovery_pointer: 'den-nas:/mnt/storage/backup/den-agents/recovery/',
    notes: '',
    registered: true,
    enabled: true,
    status: 'ok',
    status_reason: 'latest finished run succeeded',
    freshness: 'fresh',
    expected_by: '2026-10-29T17:00:00Z',
    next_due_at: '2026-10-30T14:00:00Z',
    evaluated_at: now.toISOString(),
    current_run: null,
    heartbeat_state: null,
    heartbeat_age_seconds: null,
    last_attempt: success,
    last_finished: success,
    last_success: success,
    last_archive: success,
    last_verification: null,
    last_restore_test: null,
    ...overrides,
  };
}

function run(overrides: Partial<DenOpsRun> = {}): DenOpsRun {
  return {
    job_id: 'den-agents-git',
    run_id: '20261028T212037-2462905',
    host: 'den-agents',
    kind: 'backup',
    engine: 'borg',
    runner: 'borgmatic',
    state: 'success',
    terminal: true,
    phase: 'create',
    started_at: '2026-10-29T04:20:37Z',
    updated_at: '2026-10-29T04:27:42Z',
    finished_at: '2026-10-29T04:27:42Z',
    exit_code: 0,
    error: '',
    reason: '',
    warnings: [],
    notices: [],
    target: '/mnt/storage/backup/den-agents/borg',
    archive_id: 'e7f64bce',
    archive_name: 'den-agents-git-2026-10-29T04-24-43',
    original_bytes: 283373557310,
    compressed_bytes: 194479790574,
    deduplicated_bytes: 132660210,
    file_count: 1020550,
    duration_seconds: 424,
    complete: true,
    log_path: '',
    manifest_path: '/home/agent/.local/state/den-agents-backup/runs/x/manifest.json',
    run_directory: '/home/agent/.local/state/den-agents-backup/runs/x',
    recovery_pointer: '',
    received_at: '2026-10-29T04:28:00Z',
    report_count: 1,
    ...overrides,
  };
}
