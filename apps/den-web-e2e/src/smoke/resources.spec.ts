import { expect, test, type Page } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

const GIB = 1_073_741_824;
const secondsAgo = (seconds: number): string => new Date(Date.now() - seconds * 1000).toISOString();

function host(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'den-m5', name: 'den-m5', role: 'Strix Halo · ComfyUI, training', access: 'ssh den-m5', note: 'Ask before rebooting.', position: 1,
    status: 'working', stale: false, error: null,
    attempted_at: secondsAgo(15), sampled_at: secondsAgo(15), received_at: secondsAgo(14),
    telemetry: {
      sampled_at: Math.floor(Date.now() / 1000) - 15, platform: 'Linux 6.17 x86_64', cpu_count: 32, cpu_percent: 72,
      memory: { total_bytes: 128 * GIB, available_bytes: 96 * GIB, swap_total_bytes: 0, swap_free_bytes: 0 },
      gpus: [{ name: 'Radeon 8060S', utilization_percent: 40, memory_total_bytes: 8 * GIB, memory_used_bytes: 4 * GIB, gtt_used_bytes: 20 * GIB, memory_note: 'Unified memory' }],
      processes: [{ pid: 4242, command: 'python3 main.py --listen', cwd: '/app', cpu_percent: 180, rss_bytes: 12 * GIB }],
      containers: [{ name: 'strix-beast', image: 'comfy:latest', state: 'running', status: 'Up 2 days', cpu: '150%', memory: '12GiB', socket: '/run/docker.sock' }],
      disks: [{ path: '/', total_bytes: 2000 * GIB, free_bytes: 800 * GIB }],
      paths: {}, warnings: [],
    },
    apps: [{
      name: 'ComfyUI', kind: 'comfy', url: 'http://192.168.1.24:8188', resources: ['m5-comfy'], online: true, running: 1, queued: 2,
      jobs: [{ id: 'prompt-9f1', state: 'running', node_types: ['KSampler', 'VAEDecode'] }], error: null, checked_at: secondsAgo(10), stale: false,
    }],
    apps_checked_at: secondsAgo(10),
    ...overrides,
  };
}

function resource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm5-comfy', host: 'den-m5', name: 'ComfyUI · strix-beast', kind: 'installation', path: '/home/agent/comfyui-strix-docker',
    probe_path: '', runtime_path: 'strix-beast:/app', access: 'http://192.168.1.24:8188', sharing: 'Shared; ask before upgrading nodes.',
    lifecycle: 'maintained', notes: '', guide: '', match: '', updated_at: secondsAgo(3600),
    last_used_at: '2026-10-20T18:30:00Z', last_used_by: 'agent-x', observed_activity_at: secondsAgo(30),
    confirmed_at: '2026-10-01T09:00:00Z', confirmed_by: 'patch', path_present: true, path_checked_at: secondsAgo(15),
    ...overrides,
  };
}

function work(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'w-1', host: 'den-m5', source: 'check-in', external_id: null, title: 'Generate material candidates', owner: 'my-agent',
    project: 'rusty-craftsurvive', resources: ['m5-comfy'], state: 'running', note: '', url: '', ttl_seconds: 180,
    created_at: secondsAgo(600), started_at: secondsAgo(600), updated_at: secondsAgo(60), expires_at: new Date(Date.now() + 120_000).toISOString(),
    ended_at: null, stale: false, ...overrides,
  };
}

