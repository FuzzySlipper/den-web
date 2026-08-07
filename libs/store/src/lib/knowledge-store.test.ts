import { describe, expect, it } from 'vitest';
import type { DenKnowledgeEntryDetail, DenKnowledgeEntrySummary, DenResult } from '@den-web/protocol';
import { createKnowledgeStore } from './knowledge-store';
import { stateValue } from './async-state';

const entry: DenKnowledgeEntrySummary = {
  id: 1,
  slug: 'global-entry',
  title: 'Global entry',
  kind: 'reference',
  status: 'reviewed',
  curation_state: 'human_curated',
  created_at: '2026-08-06T00:00:00Z',
  updated_at: '2026-08-06T00:00:00Z',
};

const detail: DenKnowledgeEntryDetail = {
  ...entry,
  body_markdown: '# Global entry',
};

const ok = <T>(value: T): DenResult<T> => ({ ok: true, value });

describe('KnowledgeStore', () => {
  it('refreshes the global list and loads selected detail by slug', async () => {
    const listArguments: unknown[] = [];
    const detailSlugs: string[] = [];
    const store = createKnowledgeStore({
      listEntries: async () => {
        listArguments.push(undefined);
        return ok([entry]);
      },
      getEntry: async (slug) => {
        detailSlugs.push(slug);
        return ok(detail);
      },
    });

    await store.refresh();
    await store.select(entry);

    expect(stateValue(store.entries())).toEqual([entry]);
    expect(stateValue(store.detail())).toEqual(detail);
    expect(store.selected()).toEqual(entry);
    expect(listArguments).toEqual([undefined]);
    expect(detailSlugs).toEqual(['global-entry']);
  });

  it('keeps the list and detail selection independent from workspace scope', async () => {
    let listCalls = 0;
    const store = createKnowledgeStore({
      listEntries: async () => {
        listCalls += 1;
        return ok([entry]);
      },
      getEntry: async () => ok(detail),
    });

    await store.refresh();
    await store.select(entry);
    await store.refresh();

    expect(listCalls).toBe(2);
    expect(store.selected()?.slug).toBe('global-entry');
    expect(stateValue(store.detail())?.slug).toBe('global-entry');
  });

  it('surfaces list and detail failures without throwing', async () => {
    const failure = { ok: false as const, error: { kind: 'network', message: 'Knowledge unavailable' } };
    const store = createKnowledgeStore({
      listEntries: async () => failure,
      getEntry: async () => failure,
    });

    await store.refresh();
    expect(store.entries().kind).toBe('error');

    await store.select(entry);
    expect(store.detail().kind).toBe('error');
  });
});
