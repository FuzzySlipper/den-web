import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { createDenTransportClients } from './clients';
import { DenHttpClient } from './http';

describe('Wiki transport', () => {
  it('calls den-wiki read tools over MCP through Gateway with the viewer identity', async () => {
    const calls: Array<{ url: string; headers: unknown; body: unknown }> = [];
    const http = new DenHttpClient({
      fetchImpl: async (input, init) => {
        const body = JSON.parse(String(init?.body)) as { params: { name: string } };
        calls.push({ url: String(input), headers: init?.headers, body });
        if (body.params.name === 'wiki_read') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              result: {
                isError: true,
                structuredContent: { error: { code: 'not_found', message: 'wiki/x.md', retryable: false } },
              },
            }),
            { status: 200 },
          );
        }
        if (body.params.name === 'wiki_taxonomy') throw new TypeError('Failed to fetch');
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 2, result: { structuredContent: { query: 'wal', results: [] } } }),
          { status: 200 },
        );
      },
    });
    const wiki = createDenTransportClients(defaultRuntimeApiConfig, http).wiki;

    expect(await wiki.read('wiki/x.md')).toEqual({
      ok: false,
      error: { kind: 'not-found', message: 'wiki_read: not_found: wiki/x.md', status: 404 },
    });
    expect(await wiki.search('wal', 5)).toEqual({ ok: true, value: { query: 'wal', results: [] } });
    expect(await wiki.taxonomy()).toEqual({ ok: false, error: { kind: 'network', message: 'Failed to fetch' } });

    expect(calls.map((call) => call.url)).toEqual(['/api/v1/wiki/mcp', '/api/v1/wiki/mcp', '/api/v1/wiki/mcp']);
    expect(calls[0]?.headers).toMatchObject({ 'X-Den-Wiki-Agent': 'den-web-viewer' });
    expect(calls[1]?.body).toMatchObject({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'wiki_search', arguments: { query: 'wal', limit: 5 } },
    });
  });

  it('never names a den-wiki write operation', () => {
    const source = readFileSync(join(__dirname, 'wiki-transport.ts'), 'utf8');
    const protocol = readFileSync(join(__dirname, '../../../protocol/src/lib/den-wiki.ts'), 'utf8');
    for (const write of ['wiki_write', 'wiki_edit', 'wiki_move', 'wiki_delete', 'job_']) {
      expect(source).not.toContain(write);
      expect(protocol).not.toContain(write);
    }
  });
});