function snapshot(): Record<string, unknown> {
  return {
    generated_at: new Date().toISOString(), poll_seconds: 20, stale_after_seconds: 90,
    counts: { hosts: 2, hosts_fresh: 1, running: 1, native_queued: 2, resources: 2 },
    hosts: [
      host(),
      host({
        id: 'den-nimo', name: 'den-nimo', role: 'RTX workstation', note: '', status: 'unknown', stale: true, error: 'ssh: connect to host den-nimo timed out',
        sampled_at: secondsAgo(600), received_at: secondsAgo(600), apps: [], apps_checked_at: null,
        telemetry: { sampled_at: Math.floor(Date.now() / 1000) - 600, platform: 'Windows 11', cpu_count: 16, cpu_percent: 3, memory: { total_bytes: 64 * GIB, available_bytes: 50 * GIB } },
      }),
    ],
    resources: [
      resource(),
      resource({
        id: 'nimo-hf-cache', host: 'den-nimo', name: 'Hugging Face cache', kind: 'cache', path: 'D:/hf-cache', runtime_path: '', access: '',
        sharing: '', lifecycle: 'experimental', notes: 'Shared model downloads', last_used_at: null, last_used_by: null,
        observed_activity_at: null, confirmed_at: null, confirmed_by: null, path_present: null, path_checked_at: null,
      }),
    ],
    work: [
      work(),
      work({ id: 'w-2', title: 'Overnight LoRA', owner: 'trainer', stale: true, updated_at: secondsAgo(4000) }),
      work({ id: 'w-3', source: 'workbench', title: 'Workbench batch 12', owner: 'workbench', state: 'queued' }),
      work({ id: 'w-4', title: 'Bake textures', state: 'completed', ended_at: secondsAgo(7200), updated_at: secondsAgo(7200) }),
    ],
  };
}

interface Posted {
  readonly url: string;
  readonly body: unknown;
}

async function mockResources(page: Page, stateStatus: () => number = () => 200): Promise<{ posts: Posted[]; stateReads: () => number }> {
  const posts: Posted[] = [];
  let reads = 0;
  await mockDenServices(page);
  await page.route('**/api/v1/resources/state**', (route) => {
    reads += 1;
    const status = stateStatus();
    return status === 200
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot()) })
      : route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: 'bad_gateway', message: 'resources upstream unavailable' } }) });
  });
  await page.route('**/api/v1/resources/work**', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    posts.push({ url: new URL(route.request().url()).pathname, body });
    const warnings = route.request().url().endsWith('/resources/work') ? ['den-m5 also has: Generate material candidates (my-agent)'] : undefined;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...work(), ...(warnings ? { warnings } : {}) }) });
  });
  await page.route('**/api/v1/resources/directory', (route) => {
    posts.push({ url: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(resource()) });
  });
  return { posts, stateReads: () => reads };
}

test('Resources sits under Admin and shows machines, measured activity and native queues', async ({ page }, testInfo) => {
  await mockResources(page);
  await page.goto('/');
  await page.locator('.rail-group[aria-label="Admin"]').getByRole('link', { name: 'Resources' }).click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(page.getByRole('heading', { name: 'Resources', exact: true })).toBeVisible();

  await expect(page.getByTestId('resources-summary-machines')).toContainText('1');
  await expect(page.getByTestId('resources-summary-machines')).toContainText('2 machines · fresh telemetry');
  await expect(page.getByTestId('resources-summary-native')).toContainText('Jobs in native queues');

  const m5 = page.getByRole('article', { name: 'den-m5' });
  await expect(m5.getByTestId('resources-host-status')).toHaveText('Activity');
  await expect(m5).toContainText('72%');
  await expect(m5).toContainText('96.0 GiB');
  await expect(m5).toContainText('4.0 GiB / 8.0 GiB driver VRAM');
  await expect(m5).toContainText('20.0 GiB GTT · uses system RAM');
  await expect(m5).toContainText('1 running · 2 queued');
  await expect(m5).toContainText('1 expired check-in');
  await page.screenshot({ path: testInfo.outputPath('resources-top.png') });
  await expect(m5).toContainText('Generate material candidates');
  await m5.getByText('Inspect 1 native queue job').click();
  await expect(m5).toContainText('KSampler · VAEDecode');
  await m5.getByText('Processes, containers & storage').click();
  await expect(m5).toContainText('python3 main.py --listen');
  await expect(m5).toContainText('strix-beast');
  await expect(m5).toContainText('800.0 GiB free / 2000.0 GiB');

  const nimo = page.getByRole('article', { name: 'den-nimo' });
  await expect(nimo.getByTestId('resources-host-status')).toHaveText('Unknown');
  await expect(nimo.getByTestId('resources-host-error')).toContainText('Machine telemetry unavailable. Last values retained.');
  await expect(nimo.getByTestId('resources-host-error')).toContainText('timed out');
  await expect(nimo).toContainText('Stale · Telemetry 10m ago');
  await page.screenshot({ path: testInfo.outputPath('resources-overview.png'), fullPage: true });
});

