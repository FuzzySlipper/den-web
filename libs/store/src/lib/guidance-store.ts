import { signal, type Signal } from '@angular/core';
import type {
  DenDocumentDetail,
  DenDocumentSummary,
  DenDocumentUpdateRequest,
  DenGuidanceDeleteResponse,
  DenGuidanceEntry,
  DenGuidanceEntryListResponse,
  DenGuidanceEntryRequest,
  DenGuidancePacket,
  DenResult,
} from '@den-web/protocol';
import { DEN_GLOBAL_PROJECT_ID } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

const documentUpdateAgent = 'web-ui';

export interface GuidanceTransportPort {
  readonly listEntries: (projectId: string, options?: { readonly includeGlobal?: boolean }) => Promise<DenResult<DenGuidanceEntryListResponse>>;
  readonly resolve: (projectId: string, options?: { readonly includeContent?: boolean; readonly includeHidden?: boolean }) => Promise<DenResult<DenGuidancePacket>>;
  readonly addEntry: (projectId: string, body: DenGuidanceEntryRequest) => Promise<DenResult<DenGuidanceEntry>>;
  readonly deleteEntry: (projectId: string, entryId: number) => Promise<DenResult<DenGuidanceDeleteResponse>>;
}

export interface GuidanceDocumentsTransportPort {
  readonly getDocument: (projectId: string, slug: string) => Promise<DenResult<DenDocumentDetail>>;
  readonly updateDocument: (projectId: string, slug: string, patch: DenDocumentUpdateRequest) => Promise<DenResult<DenDocumentDetail | DenDocumentSummary | undefined>>;
}

export interface GuidanceStore {
  readonly entries: Signal<AsyncState<readonly DenGuidanceEntry[]>>;
  readonly packet: Signal<AsyncState<DenGuidancePacket>>;
  readonly selectedEntry: Signal<DenGuidanceEntry | null>;
  readonly selectedDocument: Signal<AsyncState<DenDocumentDetail>>;
  readonly refresh: (projectId: string) => Promise<void>;
  readonly selectEntry: (entry: DenGuidanceEntry) => Promise<void>;
  readonly addEntry: (projectId: string, request: DenGuidanceEntryRequest) => Promise<DenResult<DenGuidanceEntry>>;
  readonly saveEntry: (projectId: string, entry: DenGuidanceEntry, patch: EntryPatch) => Promise<DenResult<DenGuidanceEntry>>;
  readonly deleteEntry: (projectId: string, entry: DenGuidanceEntry) => Promise<DenResult<DenGuidanceDeleteResponse>>;
  readonly updateSelectedDocumentContent: (contentMarkdown: string) => Promise<DenResult<DenDocumentDetail>>;
}

export interface EntryPatch {
  readonly importance: string;
  readonly audience: readonly string[];
  readonly sortOrder: number;
  readonly notes: string;
}

