import { signal, type Signal } from '@angular/core';
import type { DenKnowledgeEntryDetail, DenKnowledgeEntrySummary, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, unknownStoreError, type AsyncState } from './async-state';

export interface KnowledgeTransportPort {
  readonly listEntries: () => Promise<DenResult<readonly DenKnowledgeEntrySummary[]>>;
  readonly getEntry: (slug: string) => Promise<DenResult<DenKnowledgeEntryDetail>>;
}

export interface KnowledgeStore {
  readonly entries: Signal<AsyncState<readonly DenKnowledgeEntrySummary[]>>;
  readonly detail: Signal<AsyncState<DenKnowledgeEntryDetail>>;
  readonly selected: Signal<DenKnowledgeEntrySummary | null>;
  readonly refresh: () => Promise<void>;
  readonly select: (entry: DenKnowledgeEntrySummary) => Promise<void>;
}

export function createKnowledgeStore(transport: KnowledgeTransportPort): KnowledgeStore {
  const entries = signal<AsyncState<readonly DenKnowledgeEntrySummary[]>>(idleState());
  const detail = signal<AsyncState<DenKnowledgeEntryDetail>>(idleState());
  const selected = signal<DenKnowledgeEntrySummary | null>(null);
  let detailRequest = 0;

  const loadSelected = async (entry: DenKnowledgeEntrySummary): Promise<void> => {
    selected.set(entry);
    const request = ++detailRequest;
    const previousDetail = stateValue(detail());
    detail.set(loadingState(previousDetail));
    try {
      const result = await transport.getEntry(entry.slug);
      if (request !== detailRequest || selected()?.slug !== entry.slug) return;
      detail.set(resultState(result, previousDetail));
    } catch (error) {
      if (request !== detailRequest || selected()?.slug !== entry.slug) return;
      detail.set(errorState(unknownStoreError(error), previousDetail));
    }
  };

  return {
    entries: entries.asReadonly(),
    detail: detail.asReadonly(),
    selected: selected.asReadonly(),
    refresh: async () => {
      const previousEntries = stateValue(entries());
      entries.set(loadingState(previousEntries));
      try {
        const result = await transport.listEntries();
        entries.set(resultState(result, previousEntries));
        if (result.ok && selected() && !result.value.some((entry) => entry.slug === selected()?.slug)) {
          detailRequest += 1;
          selected.set(null);
          detail.set(idleState());
        }
      } catch (error) {
        entries.set(errorState(unknownStoreError(error), previousEntries));
      }
    },
    select: loadSelected,
  };
}