test('shared resources filter, show every date, and record use and confirmation with the owner', async ({ page }, testInfo) => {
  const { posts } = await mockResources(page);
  await page.goto('/resources');
  const rows = page.getByTestId('resources-resource');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Search resources').fill('shared model');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Hugging Face cache');
  await expect(rows.first()).toContainText('No use recorded');
  await page.getByLabel('Search resources').fill('');
  await page.getByLabel('Filter lifecycle').selectOption('maintained');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Filter lifecycle').selectOption('');
  await page.getByLabel('Filter resource host').selectOption('den-nimo');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Filter resource host').selectOption('');

  const comfy = rows.filter({ hasText: 'ComfyUI · strix-beast' });
  await comfy.locator('summary').click();
  for (const label of ['Recorded use', 'Observed activity', 'Lifecycle confirmed', 'Path']) {
    await expect(comfy.locator('dt', { hasText: label })).toBeVisible();
  }
  await expect(comfy).toContainText('by agent-x');
  await expect(comfy).toContainText('by patch');
  await expect(comfy).toContainText('present · ');
  await page.screenshot({ path: testInfo.outputPath('resources-resource-expanded.png') });

  await comfy.getByRole('button', { name: 'Record use today' }).click();
  const use = page.getByRole('dialog', { name: 'Record actual use today' });
  await use.getByLabel('Your name / agent').fill('patch');
  await use.getByRole('button', { name: 'Record use' }).click();
  await expect(use).toHaveCount(0);
  await expect(page.getByTestId('resources-notice')).toContainText('Actual use recorded for today.');

  await comfy.getByRole('button', { name: 'Edit & confirm lifecycle' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit shared resource' });
  await expect(edit.getByLabel('Who is confirming this?')).toHaveValue('patch');
  await expect(edit.getByLabel('Resource ID')).toHaveValue('m5-comfy');
  await edit.getByLabel('Lifecycle').selectOption('experimental');
  await edit.getByRole('button', { name: 'Save resource' }).click();
  await expect(edit).toHaveCount(0);

  expect(posts).toEqual([
    { url: '/api/v1/resources/directory', body: { id: 'm5-comfy', touch: true, owner: 'patch' } },
    {
      url: '/api/v1/resources/directory',
      body: {
        id: 'm5-comfy', name: 'ComfyUI · strix-beast', kind: 'installation', lifecycle: 'experimental', path: '/home/agent/comfyui-strix-docker',
        runtime_path: 'strix-beast:/app', access: 'http://192.168.1.24:8188', sharing: 'Shared; ask before upgrading nodes.', notes: '',
        confirm: true, owner: 'patch',
      },
    },
  ]);
  expect(await page.evaluate(() => window.localStorage.getItem('den-web.resources.owner'))).toBe('patch');
});

test('check-in lists only that host’s resources, posts a TTL and shows overlap warnings', async ({ page }) => {
  const { posts } = await mockResources(page);
  await page.goto('/resources');
  await page.getByRole('button', { name: 'Check in on den-m5' }).click();
  const dialog = page.getByRole('dialog', { name: 'Check in to the workshop' });
  await expect(dialog.getByLabel('Machine')).toHaveValue('den-m5');
  const options = dialog.getByLabel('Resources').locator('option');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveText('ComfyUI · strix-beast · m5-comfy');
  await expect(dialog.getByLabel('Heartbeat expires in')).toHaveValue('180');
  await dialog.getByLabel('What are you doing?').fill('Material generation');
  await dialog.getByLabel('Your name / agent').fill('my-agent');
  await dialog.getByLabel('Project').fill('rusty-craftsurvive');
  await dialog.getByLabel('Resources').selectOption('m5-comfy');
  await dialog.getByLabel('Heartbeat expires in').selectOption('1800');
  await dialog.getByLabel('Notes').fill('Seeds 1-40');
  await dialog.getByRole('button', { name: 'Check in' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('resources-notice')).toContainText('den-m5 also has: Generate material candidates (my-agent)');
  expect(posts).toEqual([{
    url: '/api/v1/resources/work',
    body: {
      host: 'den-m5', title: 'Material generation', owner: 'my-agent', project: 'rusty-craftsurvive', resources: ['m5-comfy'],
      state: 'running', ttl_seconds: 1800, source: 'check-in', note: 'Seeds 1-40',
    },
  }]);
});

test('the work ledger renews and checks out its own rows and leaves Workbench rows alone', async ({ page }) => {
  const { posts } = await mockResources(page);
  await page.goto('/resources');
  const rows = page.getByTestId('resources-work');
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: 'Overnight LoRA' })).toContainText('Stale running');
  await expect(rows.filter({ hasText: 'Overnight LoRA' })).toContainText('Heartbeat expired; inspect machine');
  await expect(rows.filter({ hasText: 'Generate material candidates' })).toContainText(/Expires \w/);
  await expect(rows.filter({ hasText: 'Workbench batch 12' })).toContainText('Managed by Workbench');
  await expect(rows.filter({ hasText: 'Workbench batch 12' }).getByRole('button')).toHaveCount(0);

  const own = rows.filter({ hasText: 'Generate material candidates' });
  await own.getByRole('button', { name: 'Renew' }).click();
  await expect.poll(() => posts.length).toBe(1);
  await own.getByRole('button', { name: 'Check out' }).click();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts).toEqual([
    { url: '/api/v1/resources/work/w-1', body: {} },
    { url: '/api/v1/resources/work/w-1', body: { state: 'completed' } },
  ]);

  await page.getByLabel('Filter work ledger').selectOption('all');
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: 'Bake textures' })).toContainText('completed');
});

