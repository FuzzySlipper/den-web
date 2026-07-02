import { signal, type Signal } from '@angular/core';
import { documentSelectionAction, type DocumentSelectionAction } from '@den-web/domain';
import type { DenDiscussion, DenDocumentDetail, DenDocumentSummary, DenDocumentUpdateRequest, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

const documentUpdateAgent = 'web-ui';

export interface DocumentsTransportPort {
  readonly listDocuments: (projectId: string) => Promise<DenResult<readonly DenDocumentSummary[]>>;
  readonly getDocument: (projectId: string, slug: string) => Promise<DenResult<DenDocumentDetail>>;
  readonly updateDocument: (projectId: string, slug: string, patch: DenDocumentUpdateRequest) => Promise<DenResult<DenDocumentDetail | DenDocumentSummary | undefined>>;
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
  readonly updateDocumentContent: (projectId: string, slug: string, contentMarkdown: string) => Promise<DenResult<DenDocumentDetail>>;
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
      if (selected()?.project_id !== projectId) {
        selected.set(null);
        detail.set(idleState());
        discussion.set(idleState());
        dirty.set(false);
      }
      if (previous === undefined) documents.set(loadingState());
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
    updateDocumentContent: async (projectId, slug, contentMarkdown) => {
      const previousDetail = stateValue(detail());
      try {
        const result = await transport.updateDocument(projectId, slug, {
          agent: documentUpdateAgent,
          content_markdown: contentMarkdown,
        });
        if (!result.ok) {
          detail.set(errorState(result.error, previousDetail));
          return result;
        }
        const nextDetail = reconcileDocumentDetail(projectId, slug, result.value, previousDetail, contentMarkdown);
        detail.set(resultState({ ok: true, value: nextDetail }, previousDetail));
        documents.set(reconcileDocumentList(documents(), nextDetail));
        selected.set(toDocumentSummary(nextDetail));
        dirty.set(false);
        return { ok: true, value: nextDetail };
      } catch (error) {
        const classified = unknownStoreError(error);
        detail.set(errorState(classified, previousDetail));
        return { ok: false, error: classified };
      }
    },
    setDirty: (nextDirty) => dirty.set(nextDirty),
  };
}

function reconcileDocumentDetail(
  projectId: string,
  slug: string,
  value: DenDocumentDetail | DenDocumentSummary | undefined,
  previous: DenDocumentDetail | undefined,
  contentMarkdown: string,
): DenDocumentDetail {
  const base = previous?.project_id === projectId && previous.slug === slug
    ? previous
    : { project_id: projectId, slug, title: slug };
  return {
    ...base,
    ...(isDocumentSummary(value) ? value : {}),
    content_markdown: isDocumentDetail(value) ? value.content_markdown ?? contentMarkdown : contentMarkdown,
  };
}

function reconcileDocumentList(state: AsyncState<readonly DenDocumentSummary[]>, detailValue: DenDocumentDetail): AsyncState<readonly DenDocumentSummary[]> {
  const previous = stateValue(state);
  if (!previous) return state;
  return resultState({
    ok: true,
    value: previous.map((document) => document.project_id === detailValue.project_id && document.slug === detailValue.slug
      ? { ...document, ...toDocumentSummary(detailValue) }
      : document),
  }, previous);
}

function toDocumentSummary(document: DenDocumentDetail): DenDocumentSummary {
  return document;
}

function isDocumentSummary(value: DenDocumentDetail | DenDocumentSummary | undefined): value is DenDocumentSummary {
  return typeof value === 'object' && value !== null && 'slug' in value;
}

function isDocumentDetail(value: DenDocumentDetail | DenDocumentSummary | undefined): value is DenDocumentDetail {
  return isDocumentSummary(value) && ('content_markdown' in value || 'content' in value);
}
