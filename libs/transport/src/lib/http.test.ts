import { describe, expect, it } from 'vitest';
import { DenHttpClient, joinUrl, query } from './http';

describe('DenHttpClient', () => {
  it('returns parsed JSON for successful responses', async () => {
    const http = new DenHttpClient({
      fetchImpl: async () => Response.json({ ok: true }),
    });

    await expect(http.json('/api/v1/projects')).resolves.toEqual({ ok: true, value: { ok: true } });
  });

  it('classifies auth, not-found, server, invalid JSON, and network failures', async () => {
    const auth = await new DenHttpClient({ fetchImpl: async () => new Response('', { status: 403 }) }).json('/api/v1/projects');
    const missing = await new DenHttpClient({ fetchImpl: async () => new Response('', { status: 404 }) }).json('/api/v1/projects');
    const server = await new DenHttpClient({ fetchImpl: async () => new Response('', { status: 503 }) }).json('/api/v1/projects');
    const invalid = await new DenHttpClient({ fetchImpl: async () => new Response('{', { status: 200 }) }).json('/api/v1/projects');
    const network = await new DenHttpClient({
      fetchImpl: async () => {
        throw new TypeError('offline');
      },
    }).json('/api/v1/projects');

    expect(auth.ok ? null : auth.error.kind).toBe('auth');
    expect(missing.ok ? null : missing.error.kind).toBe('not-found');
    expect(server.ok ? null : server.error.kind).toBe('server');
    expect(invalid.ok ? null : invalid.error.kind).toBe('invalid-response');
    expect(network.ok ? null : network.error.kind).toBe('network');
  });
});

describe('URL helpers', () => {
  it('joins paths and omits empty query params', () => {
    expect(joinUrl('/api/v1/', '/projects')).toBe('/api/v1/projects');
    expect(query({ limit: 5, after: '', enabled: false, skip: undefined })).toBe('?limit=5&enabled=false');
  });
});

