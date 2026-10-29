import { describe, expect, it } from 'vitest';
import type { ClockPort } from '@den-web/platform';
import type { DenOpsJobDetail, DenOpsSummary, DenResult } from '@den-web/protocol';
import { stateValue } from './async-state';
import { createOpsStore, OPS_HISTORY_LIMIT, OPS_REFRESH_INTERVAL_MS } from './ops-store';

const summary: DenOpsSummary = { generated_at: '2026-10-29T18:00:00Z', status: 'ok', counts: { ok: 1 }, hosts: [], jobs: [] };

describe('OpsStore', () => {
  it('keeps the last summary when a refresh fails so the view can mark it untrusted', async () => {
    const responses: DenResult<DenOpsSummary>[] = [
      { ok: true, value: summary },
      { ok: false, error: { kind: 'network', message: 'Failed to fetch' } },
    ];
    const store = createOpsStore({ summary: async () => responses.shift() ?? responses[0], job: async () => notFound() }, fakeClock().clock);

    await store.refresh();
    expect(store.summary().kind).toBe('data');
    await store.refresh();
    const state = store.summary();
    expect(state.kind).toBe('error');
    expect(stateValue(state)).toBe(summary);
  });

  it('loads history for the selected job and clears it when deselected', async () => {
    const calls: Array<{ jobId: string; limit?: number }> = [];
    const detail = { job: { job_id: 'den-agents-git' }, runs: [], verifications: [] } as unknown as DenOpsJobDetail;
    const store = createOpsStore({
      summary: async () => ({ ok: true, value: summary }),
      job: async (jobId, limit) => {
        calls.push({ jobId, limit });
        return { ok: true, value: detail };
      },
    }, fakeClock().clock);

    await store.selectJob('den-agents-git');
    expect(store.selectedJobId()).toBe('den-agents-git');
    expect(stateValue(store.detail())).toBe(detail);
    expect(calls).toEqual([{ jobId: 'den-agents-git', limit: OPS_HISTORY_LIMIT }]);

    await store.selectJob(null);
    expect(store.detail().kind).toBe('idle');
  });

  it('polls on the clock port while started and stops cleanly', async () => {
    let loads = 0;
    const fake = fakeClock();
    const store = createOpsStore({
      summary: async () => {
        loads += 1;
        return { ok: true, value: summary };
      },
      job: async () => notFound(),
    }, fake.clock);

    store.startPolling();
    await flush();
    expect(loads).toBe(1);
    expect(fake.pending()).toEqual([OPS_REFRESH_INTERVAL_MS]);
    fake.fire();
    await flush();
    expect(loads).toBe(2);
    store.stopPolling();
    expect(fake.pending()).toEqual([]);
  });
});

function notFound(): DenResult<DenOpsJobDetail> {
  return { ok: false, error: { kind: 'not-found', message: 'missing', status: 404 } };
}

function fakeClock(): { clock: ClockPort; pending: () => number[]; fire: () => void } {
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let next = 1;
  return {
    clock: {
      now: () => new Date('2026-10-29T18:00:00Z'),
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
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}
