import { signal, type Signal } from '@angular/core';
import type { DenDocPublishRequest, DenDocPublishResponse, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface DocumentPublishTransportPort {
  readonly preview: (request: DenDocPublishRequest) => Promise<DenResult<DenDocPublishResponse>>;
  readonly publish: (request: DenDocPublishRequest) => Promise<DenResult<DenDocPublishResponse>>;
}

export interface DocumentPublishStore {
  readonly previewResult: Signal<AsyncState<DenDocPublishResponse>>;
  readonly publishedResult: Signal<AsyncState<DenDocPublishResponse>>;
  readonly overwrite: Signal<boolean>;
  readonly setOverwrite: (overwrite: boolean) => void;
  readonly reset: () => void;
  readonly preview: (request: DenDocPublishRequest) => Promise<DenResult<DenDocPublishResponse>>;
  readonly publish: (request: DenDocPublishRequest) => Promise<DenResult<DenDocPublishResponse>>;
}

export function createDocumentPublishStore(transport: DocumentPublishTransportPort): DocumentPublishStore {
  const previewResult = signal<AsyncState<DenDocPublishResponse>>(idleState());
  const publishedResult = signal<AsyncState<DenDocPublishResponse>>(idleState());
  const overwrite = signal(false);

  return {
    previewResult: previewResult.asReadonly(),
    publishedResult: publishedResult.asReadonly(),
    overwrite: overwrite.asReadonly(),
    setOverwrite: (nextOverwrite) => {
      overwrite.set(nextOverwrite);
      previewResult.set(idleState());
      publishedResult.set(idleState());
    },
    reset: () => {
      previewResult.set(idleState());
      publishedResult.set(idleState());
      overwrite.set(false);
    },
    preview: async (request) => {
      const previous = stateValue(previewResult());
      previewResult.set(loadingState(previous));
      publishedResult.set(idleState());
      try {
        const result = await transport.preview(request);
        previewResult.set(resultState(result, previous));
        return result;
      } catch (error) {
        const classified = unknownStoreError(error);
        previewResult.set(errorState(classified, previous));
        return { ok: false, error: classified };
      }
    },
    publish: async (request) => {
      const previous = stateValue(publishedResult());
      publishedResult.set(loadingState(previous));
      try {
        const result = await transport.publish(request);
        publishedResult.set(resultState(result, previous));
        if (result.ok) previewResult.set(resultState(result, stateValue(previewResult())));
        return result;
      } catch (error) {
        const classified = unknownStoreError(error);
        publishedResult.set(errorState(classified, previous));
        return { ok: false, error: classified };
      }
    },
  };
}
