import { describe, expect, it } from 'vitest';
import { memoryStorage, type ClockPort, type KeyValueStoragePort } from '@den-web/platform';
import type { DenResourcesState, DenResult } from '@den-web/protocol';
import { stateValue } from './async-state';
import {
  createResourcesStore,
  RESOURCES_OWNER_STORAGE_KEY,
  RESOURCES_REFRESH_INTERVAL_MS,
  type ResourcesTransportPort,
} from './resources-store';

const snapshot = {
  generated_at: '2026-10-29T22:00:00Z', poll_seconds: 20, stale_after_seconds: 90,
  counts: { hosts: 0, hosts_fresh: 0, running: 0, native_queued: 0, resources: 0 }, hosts: [], resources: [], work: [],
} as DenResourcesState;

describe('ResourcesStore', () => {
  it('keeps the last state when a refresh fails', async () => {
    const responses: DenResult<DenResourcesState>[] = [
      { ok: true, value: snapshot },
      { ok: false, error: { kind: 'network', message: 'Failed to fetch' } },
    ];
    const store = createResourcesStore(transport({ state: async () => responses.shift() ?? responses[0] }), fakeClock().clock, memoryStorage());
    await store.refresh();
    await store.refresh();
    expect(store.state().kind).toBe('error');
    expect(stateValue(store.state())).toBe(snapshot);
  });

  it('polls every 10s but skips the refresh while a dialog is open', async () => {
    let loads = 0;
    const fake = fakeClock();
    const store = createResourcesStore(transport({ state: async () => { loads += 1; return { ok: true, value: snapshot }; } }), fake.clock, memoryStorage());
    store.startPolling();
    await flush();
    expect(loads).toBe(1);
    expect(fake.pending()).toEqual([RESOURCES_REFRESH_INTERVAL_MS]);
    store.setPaused(true);
    fake.fire();
    await flush();
    expect(loads).toBe(1);
    expect(fake.pending()).toEqual([RESOURCES_REFRESH_INTERVAL_MS]);
    store.setPaused(false);
    fake.fire();
    await flush();
    expect(loads).toBe(2);
    store.stopPolling();
    expect(fake.pending()).toEqual([]);
  });

  it('shows check-in warnings and remembers the owner', async () => {
    const storage = memoryStorage();
    const store = createResourcesStore(transport({
      reportWork: async () => ({ ok: true, value: { ...work(), warnings: ['den-m5 already has 1 active report'] } }),
    }), fakeClock().clock, storage);
    const result = await store.checkIn({ host: 'den-m5', title: 'Generate', owner: ' my-agent ', ttl_seconds: 180 });
    expect(result.ok).toBe(true);
    expect(store.notice()).toBe('den-m5 already has 1 active report');
    expect(store.owner()).toBe('my-agent');
    expect(storage.getItem(RESOURCES_OWNER_STORAGE_KEY)).toBe('my-agent');
  });

  it('confirms a lifecycle and records use with the owner, and survives broken storage', async () => {
    const bodies: unknown[] = [];
    const broken: KeyValueStoragePort = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => undefined,
    };
    const store = createResourcesStore(transport({
      saveResource: async (body) => { bodies.push(body); return { ok: true, value: {} as never }; },
    }), fakeClock().clock, broken);
    expect(store.owner()).toBe('');
    await store.saveResource({ id: 'm5-comfy', lifecycle: 'maintained' }, 'me');
    await store.recordUse('m5-comfy', 'me');
    expect(bodies).toEqual([
      { id: 'm5-comfy', lifecycle: 'maintained', confirm: true, owner: 'me' },
      { id: 'm5-comfy', touch: true, owner: 'me' },
    ]);
    expect(store.owner()).toBe('me');
    expect(store.notice()).toBe('Actual use recorded for today.');
  });

  it('renews with an empty body, checks out as completed, and reports failures', async () => {
    const calls: unknown[] = [];
    const store = createResourcesStore(transport({
      updateWork: async (id, body) => {
        calls.push([id, body]);
        return id === 'gone' ? { ok: false, error: { kind: 'not-found', message: 'work_not_found: gone', status: 404 } } : { ok: true, value: work() };
      },
    }), fakeClock().clock, memoryStorage());
    await store.renew('w1');
    await store.checkOut('w1');
    await store.checkOut('gone');
    expect(calls).toEqual([['w1', {}], ['w1', { state: 'completed' }], ['gone', { state: 'completed' }]]);
    expect(store.notice()).toBe('work_not_found: gone');
  });
});

function work() {
  return {
    id: 'w1', host: 'den-m5', source: 'check-in', external_id: null, title: 'Generate', owner: 'my-agent', project: '', resources: [],
    state: 'running' as const, note: '', url: '', ttl_seconds: 180, created_at: null, started_at: null, updated_at: null,
    expires_at: null, ended_at: null, stale: false,
  };
}

function transport(overrides: Partial<ResourcesTransportPort>): ResourcesTransportPort {
  return {
    state: async () => ({ ok: true, value: snapshot }),
    reportWork: async () => ({ ok: true, value: work() }),
    updateWork: async () => ({ ok: true, value: work() }),
    saveResource: async () => ({ ok: true, value: {} as never }),
    ...overrides,
  };
}

function fakeClock(): { clock: ClockPort; pending: () => number[]; fire: () => void } {
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let next = 1;
  return {
    clock: {
      now: () => new Date('2026-10-29T22:00:00Z'),
      setTimeout: (callback, delay) => {
        const handle = next++;
        timers.set(handle, { callback, delay });
        return handle;
      },
      clearTimeout: (handle) => {
        timers.delete(handle);
      },
    },
    pending: () => [...timers.values()].map((timer) => timer.delay),
    fire: () => {
      const entries = [...timers.entries()];
      timers.clear();
      for (const [, timer] of entries) timer.callback();
    },
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}
