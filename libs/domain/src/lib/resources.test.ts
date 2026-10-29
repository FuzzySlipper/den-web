import { describe, expect, it } from 'vitest';
import type { DenResource, DenResourcesHost, DenResourcesState, DenResourcesWork } from '@den-web/protocol';
import { filterResources, formatAge, hostStatus, projectResourcesOverview, projectWorkLedger } from './resources';

const generatedAt = '2026-10-29T22:00:00Z';
const GIB = 1_073_741_824;

describe('projectResourcesOverview', () => {
  it('shows measured metrics, GPU memory, app queues and ages against generated_at', () => {
    const view = projectResourcesOverview(state());
    expect(view.summary.map((card) => `${card.value} ${card.label}`)).toEqual([
      '1 2 machines · fresh telemetry',
      '1 Reported running jobs',
      '2 Jobs in native queues',
      '1 Shared resources',
    ]);
    const m5 = view.hosts[0];
    expect(m5?.statusLabel).toBe('Activity');
    expect(m5?.cpu).toEqual({ label: 'CPU · all cores', main: '72%', sub: '32 cores', fill: 72 });
    expect(m5?.ram.main).toBe('96.0 GiB');
    expect(m5?.ram.sub).toBe('/ 128 GiB');
    expect(m5?.ram.fill).toBe(75);
    expect(m5?.gpus[0]?.vram).toBe('4.0 GiB / 8.0 GiB driver VRAM');
    expect(m5?.gpus[0]?.gtt).toBe('20.0 GiB GTT · uses system RAM');
    expect(m5?.apps).toEqual([
      { name: 'ComfyUI', text: '1 running · 2 queued', healthy: true, title: 'Checked 2026-10-29T21:59:50Z' },
      { name: 'Health', text: 'Healthy · queue unknown', healthy: true, title: 'Checked 2026-10-29T21:59:50Z' },
    ]);
    expect(m5?.nativeJobs.map((job) => job.nodeTypes)).toEqual(['KSampler · VAEDecode']);
    expect(m5?.telemetryLabel).toBe('Telemetry 15s ago');
    expect(m5?.expiredCheckIns).toBe(1);
    expect(m5?.currentWork.map((row) => row.title)).toEqual(['Generate material candidates', 'Workbench batch']);
    expect(m5?.currentWork[0]?.age).toBe('1m ago');
  });

  it('keeps the last values beside a telemetry error and never calls it quiet', () => {
    const view = projectResourcesOverview(state());
    const nimo = view.hosts[1];
    expect(nimo?.statusLabel).toBe('Unknown');
    expect(nimo?.error).toBe('ssh: connect timed out');
    expect(nimo?.cpu.main).toBe('5%');
    expect(nimo?.telemetryLabel).toBe('Stale · Telemetry 5m ago');
    expect(nimo?.cpu.sub).toBe('');
    expect(nimo?.ram.main).toBe('Unknown');
    expect(nimo?.ram.fill).toBe(0);
  });

  it('labels each host status with the board wording', () => {
    expect(hostStatus(host({ status: 'quiet' })).label).toBe('Quiet sample');
    expect(hostStatus(host({ status: 'queued' })).label).toBe('Queued');
    expect(hostStatus(host({ status: 'working' })).label).toBe('Activity');
    expect(hostStatus(host({ status: 'quiet', stale: true })).label).toBe('Unknown');
    expect(hostStatus(host({ status: 'quiet', error: 'boom' })).label).toBe('Unknown');
  });
});

describe('filterResources', () => {
  it('searches every field and filters by host and lifecycle', () => {
    const resources = [resource(), resource({ id: 'nimo-cache', host: 'den-nimo', name: 'HF cache', lifecycle: 'experimental', notes: 'shared models' })];
    expect(filterResources(resources, { search: 'SHARED MODELS', host: '', lifecycle: '' }).map((row) => row.id)).toEqual(['nimo-cache']);
    expect(filterResources(resources, { search: '', host: 'den-m5', lifecycle: '' }).map((row) => row.id)).toEqual(['m5-comfy']);
    expect(filterResources(resources, { search: '', host: '', lifecycle: 'experimental' }).map((row) => row.id)).toEqual(['nimo-cache']);
  });

  it('says what each date means without inventing one', () => {
    const [row] = filterResources([resource({ path_present: null, path_checked_at: null, sharing: '' })], { search: '', host: '', lifecycle: '' });
    expect(row?.pathLabel).toBe('not checked');
    expect(row?.sharing).toBe('Sharing guidance has not been recorded.');
    expect(row?.lastUsedAt).toBeNull();
    const [missing] = filterResources([resource({ path_present: false })], { search: '', host: '', lifecycle: '' });
    expect(missing?.pathLabel).toBe('not found from the probe');
  });
});

