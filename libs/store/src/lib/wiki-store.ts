import { signal, type Signal } from '@angular/core';
import type {
  DenResult,
  DenWikiCurationScanResult,
  DenWikiListResult,
  DenWikiReadResult,
  DenWikiSearchResult,
  DenWikiTaxonomyResult,
} from '@den-web/protocol';
import {
  errorState,
  idleState,
  loadingState,
  resultState,
  stateValue,
  type AsyncState,
  unknownStoreError,
} from './async-state';

/** The den-wiki reads the viewer makes. There is no write path. */
export interface WikiTransportPort {
  readonly read: (path: string) => Promise<DenResult<DenWikiReadResult>>;
  readonly search: (query: string) => Promise<DenResult<DenWikiSearchResult>>;
  readonly list: (folder: string) => Promise<DenResult<DenWikiListResult>>;
  readonly taxonomy: () => Promise<DenResult<DenWikiTaxonomyResult>>;
  readonly curationScan: () => Promise<DenResult<DenWikiCurationScanResult>>;
}

/**
 * Live reads of den-wiki: nothing is cached beyond the last result of each
 * kind, and every open or listing asks the facade again.
 */
export interface WikiStore {
  readonly page: Signal<AsyncState<DenWikiReadResult>>;
  readonly listing: Signal<AsyncState<DenWikiListResult>>;
  readonly search: Signal<AsyncState<DenWikiSearchResult>>;
  readonly taxonomy: Signal<AsyncState<DenWikiTaxonomyResult>>;
  readonly curationScan: Signal<AsyncState<DenWikiCurationScanResult>>;
  readonly openPage: (path: string) => Promise<void>;
  readonly openFolder: (folder: string) => Promise<void>;
  readonly runSearch: (query: string) => Promise<void>;
  readonly loadTaxonomy: () => Promise<void>;
  readonly loadCurationScan: () => Promise<void>;
}

export function createWikiStore(transport: WikiTransportPort): WikiStore {
  const page = signal<AsyncState<DenWikiReadResult>>(idleState());
  const listing = signal<AsyncState<DenWikiListResult>>(idleState());
  const search = signal<AsyncState<DenWikiSearchResult>>(idleState());
  const taxonomy = signal<AsyncState<DenWikiTaxonomyResult>>(idleState());
  const curationScan = signal<AsyncState<DenWikiCurationScanResult>>(idleState());

  // Each kind of read keeps only its latest request's answer, so a slow
  // response to an earlier click never replaces a later one.
  const loader = <T>(target: ReturnType<typeof signal<AsyncState<T>>>) => {
    let latest = 0;
    return async (request: () => Promise<DenResult<T>>): Promise<void> => {
      const id = ++latest;
      const previous = stateValue(target());
      target.set(loadingState(previous));
      try {
        const result = await request();
        if (id === latest) target.set(resultState(result, previous));
      } catch (error) {
        if (id === latest) target.set(errorState(unknownStoreError(error), previous));
      }
    };
  };

  const loadPage = loader(page);
  const loadListing = loader(listing);
  const loadSearch = loader(search);
  const loadTaxonomy = loader(taxonomy);
  const loadScan = loader(curationScan);

  return {
    page: page.asReadonly(),
    listing: listing.asReadonly(),
    search: search.asReadonly(),
    taxonomy: taxonomy.asReadonly(),
    curationScan: curationScan.asReadonly(),
    openPage: (path) => loadPage(() => transport.read(path)),
    openFolder: (folder) => loadListing(() => transport.list(folder)),
    runSearch: (query) => loadSearch(() => transport.search(query)),
    loadTaxonomy: () => loadTaxonomy(() => transport.taxonomy()),
    loadCurationScan: () => loadScan(() => transport.curationScan()),
  };
}
