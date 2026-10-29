import type {
  DenOpsHost,
  DenOpsJob,
  DenOpsJobStatus,
  DenOpsRun,
  DenOpsSchedule,
  DenOpsSummary,
  DenOpsVerification,
} from '@den-web/protocol';

export type OpsTone = 'ok' | 'info' | 'warning' | 'danger' | 'muted';

/** Status data older than this is shown as stale and never as protected. */
export const OPS_STALE_AFTER_SECONDS = 5 * 60;

/** Worst first, matching the Ops service severity order. */
const STATUS_ORDER: readonly DenOpsJobStatus[] = [
  'unknown',
  'failed',
  'overdue',
  'never_reported',
  'warning',
  'running',
  'ok',
  'disabled',
];

const STATUS_LABELS: Readonly<Record<DenOpsJobStatus, string>> = {
  unknown: 'Unknown',
  failed: 'Failed',
  overdue: 'Overdue',
  never_reported: 'Never reported',
  warning: 'Warning',
  running: 'Running',
  ok: 'OK',
  disabled: 'Disabled',
};

const STATUS_TONES: Readonly<Record<DenOpsJobStatus, OpsTone>> = {
  unknown: 'danger',
  failed: 'danger',
  overdue: 'danger',
  never_reported: 'warning',
  warning: 'warning',
  running: 'info',
  ok: 'ok',
  disabled: 'muted',
};

export interface OpsRunLine {
  readonly runId: string;
  readonly state: string;
  readonly tone: OpsTone;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly durationLabel: string | null;
  readonly newBytesLabel: string | null;
  readonly totalBytesLabel: string | null;
  readonly archiveName: string;
  readonly archiveId: string;
  readonly exitCode: number | null;
  readonly error: string;
  readonly reason: string;
  readonly warnings: readonly string[];
  readonly logPath: string;
  readonly runDirectory: string;
  readonly manifestPath: string;
  readonly recoveryPointer: string;
}

export interface OpsCheckLine {
  readonly id: string;
  readonly label: string;
  readonly state: string;
  readonly tone: OpsTone;
  readonly at: string;
  readonly archive: string;
  readonly scope: string;
  readonly fullDataRead: boolean | null;
  readonly evidencePath: string;
}

export interface OpsCurrentRun {
  readonly runId: string;
  readonly phase: string;
  readonly startedAt: string;
  readonly heartbeatAt: string;
  readonly heartbeatAgeLabel: string;
  readonly heartbeatStale: boolean;
}

export interface OpsJobRow {
  readonly id: string;
  readonly title: string;
  readonly hostId: string;
  readonly engine: string;
  readonly kind: string;
  readonly source: string;
  readonly scope: string;
  readonly target: string;
  readonly status: DenOpsJobStatus;
  readonly statusLabel: string;
  readonly tone: OpsTone;
  readonly reason: string;
  readonly registered: boolean;
  readonly scheduleLabel: string;
  readonly nextDueAt: string | null;
  readonly expectedBy: string | null;
  readonly currentRun: OpsCurrentRun | null;
  readonly lastAttempt: OpsRunLine | null;
  readonly lastSuccess: OpsRunLine | null;
  readonly lastArchive: OpsRunLine | null;
  readonly verification: OpsCheckLine | null;
  readonly restoreTest: OpsCheckLine | null;
  readonly retention: string;
  readonly recoveryPointer: string;
  readonly notes: string;
}

export interface OpsHostRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly coverageLabel: string;
  readonly configured: boolean;
  readonly jobCount: number;
  readonly statusLabel: string;
  readonly tone: OpsTone;
}

export interface OpsStatusCount {
  readonly status: DenOpsJobStatus;
  readonly label: string;
  readonly count: number;
  readonly tone: OpsTone;
}

export interface OpsOverview {
  readonly overallLabel: string;
  readonly overallTone: OpsTone;
  /** Why the overall status is not simply the service's, or null when it is. */
  readonly trustNotice: string | null;
  readonly generatedAt: string;
  readonly counts: readonly OpsStatusCount[];
  readonly hosts: readonly OpsHostRow[];
  readonly jobs: readonly OpsJobRow[];
}

export interface OpsOverviewOptions {
  /** True when the latest refresh failed and summary is the last good copy. */
  readonly refreshFailed: boolean;
}

/**
 * Projects an Ops summary for display. Green is only ever shown for data that
 * is current: a failed refresh or an old summary turns every OK into unknown,
 * because a reporting or API failure must never look like protection.
 */
export function projectOpsOverview(
  summary: DenOpsSummary,
  now: Date,
  options: OpsOverviewOptions,
): OpsOverview {
  const ageSeconds = secondsBetween(summary.generated_at, now);
  const stale = ageSeconds === null || ageSeconds > OPS_STALE_AFTER_SECONDS;
  const trusted = !options.refreshFailed && !stale;
  const trustNotice = options.refreshFailed
    ? 'Ops could not be reached; this is the last status received, so current protection is unknown.'
    : stale
      ? 'This status is out of date, so current protection is unknown.'
      : null;
  const jobs = [...summary.jobs]
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.job_id.localeCompare(b.job_id))
    .map((job) => projectJob(job, now, trusted));
  const overall = jobs.length === 0 ? 'unknown' : summary.status;
  return {
    overallLabel: jobs.length === 0 ? 'No jobs tracked' : opsStatusLabel(overall),
    overallTone: trustedTone(STATUS_TONES[overall], trusted),
    trustNotice,
    generatedAt: summary.generated_at,
    counts: STATUS_ORDER.flatMap((status) => {
      const count = summary.counts[status] ?? 0;
      return count > 0 ? [{ status, label: opsStatusLabel(status), count, tone: trustedTone(STATUS_TONES[status], trusted) }] : [];
    }),
    hosts: summary.hosts.map((host) => projectHost(host, trusted)),
    jobs,
  };
}

