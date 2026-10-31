import { describe, expect, it } from 'vitest';
import type { DenResult, DenWikiReadResult } from '@den-web/protocol';
import { createWikiStore, type WikiTransportPort } from './wiki-store';

const page = (path: string): DenWikiReadResult => ({ path, content: `# ${path}` });

describe('WikiStore', () => {
  it('keeps the latest page when an earlier read answers last', async () => {
    const pending = new Map<string, (result: DenResult<DenWikiReadResult>) => void>();
    const transport: WikiTransportPort = {
      read: (path) => new Promise((resolve) => pending.set(path, resolve)),
      search: async () => ({ ok: true, value: { query: '', results: [] } }),
      list: async (folder) => ({ ok: true, value: { folder, enrichedPaths: [] } }),
      taxonomy: async () => ({ ok: true, value: { present: true, types: [], tags: [] } }),
      curationScan: async () => ({ ok: false, error: { kind: 'server', message: 'down', status: 503 } }),
    };
    const store = createWikiStore(transport);

    const first = store.openPage('wiki/a.md');
    const second = store.openPage('wiki/b.md');
    pending.get('wiki/b.md')?.({ ok: true, value: page('wiki/b.md') });
    await second;
    pending.get('wiki/a.md')?.({ ok: true, value: page('wiki/a.md') });
    await first;

    expect(store.page()).toEqual({ kind: 'data', value: page('wiki/b.md') });

    await store.loadCurationScan();
    expect(store.curationScan()).toEqual({ kind: 'error', error: { kind: 'server', message: 'down', status: 503 } });
    await store.openFolder('sources');
    expect(store.listing()).toEqual({ kind: 'data', value: { folder: 'sources', enrichedPaths: [] } });
  });
});
