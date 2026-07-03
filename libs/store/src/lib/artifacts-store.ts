import { signal, type Signal } from '@angular/core';
import type { DenArtifactMetadata, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface ArtifactsTransportPort {
  readonly resolve: (ref: string) => Promise<DenResult<DenArtifactMetadata>>;
  readonly contentUrl: (artifactId: string) => string;
}

export interface ArtifactsStore {
  readonly metadataByRef: Signal<Readonly<Record<string, AsyncState<DenArtifactMetadata>>>>;
  readonly load: (ref: string) => Promise<void>;
  readonly stateFor: (ref: string) => AsyncState<DenArtifactMetadata>;
  readonly contentUrl: (artifact: DenArtifactMetadata) => string;
}

export function createArtifactsStore(transport: ArtifactsTransportPort): ArtifactsStore {
  const metadataByRef = signal<Readonly<Record<string, AsyncState<DenArtifactMetadata>>>>({});

  const stateFor = (ref: string): AsyncState<DenArtifactMetadata> => metadataByRef()[ref] ?? idleState();

  return {
    metadataByRef: metadataByRef.asReadonly(),
    load: async (ref) => {
      const current = stateFor(ref);
      if (current.kind === 'loading' || current.kind === 'data') return;
      const previous = stateValue(current);
      metadataByRef.update((records) => ({ ...records, [ref]: loadingState(previous) }));
      try {
        const result = await transport.resolve(ref);
        metadataByRef.update((records) => ({ ...records, [ref]: resultState(result, previous) }));
      } catch (error) {
        metadataByRef.update((records) => ({ ...records, [ref]: errorState(unknownStoreError(error), previous) }));
      }
    },
    stateFor,
    contentUrl: (artifact) => transport.contentUrl(artifact.artifact_id),
  };
}
