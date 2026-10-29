import type {
  DenResource,
  DenResourceLifecycle,
  DenResourcesApp,
  DenResourcesHost,
  DenResourcesState,
  DenResourcesWork,
} from '@den-web/protocol';

export type ResourcesTone = 'active' | 'queued' | 'quiet' | 'unknown' | 'ok' | 'warning' | 'danger' | 'muted';

export const RESOURCE_LIFECYCLES: readonly DenResourceLifecycle[] = ['maintained', 'experimental', 'retired', 'unknown'];

const GIB = 1_073_741_824;

export interface ResourcesSummaryCard {
  readonly id: 'machines' | 'running' | 'native' | 'resources';
  readonly value: string;
  readonly label: string;
}

export interface ResourcesMetric {
  readonly label: string;
  readonly main: string;
  readonly sub: string;
  /** Bar fill, 0–100; 0 when unknown. */
  readonly fill: number;
}

export interface ResourcesGpuLine {
  readonly name: string;
  readonly utilization: string;
  readonly vram: string;
  readonly gtt: string | null;
  readonly note: string;
}

export interface ResourcesAppLine {
  readonly name: string;
  readonly text: string;
  readonly healthy: boolean;
  readonly title: string;
}

export interface ResourcesNativeJob {
  readonly key: string;
  readonly app: string;
  readonly state: string;
  readonly id: string;
  readonly nodeTypes: string;
}

export interface ResourcesWorkSnippet {
  readonly id: string;
  readonly state: string;
  readonly title: string;
  readonly owner: string;
  readonly age: string;
}

export interface ResourcesProcessLine {
  readonly key: string;
  readonly command: string;
  readonly detail: string;
  readonly cpu: string;
  readonly ram: string;
}

export interface ResourcesContainerLine {
  readonly key: string;
  readonly name: string;
  readonly socket: string;
  readonly image: string;
  readonly state: string;
  readonly cpu: string;
  readonly memory: string;
}

export interface ResourcesDiskLine {
  readonly path: string;
  readonly space: string;
}

export interface ResourcesHostCard {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly access: string;
  readonly note: string;
  readonly statusLabel: string;
  readonly tone: ResourcesTone;
  readonly cpu: ResourcesMetric;
  readonly ram: ResourcesMetric;
  readonly gpus: readonly ResourcesGpuLine[];
  readonly apps: readonly ResourcesAppLine[];
  readonly appsCheckedAge: string | null;
  readonly nativeJobs: readonly ResourcesNativeJob[];
  readonly expiredCheckIns: number;
  readonly currentWork: readonly ResourcesWorkSnippet[];
  readonly error: string | null;
  readonly platform: string;
  readonly processes: readonly ResourcesProcessLine[];
  readonly containers: readonly ResourcesContainerLine[];
  readonly disks: readonly ResourcesDiskLine[];
  readonly warnings: readonly string[];
  readonly telemetryLabel: string;
  readonly telemetryAt: string | null;
}

export interface ResourceRow {
  readonly id: string;
  readonly host: string;
  readonly name: string;
  readonly kind: string;
  readonly path: string;
  readonly runtimePath: string;
  readonly probePath: string;
  readonly access: string;
  readonly guide: string;
  readonly match: string;
  readonly updatedAt: string | null;
  readonly sharing: string;
  readonly notes: string;
  readonly lifecycle: DenResourceLifecycle;
  readonly lastUsedAt: string | null;
  readonly lastUsedBy: string | null;
  readonly observedActivityAt: string | null;
  readonly confirmedAt: string | null;
  readonly confirmedBy: string | null;
  readonly pathLabel: string;
  readonly pathCheckedAt: string | null;
}

export interface ResourcesWorkRow {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly project: string;
  readonly note: string;
  readonly host: string;
  readonly owner: string;
  readonly resources: string;
  readonly statusLabel: string;
  readonly tone: ResourcesTone;
  readonly age: string;
  readonly updatedAt: string | null;
  /** "Heartbeat expired; inspect machine", or the time named by `detailAt`. */
  readonly detail: string;
  readonly detailAt: string | null;
  readonly actions: 'renew' | 'workbench' | 'none';
}

export interface ResourcesOverview {
  readonly generatedAt: string;
  readonly pollLabel: string;
  readonly summary: readonly ResourcesSummaryCard[];
  readonly hosts: readonly ResourcesHostCard[];
}

export interface ResourceFilter {
  readonly search: string;
  readonly host: string;
  readonly lifecycle: string;
}