export function createGuidanceStore(guidance: GuidanceTransportPort, documents: GuidanceDocumentsTransportPort): GuidanceStore {
  const entries = signal<AsyncState<readonly DenGuidanceEntry[]>>(idleState());
  const packet = signal<AsyncState<DenGuidancePacket>>(idleState());
  const selectedEntry = signal<DenGuidanceEntry | null>(null);
  const selectedDocument = signal<AsyncState<DenDocumentDetail>>(idleState());
  let loadedProjectId: string | null = null;

  const reloadPacket = async (projectId: string): Promise<void> => {
    const previous = stateValue(packet());
    if (previous === undefined) packet.set(loadingState());
    try {
      packet.set(resultState(await guidance.resolve(projectId, { includeContent: false }), previous));
    } catch (error) {
      packet.set(errorState(unknownStoreError(error), previous));
    }
  };

  const setEntriesResult = (result: DenResult<DenGuidanceEntryListResponse>, previous: readonly DenGuidanceEntry[] | undefined): void => {
    entries.set(resultState(result.ok ? { ok: true, value: result.value.entries } : result, previous));
  };

  const selectEntry = async (entry: DenGuidanceEntry): Promise<void> => {
    selectedEntry.set(entry);
    const previous = stateValue(selectedDocument());
    selectedDocument.set(loadingState(previous));
    try {
      selectedDocument.set(resultState(await documents.getDocument(entry.document_project_id, entry.document_slug), previous));
    } catch (error) {
      selectedDocument.set(errorState(unknownStoreError(error), previous));
    }
  };

  const reconcileEntry = (entry: DenGuidanceEntry): void => {
    const previous = stateValue(entries());
    if (!previous) return;
    const existingIndex = previous.findIndex((item) => item.id === entry.id);
    const next = existingIndex >= 0
      ? previous.map((item) => item.id === entry.id ? entry : item)
      : [...previous, entry].sort(compareGuidanceEntries);
    entries.set(resultState({ ok: true, value: next }, previous));
    selectedEntry.set(entry);
  };

  return {
    entries: entries.asReadonly(),
    packet: packet.asReadonly(),
    selectedEntry: selectedEntry.asReadonly(),
    selectedDocument: selectedDocument.asReadonly(),
    refresh: async (projectId) => {
      const previous = stateValue(entries());
      if (loadedProjectId !== projectId) {
        loadedProjectId = projectId;
        selectedEntry.set(null);
        selectedDocument.set(idleState());
      }
      if (previous === undefined) entries.set(loadingState());
      const includeGlobal = projectId !== DEN_GLOBAL_PROJECT_ID;
      try {
        const [entryResult] = await Promise.all([
          guidance.listEntries(projectId, { includeGlobal }),
          reloadPacket(projectId),
        ]);
        setEntriesResult(entryResult, previous);
      } catch (error) {
        entries.set(errorState(unknownStoreError(error), previous));
      }
    },
    selectEntry,
    addEntry: async (projectId, request) => {
      const result = await guidance.addEntry(projectId, request);
      if (!result.ok) return result;
      reconcileEntry(result.value);
      await reloadPacket(projectId);
      await selectEntry(result.value);
      return result;
    },
    saveEntry: async (projectId, entry, patch) => {
      const result = await guidance.addEntry(projectId, {
        document_project_id: entry.document_project_id,
        document_slug: entry.document_slug,
        importance: patch.importance,
        audience: patch.audience,
        sort_order: patch.sortOrder,
        notes: patch.notes,
      });
      if (!result.ok) return result;
      reconcileEntry(result.value);
      await reloadPacket(projectId);
      return result;
    },
    deleteEntry: async (projectId, entry) => {
      const result = await guidance.deleteEntry(projectId, entry.id);
      if (!result.ok) return result;
      const previous = stateValue(entries());
      if (previous) entries.set(resultState({ ok: true, value: previous.filter((item) => item.id !== entry.id) }, previous));
      if (selectedEntry()?.id === entry.id) {
        selectedEntry.set(null);
        selectedDocument.set(idleState());
      }
      await reloadPacket(projectId);
      return result;
    },
    updateSelectedDocumentContent: async (contentMarkdown) => {
      const entry = selectedEntry();
      const previous = stateValue(selectedDocument());
      if (!entry) {
        return { ok: false, error: { kind: 'unknown', message: 'No guidance entry selected' } };
      }
      const result = await documents.updateDocument(entry.document_project_id, entry.document_slug, {
        agent: documentUpdateAgent,
        content_markdown: contentMarkdown,
      });
      if (!result.ok) {
        selectedDocument.set(errorState(result.error, previous));
        return result;
      }
      const nextDetail = reconcileDocumentDetail(entry.document_project_id, entry.document_slug, result.value, previous, contentMarkdown);
      selectedDocument.set(resultState({ ok: true, value: nextDetail }, previous));
      return { ok: true, value: nextDetail };
    },
  };
}

function compareGuidanceEntries(left: DenGuidanceEntry, right: DenGuidanceEntry): number {
  return left.sort_order - right.sort_order || left.project_id.localeCompare(right.project_id) || left.document_slug.localeCompare(right.document_slug);
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

function isDocumentSummary(value: DenDocumentDetail | DenDocumentSummary | undefined): value is DenDocumentSummary {
  return typeof value === 'object' && value !== null && 'slug' in value;
}

function isDocumentDetail(value: DenDocumentDetail | DenDocumentSummary | undefined): value is DenDocumentDetail {
  return isDocumentSummary(value) && ('content_markdown' in value || 'content' in value);
}