test('a failed refresh keeps the last values and says the connection is lost', async ({ page }, testInfo) => {
  let fail = false;
  await mockResources(page, () => (fail ? 503 : 200));
  await page.goto('/resources');
  await expect(page.getByRole('article', { name: 'den-m5' })).toBeVisible();
  fail = true;
  await page.getByRole('button', { name: 'Refresh resources' }).click();
  await expect(page.getByTestId('resources-connection-lost')).toContainText('Connection lost, showing last values');
  await expect(page.getByRole('article', { name: 'den-m5' })).toContainText('72%');
  await page.screenshot({ path: testInfo.outputPath('resources-connection-lost.png'), fullPage: true });
});

test('Resources says activity is unknown when the service cannot be reached', async ({ page }) => {
  await mockResources(page, () => 502);
  await page.goto('/resources');
  await expect(page.getByRole('alert')).toContainText('Could not load Resources');
  await expect(page.getByTestId('resources-host')).toHaveCount(0);
});

test('the board does not refresh while a dialog is open', async ({ page }) => {
  await page.clock.install();
  const { stateReads } = await mockResources(page);
  await page.goto('/resources');
  await expect(page.getByRole('article', { name: 'den-m5' })).toBeVisible();
  await page.clock.runFor(10_500);
  await expect.poll(stateReads).toBe(2);
  await page.getByRole('button', { name: 'Add resource' }).click();
  await expect(page.getByRole('dialog', { name: 'Add shared resource' })).toBeVisible();
  await page.clock.runFor(30_000);
  expect(stateReads()).toBe(2);
  await page.getByRole('dialog', { name: 'Add shared resource' }).getByRole('button', { name: 'Cancel' }).click();
  await page.clock.runFor(10_500);
  await expect.poll(stateReads).toBe(3);
});

test('the Resources page scrolls to content below the fold', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await mockResources(page);
  await page.goto('/resources');
  const ledger = page.getByRole('heading', { name: 'Work ledger' });
  await expect(page.getByRole('article', { name: 'den-m5' })).toBeVisible();
  await expect(ledger).not.toBeInViewport();
  // Scroll the way a person does: the wheel over the panel, not scrollIntoView.
  await page.getByRole('heading', { name: 'Resources', exact: true }).hover();
  await page.mouse.wheel(0, 5000);
  await expect(ledger).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('resources-scrolled.png') });
});