export function projectResourcesOverview(state: DenResourcesState): ResourcesOverview {
  const now = Date.parse(state.generated_at);
  const counts = state.counts;
  return {
    generatedAt: state.generated_at,
    pollLabel: `Hosts polled every ${state.poll_seconds}s`,
    summary: [
      { id: 'machines', value: String(counts.hosts_fresh), label: `${counts.hosts} machines · fresh telemetry` },
      { id: 'running', value: String(counts.running), label: 'Reported running jobs' },
      { id: 'native', value: String(counts.native_queued), label: 'Jobs in native queues' },
      { id: 'resources', value: String(counts.resources), label: 'Shared resources' },
    ],
    hosts: state.hosts.map((host) => projectHost(host, state.work, now)),
  };
}

export function hostStatus(host: DenResourcesHost): { readonly label: string; readonly tone: ResourcesTone } {
  if (host.stale || host.error || host.status === 'unknown') return { label: 'Unknown', tone: 'unknown' };
  if (host.status === 'quiet') return { label: 'Quiet sample', tone: 'quiet' };
  if (host.status === 'queued') return { label: 'Queued', tone: 'queued' };
  return { label: 'Activity', tone: 'active' };
}

function projectHost(host: DenResourcesHost, work: readonly DenResourcesWork[], now: number): ResourcesHostCard {
  const t = host.telemetry ?? {};
  const memory = t.memory ?? {};
  const status = hostStatus(host);
  const ownWork = work.filter((row) => row.host === host.id);
  const telemetryAt = host.sampled_at ?? host.received_at;
  const ramFill =
    isNumber(memory.total_bytes) && memory.total_bytes > 0 && isNumber(memory.available_bytes)
      ? (100 * memory.available_bytes) / memory.total_bytes
      : null;
  return {
    id: host.id,
    name: host.name,
    role: host.role,
    access: host.access,
    note: host.note,
    statusLabel: status.label,
    tone: status.tone,
    cpu: {
      label: 'CPU · all cores',
      main: formatPercent(t.cpu_percent),
      sub: isNumber(t.cpu_count) && t.cpu_count > 0 ? `${t.cpu_count} cores` : '',
      fill: barFill(t.cpu_percent),
    },
    ram: {
      label: 'RAM available',
      main: formatGiB(memory.available_bytes),
      sub: isNumber(memory.total_bytes) && memory.total_bytes > 0 ? `/ ${(memory.total_bytes / GIB).toFixed(0)} GiB` : '',
      fill: barFill(ramFill),
    },
    gpus: (t.gpus ?? []).map((gpu) => ({
      name: gpu.name ?? 'GPU',
      utilization: `${formatPercent(gpu.utilization_percent)} utilization`,
      vram: `${formatGiB(gpu.memory_used_bytes)} / ${formatGiB(gpu.memory_total_bytes)} driver VRAM`,
      gtt: isNumber(gpu.gtt_used_bytes) ? `${formatGiB(gpu.gtt_used_bytes)} GTT · uses system RAM` : null,
      note: gpu.memory_note ?? '',
    })),
    apps: host.apps.map(appLine),
    appsCheckedAge: host.apps.length > 0 ? formatAge(host.apps_checked_at, now) : null,
    nativeJobs: host.apps.flatMap((app) =>
      app.jobs.map((job) => ({
        key: `${app.name}:${job.id}`,
        app: app.name,
        state: job.state,
        id: job.id,
        nodeTypes: job.node_types.join(' · '),
      })),
    ),
    expiredCheckIns: ownWork.filter((row) => row.stale).length,
    currentWork: ownWork
      .filter((row) => isActive(row) && !row.stale)
      .slice(0, 3)
      .map((row) => ({ id: row.id, state: row.state, title: row.title, owner: row.owner, age: formatAge(row.updated_at, now) })),
    error: host.error,
    platform: t.platform || 'No telemetry received',
    processes: (t.processes ?? []).map((process, index) => ({
      key: `${process.pid ?? 'pid'}-${index}`,
      command: process.command ?? '',
      detail: `PID ${process.pid ?? '?'}${process.cwd ? ` · ${process.cwd}` : ''}`,
      cpu: formatPercent(process.cpu_percent),
      ram: formatGiB(process.rss_bytes),
    })),
    containers: (t.containers ?? []).map((container, index) => ({
      key: `${container.socket ?? ''}:${container.name ?? index}`,
      name: container.name ?? '',
      socket: container.socket ?? '',
      image: container.image ?? '',
      state: container.state ?? '',
      cpu: container.cpu || 'CPU unknown',
      memory: container.memory ?? '',
    })),
    disks: (t.disks ?? []).map((disk) => ({
      path: disk.path ?? '',
      space: `${formatGiB(disk.free_bytes)} free / ${formatGiB(disk.total_bytes)}`,
    })),
    warnings: t.warnings ?? [],
    telemetryLabel: `${host.stale ? 'Stale · ' : ''}Telemetry ${formatAge(telemetryAt, now)}`,
    telemetryAt,
  };
}