export function opsStatusLabel(status: DenOpsJobStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function opsStatusTone(status: DenOpsJobStatus): OpsTone {
  return STATUS_TONES[status] ?? 'muted';
}

export function projectJob(job: DenOpsJob, now: Date, trusted = true): OpsJobRow {
  return {
    id: job.job_id,
    title: job.display_name || job.job_id,
    hostId: job.host_id,
    engine: job.engine,
    kind: job.kind,
    source: job.source,
    scope: job.scope,
    target: job.target,
    status: job.status,
    statusLabel: opsStatusLabel(job.status),
    tone: trustedTone(opsStatusTone(job.status), trusted),
    reason: job.status_reason,
    registered: job.registered,
    scheduleLabel: scheduleLabel(job.schedule),
    nextDueAt: job.next_due_at,
    expectedBy: job.expected_by,
    currentRun: currentRun(job, now),
    lastAttempt: runLine(job.last_attempt, trusted),
    lastSuccess: runLine(job.last_success, trusted),
    lastArchive: runLine(job.last_archive, trusted),
    verification: checkLine(job.last_verification, trusted),
    restoreTest: checkLine(job.last_restore_test, trusted),
    retention: job.retention,
    recoveryPointer: job.recovery_pointer,
    notes: job.notes,
  };
}

export function runLine(run: DenOpsRun | null, trusted = true): OpsRunLine | null {
  if (!run) return null;
  return {
    runId: run.run_id,
    state: run.terminal ? run.state : 'running',
    tone: trustedTone(runTone(run), trusted),
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    durationLabel: run.duration_seconds === null ? null : formatDuration(run.duration_seconds),
    newBytesLabel: run.deduplicated_bytes === null ? null : formatBytes(run.deduplicated_bytes),
    totalBytesLabel: run.original_bytes === null ? null : formatBytes(run.original_bytes),
    archiveName: run.archive_name,
    archiveId: run.archive_id,
    exitCode: run.exit_code,
    error: run.error,
    reason: run.reason,
    warnings: run.warnings,
    logPath: run.log_path,
    runDirectory: run.run_directory,
    manifestPath: run.manifest_path,
    recoveryPointer: run.recovery_pointer,
  };
}

export function checkLine(check: DenOpsVerification | null, trusted = true): OpsCheckLine | null {
  if (!check) return null;
  const tone: OpsTone = check.state === 'success' ? 'ok' : check.state === 'warning' ? 'warning' : 'danger';
  return {
    id: check.verification_id,
    label: check.kind === 'restore_test' ? 'Restore test' : check.check_type || 'Verification',
    state: check.state,
    tone: trustedTone(tone, trusted),
    at: check.at,
    archive: check.archive,
    scope: check.scope,
    fullDataRead: check.full_data_read,
    evidencePath: check.evidence_path,
  };
}

export function scheduleLabel(schedule: DenOpsSchedule | null): string {
  if (!schedule) return 'Unscheduled (reports only when run)';
  const days = schedule.weekdays.length === 0 ? 'Daily' : schedule.weekdays.map(capitalize).join(', ');
  return `${days} ${schedule.times.join(', ')} ${schedule.timezone} (grace ${formatDuration(schedule.grace_seconds)})`;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (Math.abs(value) >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  return `${rest}s`;
}

function currentRun(job: DenOpsJob, now: Date): OpsCurrentRun | null {
  const run = job.current_run;
  if (!run) return null;
  const age = secondsBetween(run.updated_at, now) ?? 0;
  return {
    runId: run.run_id,
    phase: run.phase,
    startedAt: run.started_at,
    heartbeatAt: run.updated_at,
    heartbeatAgeLabel: `${formatDuration(age)} ago`,
    heartbeatStale: job.heartbeat_state === 'stale' || age > job.heartbeat_stale_after_seconds,
  };
}

function projectHost(host: DenOpsHost, trusted: boolean): OpsHostRow {
  const configured = host.coverage === 'configured';
  return {
    id: host.host_id,
    name: host.display_name || host.host_id,
    role: host.role,
    coverageLabel: configured ? 'Configured' : 'Not configured',
    configured,
    jobCount: host.job_count,
    statusLabel: configured ? opsStatusLabel(host.status) : 'No backup tracked',
    tone: configured ? trustedTone(opsStatusTone(host.status), trusted) : 'warning',
  };
}

function runTone(run: DenOpsRun): OpsTone {
  if (!run.terminal) return 'info';
  switch (run.state) {
    case 'success':
      return 'ok';
    case 'warning':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'muted';
  }
}

function trustedTone(tone: OpsTone, trusted: boolean): OpsTone {
  return tone === 'ok' && !trusted ? 'muted' : tone;
}

function statusRank(status: DenOpsJobStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index < 0 ? 0 : index;
}

function secondsBetween(iso: string, now: Date): number | null {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : (now.getTime() - at) / 1000;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
