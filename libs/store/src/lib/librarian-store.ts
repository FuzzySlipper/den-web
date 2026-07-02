import { signal, type Signal } from '@angular/core';
import type { DenLibrarianQueryRequest, DenLibrarianQueryResponse, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface LibrarianTransportPort {
  readonly query: (projectId: string, request: DenLibrarianQueryRequest) => Promise<DenResult<DenLibrarianQueryResponse>>;
}

export interface LibrarianStore {
  readonly result: Signal<AsyncState<DenLibrarianQueryResponse>>;
  readonly latestQuery: Signal<string>;
  readonly submit: (projectId: string, query: string) => Promise<void>;
  readonly clear: () => void;
}

export function createLibrarianStore(transport: LibrarianTransportPort): LibrarianStore {
  const result = signal<AsyncState<DenLibrarianQueryResponse>>(idleState());
  const latestQuery = signal('');

  return {
    result: result.asReadonly(),
    latestQuery: latestQuery.asReadonly(),
    submit: async (projectId, query) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      latestQuery.set(trimmed);
      const previous = stateValue(result());
      result.set(loadingState(previous));
      try {
        result.set(resultState(await transport.query(projectId, { query: trimmed }), previous));
      } catch (error) {
        result.set(errorState(unknownStoreError(error), previous));
      }
    },
    clear: () => {
      latestQuery.set('');
      result.set(idleState());
    },
  };
}
