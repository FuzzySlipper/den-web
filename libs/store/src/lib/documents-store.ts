import { signal, type Signal } from '@angular/core';
import { documentSelectionAction, type DocumentSelectionAction } from '@den-web/domain';
import type { DenDiscussion, DenDocumentDetail, DenDocumentSummary, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface DocumentsTransportPort {
  readonly listDocuments: (projectId: string) => Promise<DenResult<readonly DenDocumentSummary[]>>;
  readonly getDocument: (projectId: string, slug: string) => Promise<DenResult<DenDocumentDetail>>;
  readonly getDiscussion: (projectId: string, slug: string) => Promise<DenResult<DenDiscussion>>;
}

export interface DocumentsStore {
  readonly documents: Signal<AsyncState<readonly DenDocumentSummary[]>>;
  readonly detail: Signal<AsyncState<DenDocumentDetail>>;
  readonly discussion: Signal<AsyncState<DenDiscussion>>;
  readonly selected: Signal<DenDocumentSummary | null>;
  readonly dirty: Signal<boolean>;
  readonly refresh: (projectId: string) => Promise<void>;
  readonly select: (document: DenDocumentSummary) => Promise<DocumentSelectionAction>;
  readonly confirmSelect: (document: DenDocumentSummary) => Promise<void>;
  readonly setDirty: (dirty: boolean) => void;
}

export function createDocumentsStore(transport: DocumentsTransportPort): DocumentsStore {
  const documents = signal<AsyncState<readonly DenDocumentSummary[]>>(idleState());
  const detail = signal<AsyncState<DenDocumentDetail>>(idleState());
  const discussion = signal<AsyncState<DenDiscussion>>(idleState());
  const selected = signal<DenDocumentSummary | null>(null);
  const dirty = signal(false);

  const loadSelected = async (document: DenDocumentSummary): Promise<void> => {
    selected.set(document);
    dirty.set(false);
    const previousDetail = stateValue(detail());
    const previousDiscussion = stateValue(discussion());
    detail.set(loadingState(previousDetail));
    discussion.set(loadingState(previousDiscussion));
    try {
      const [documentResult, discussionResult] = await Promise.all([
        transport.getDocument(document.project_id, document.slug),
        transport.getDiscussion(document.project_id, document.slug),
      ]);
      detail.set(resultState(documentResult, previousDetail));
      discussion.set(resultState(discussionResult, previousDiscussion));
    } catch (error) {
      const classified = unknownStoreError(error);
      detail.set(errorState(classified, previousDetail));
      discussion.set(errorState(classified, previousDiscussion));
    }
  };

  return {
    documents: documents.asReadonly(),
    detail: detail.asReadonly(),
    discussion: discussion.asReadonly(),
    selected: selected.asReadonly(),
    dirty: dirty.asReadonly(),
    refresh: async (projectId) => {
      const previous = stateValue(documents());
      documents.set(loadingState(previous));
      try {
        documents.set(resultState(await transport.listDocuments(projectId), previous));
      } catch (error) {
        documents.set(errorState(unknownStoreError(error), previous));
      }
    },
    select: async (document) => {
      const action = documentSelectionAction(selected(), document, dirty());
      if (action === 'select') await loadSelected(document);
      return action;
    },
    confirmSelect: loadSelected,
    setDirty: (nextDirty) => dirty.set(nextDirty),
  };
}
