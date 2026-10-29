import { describe, expect, it } from 'vitest';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { createDenTransportClients } from './clients';
import { DenHttpClient } from './http';

describe('Resources transport', () => {
  it('reads and writes same-origin Resources routes and surfaces the error envelope', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const http = new DenHttpClient({
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (url.endsWith('/directory')) {
          return new Response(JSON.stringify({ error: { code: 'validation_failed', message: 'host is required' } }), { status: 400 });
        }
        if (url.includes('/work/')) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ generated_at: 'x', hosts: [], resources: [], work: [] }), { status: 200 });
      },
    });
    const resources = createDenTransportClients(defaultRuntimeApiConfig, http).resources;

    expect((await resources.state(250)).ok).toBe(true);
    expect((await resources.reportWork({ host: 'den-m5', title: 'Generate', owner: 'me', ttl_seconds: 180 })).ok).toBe(true);
    expect(await resources.updateWork('6f0c/a', { state: 'completed' })).toEqual({ ok: false, error: { kind: 'network', message: 'Failed to fetch' } });
    const saved = await resources.saveResource({ id: 'm5-new', touch: true, owner: 'me' });
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error.message).toContain('validation_failed: host is required');

    expect(calls).toEqual([
      { url: '/api/v1/resources/state?work_limit=250', method: 'GET', body: undefined },
      { url: '/api/v1/resources/work', method: 'POST', body: { host: 'den-m5', title: 'Generate', owner: 'me', ttl_seconds: 180 } },
      { url: '/api/v1/resources/work/6f0c%2Fa', method: 'POST', body: { state: 'completed' } },
      { url: '/api/v1/resources/directory', method: 'POST', body: { id: 'm5-new', touch: true, owner: 'me' } },
    ]);
  });
});
