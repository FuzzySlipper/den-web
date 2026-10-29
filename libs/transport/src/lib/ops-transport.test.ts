import { describe, expect, it } from 'vitest';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { createDenTransportClients } from './clients';
import { DenHttpClient } from './http';

describe('Ops transport', () => {
  it('reads same-origin Ops routes and classifies an unreachable service', async () => {
    const calls: string[] = [];
    const http = new DenHttpClient({
      fetchImpl: async (input) => {
        calls.push(String(input));
        if (String(input).includes('/jobs/')) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ generated_at: 'x', status: 'ok', counts: {}, hosts: [], jobs: [] }), { status: 200 });
      },
    });
    const ops = createDenTransportClients(defaultRuntimeApiConfig, http).ops;

    const summary = await ops.summary();
    expect(summary.ok).toBe(true);
    const detail = await ops.job('den agents/git', 20);
    expect(detail).toEqual({ ok: false, error: { kind: 'network', message: 'Failed to fetch' } });
    expect(calls).toEqual(['/api/v1/ops/summary', '/api/v1/ops/jobs/den%20agents%2Fgit?limit=20']);
  });
});