function appLine(app: DenResourcesApp): ResourcesAppLine {
  const queue = app.running !== null ? `${app.running} running · ${app.queued ?? 0} queued` : 'Healthy · queue unknown';
  return {
    name: app.name,
    text: `${app.stale ? 'Stale · ' : ''}${app.online ? queue : 'Unreachable'}`,
    healthy: app.online && !app.stale,
    title: app.error || (app.checked_at ? `Checked ${app.checked_at}` : 'Never checked'),
  };
}

export function filterResources(resources: readonly DenResource[], filter: ResourceFilter): readonly ResourceRow[] {
  const search = filter.search.trim().toLowerCase();
  return resources
    .filter(
      (resource) =>
        (!filter.host || resource.host === filter.host) &&
        (!filter.lifecycle || resource.lifecycle === filter.lifecycle) &&
        (!search || JSON.stringify(resource).toLowerCase().includes(search)),
    )
    .map(resourceRow);
}

function resourceRow(resource: DenResource): ResourceRow {
  return {
    id: resource.id,
    host: resource.host,
    name: resource.name,
    kind: resource.kind || 'installation',
    path: resource.path,
    runtimePath: resource.runtime_path,
    probePath: resource.probe_path,
    access: resource.access,
    guide: resource.guide,
    match: resource.match,
    updatedAt: resource.updated_at,
    sharing: resource.sharing || 'Sharing guidance has not been recorded.',
    notes: resource.notes,
    lifecycle: resource.lifecycle || 'unknown',
    lastUsedAt: resource.last_used_at,
    lastUsedBy: resource.last_used_by,
    observedActivityAt: resource.observed_activity_at,
    confirmedAt: resource.confirmed_at,
    confirmedBy: resource.confirmed_by,
    pathLabel: resource.path_checked_at
      ? resource.path_present
        ? 'present'
        : 'not found from the probe'
      : 'not checked',
    pathCheckedAt: resource.path_checked_at,
  };
}

export function projectWorkLedger(state: DenResourcesState, scope: 'active' | 'all'): readonly ResourcesWorkRow[] {
  const now = Date.parse(state.generated_at);
  return state.work
    .filter((row) => scope === 'all' || isActive(row))
    .map((row) => {
      const active = isActive(row);
      return {
        id: row.id,
        title: row.title,
        source: row.source,
        project: row.project,
        note: row.note,
        host: row.host,
        owner: row.owner,
        resources: row.resources.join(', '),
        statusLabel: row.stale ? `Stale ${row.state}` : row.state,
        tone: row.stale ? 'warning' : workTone(row.state),
        age: formatAge(row.updated_at, now),
        updatedAt: row.updated_at,
        detail: row.stale ? 'Heartbeat expired; inspect machine' : active ? 'Expires' : '',
        detailAt: row.stale ? null : active ? row.expires_at : row.ended_at,
        actions: row.source === 'workbench' ? 'workbench' : active ? 'renew' : 'none',
      };
    });
}

function workTone(state: DenResourcesWork['state']): ResourcesTone {
  switch (state) {
    case 'running':
      return 'active';
    case 'queued':
      return 'queued';
    case 'completed':
      return 'ok';
    case 'failed':
      return 'danger';
    default:
      return 'muted';
  }
}

export function isActive(row: DenResourcesWork): boolean {
  return row.state === 'queued' || row.state === 'running';
}

/** Age of an RFC 3339 time relative to `now` (milliseconds), e.g. the state's `generated_at`. */
export function formatAge(iso: string | null | undefined, now: number): string {
  if (!iso) return 'Never received';
  const at = Date.parse(iso);
  if (!Number.isFinite(at) || !Number.isFinite(now)) return 'Never received';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatGiB(bytes: number | null | undefined): string {
  return isNumber(bytes) ? `${(bytes / GIB).toFixed(1)} GiB` : 'Unknown';
}

export function formatPercent(value: number | null | undefined): string {
  return isNumber(value) ? `${Math.round(value)}%` : 'Unknown';
}

function barFill(value: number | null | undefined): number {
  return isNumber(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