describe('projectWorkLedger', () => {
  it('offers Renew and Check out only on active rows not managed by Workbench', () => {
    const rows = projectWorkLedger(state(), 'all');
    expect(rows.map((row) => [row.title, row.statusLabel, row.actions, row.detail])).toEqual([
      ['Generate material candidates', 'running', 'renew', 'Expires'],
      ['Old check-in', 'Stale running', 'renew', 'Heartbeat expired; inspect machine'],
      ['Workbench batch', 'queued', 'workbench', 'Expires'],
      ['Finished', 'completed', 'none', ''],
    ]);
    expect(projectWorkLedger(state(), 'active').map((row) => row.title)).not.toContain('Finished');
  });
});

describe('formatAge', () => {
  it('handles missing and future times', () => {
    const now = Date.parse(generatedAt);
    expect(formatAge(null, now)).toBe('Never received');
    expect(formatAge('2026-10-29T22:00:30Z', now)).toBe('0s ago');
    expect(formatAge('2026-10-27T21:00:00Z', now)).toBe('2d ago');
  });
});

function state(): DenResourcesState {
  return {
    generated_at: generatedAt,
    poll_seconds: 20,
    stale_after_seconds: 90,
    counts: { hosts: 2, hosts_fresh: 1, running: 1, native_queued: 2, resources: 1 },
    hosts: [
      host(),
      host({
        id: 'den-nimo', name: 'den-nimo', status: 'unknown', stale: true, error: 'ssh: connect timed out',
        sampled_at: '2026-10-29T21:55:00Z', apps: [], telemetry: { cpu_percent: 5, memory: { total_bytes: null, available_bytes: null } },
      }),
    ],
    resources: [resource()],
    work: [
      work(),
      work({ id: 'w2', title: 'Old check-in', stale: true }),
      work({ id: 'w3', title: 'Workbench batch', source: 'workbench', state: 'queued' }),
      work({ id: 'w4', title: 'Finished', state: 'completed', ended_at: '2026-10-29T21:00:00Z' }),
    ],
  };
}

function host(overrides: Partial<DenResourcesHost> = {}): DenResourcesHost {
  return {
    id: 'den-m5', name: 'den-m5', role: 'Strix Halo · ComfyUI, training', access: 'ssh den-m5', note: '', position: 1,
    status: 'working', stale: false, error: null,
    attempted_at: '2026-10-29T21:59:45Z', sampled_at: '2026-10-29T21:59:45Z', received_at: '2026-10-29T21:59:46Z',
    telemetry: {
      sampled_at: 1_793_397_585, platform: 'Linux', cpu_count: 32, cpu_percent: 72,
      memory: { total_bytes: 128 * GIB, available_bytes: 96 * GIB },
      gpus: [{ name: 'Radeon 8060S', utilization_percent: 40, memory_total_bytes: 8 * GIB, memory_used_bytes: 4 * GIB, gtt_used_bytes: 20 * GIB, memory_note: 'UMA' }],
    },
    apps: [
      { name: 'ComfyUI', kind: 'comfy', url: 'http://192.168.1.24:8188', resources: ['m5-comfy'], online: true, running: 1, queued: 2,
        jobs: [{ id: 'p-1', state: 'running', node_types: ['KSampler', 'VAEDecode'] }], error: null, checked_at: '2026-10-29T21:59:50Z', stale: false },
      { name: 'Health', kind: 'health', url: 'http://x', resources: [], online: true, running: null, queued: null, jobs: [], error: null, checked_at: '2026-10-29T21:59:50Z', stale: false },
    ],
    apps_checked_at: '2026-10-29T21:59:50Z',
    ...overrides,
  };
}

function resource(overrides: Partial<DenResource> = {}): DenResource {
  return {
    id: 'm5-comfy', host: 'den-m5', name: 'ComfyUI · strix-beast', kind: 'installation', path: '/home/agent/comfyui-strix-docker',
    probe_path: '', runtime_path: 'strix-beast:/app', access: 'http://192.168.1.24:8188', sharing: 'Shared; ask before upgrading.',
    lifecycle: 'maintained', notes: '', guide: '', match: '', updated_at: null, last_used_at: null, last_used_by: null,
    observed_activity_at: null, confirmed_at: null, confirmed_by: null, path_present: true, path_checked_at: '2026-10-29T21:59:45Z',
    ...overrides,
  };
}

function work(overrides: Partial<DenResourcesWork> = {}): DenResourcesWork {
  return {
    id: 'w1', host: 'den-m5', source: 'check-in', external_id: null, title: 'Generate material candidates', owner: 'my-agent',
    project: 'rusty-craftsurvive', resources: ['m5-comfy'], state: 'running', note: '', url: '', ttl_seconds: 180,
    created_at: '2026-10-29T21:50:00Z', started_at: '2026-10-29T21:50:00Z', updated_at: '2026-10-29T21:59:00Z',
    expires_at: '2026-10-29T22:02:00Z', ended_at: null, stale: false, ...overrides,
  };
}
