import { useCallback, useState } from 'react';
import type {
  AgentStreamEntry,
  Document,
  DocumentSummary,
  Message,
  SubagentRunSummary,
} from '@den-web/api/types';
import type { DirectConversation } from '@den-web/api/channels/types';
import { getDispatch, getMessage, getThread } from '@den-web/api/client';
import { documentSelectionAction } from '@den-web/features/documents/documentEditor';
import type { GitFocus } from '@den-web/features/git/git';
import type { WorkspaceViewMode } from './workspaceViewModes';
import type { DetailSelectionApi } from './useDetailSelection';

export interface WorkspaceNavigationParams {
  selection: DetailSelectionApi;
  selectedSpaceId: string | null;
  effectiveSpaceId: string | null;
  setSelectedSpaceId: (id: string | null) => void;
  setViewMode: (mode: WorkspaceViewMode) => void;
  refreshDocs: () => void;
}

export interface WorkspaceNavigation {
  /** Git focus target, scoped to the git view. */
  gitFocus: GitFocus | null;
  /** Agent identity whose DM thread should open in the DM view. */
  selectedDmAgent: string | null;
  /** Open DM conversation transcript. */
  selectedDmConversation: DirectConversation | null;
  /** Whether the open document editor has unsaved edits. */
  documentDetailDirty: boolean;
  /** A pending document the user tried to switch to while the editor was dirty. */
  pendingDocumentSwitch: DocumentSummary | null;

  handleProjectSelect: (id: string) => void;
  handleTaskSelect: (taskId: number, projectId?: string | null) => void;
  handleMessageSelect: (message: Message) => void;
  handleStreamSelect: (entry: AgentStreamEntry) => void;
  handleSubagentRunSelect: (run: SubagentRunSummary) => void;
  handleDispatchSelect: (dispatchId: number) => Promise<void>;
  handleAssignmentTraceSelect: (assignmentId: string) => void;
  handleOpenGitFocus: (focus: GitFocus) => void;
  handleClearGitFocus: () => void;
  handleStreamThreadOpen: (entry: AgentStreamEntry) => Promise<void>;
  handleMessageOpen: (projectId: string, messageId: number) => Promise<void>;
  handleThreadOpen: (projectId: string, threadId: number) => Promise<void>;

  handleOpenDmTranscript: (agentIdentity: string) => void;
  handleSelectDmConversation: (conversation: DirectConversation) => void;
  handleDmBack: () => void;

  applyDocumentSelection: (doc: DocumentSummary) => void;
  handleDocumentSelect: (doc: DocumentSummary) => void;
  handleDocumentSaved: (doc: Document) => void;
  handleDocumentDirtyChange: (dirty: boolean) => void;
  handleCancelDocumentSwitch: () => void;

  /** Close helpers used by the keyboard close-panel handler. */
  closeDmConversation: () => void;
  closeDmAgent: () => void;
  closeDetail: () => void;
}

/**
 * Cross-feature navigation coordinator extracted from the App god component.
 *
 * Owns the navigation-target state that pairs with a view (git focus, DM
 * agent/conversation, document-editor dirty/pending) and exposes the selection
 * handlers. Selecting any detail simply replaces the single
 * {@link DetailSelectionApi} value, so handlers no longer clear sibling state.
 */
export function useWorkspaceNavigation(params: WorkspaceNavigationParams): WorkspaceNavigation {
  const { selection, selectedSpaceId, effectiveSpaceId, setSelectedSpaceId, setViewMode, refreshDocs } = params;

  const [gitFocus, setGitFocus] = useState<GitFocus | null>(null);
  const [selectedDmAgent, setSelectedDmAgent] = useState<string | null>(null);
  const [selectedDmConversation, setSelectedDmConversation] = useState<DirectConversation | null>(null);
  const [documentDetailDirty, setDocumentDetailDirty] = useState(false);
  const [pendingDocumentSwitch, setPendingDocumentSwitch] = useState<DocumentSummary | null>(null);

  const { clear: clearSelection, selectTask, selectMessage, selectStreamEntry, selectSubagentRun, selectDispatch, selectAssignmentTrace, selectDocument } = selection;

  const handleProjectSelect = useCallback((id: string) => {
    setSelectedSpaceId(id);
    clearSelection();
    setSelectedDmAgent(null);
    setSelectedDmConversation(null);
  }, [clearSelection, setSelectedSpaceId]);

  const handleTaskSelect = useCallback((taskId: number, projectId?: string | null) => {
    const targetProjectId = projectId?.trim() || effectiveSpaceId;
    if (targetProjectId && targetProjectId !== selectedSpaceId) {
      setSelectedSpaceId(targetProjectId);
    }
    selectTask(taskId, targetProjectId ?? null);
    setViewMode('tasks');
  }, [effectiveSpaceId, selectedSpaceId, selectTask, setSelectedSpaceId, setViewMode]);

  const handleMessageSelect = useCallback((message: Message) => {
    selectMessage(message);
  }, [selectMessage]);

  const handleStreamSelect = useCallback((entry: AgentStreamEntry) => {
    selectStreamEntry(entry);
  }, [selectStreamEntry]);

  const handleSubagentRunSelect = useCallback((run: SubagentRunSummary) => {
    selectSubagentRun(run);
  }, [selectSubagentRun]);

  const handleDispatchSelect = useCallback(async (dispatchId: number) => {
    try {
      const dispatch = await getDispatch(dispatchId);
      selectDispatch(dispatch);
    } catch (error) {
      console.error('Failed to load dispatch detail', error);
    }
  }, [selectDispatch]);

  const handleAssignmentTraceSelect = useCallback((assignmentId: string) => {
    selectAssignmentTrace(assignmentId);
  }, [selectAssignmentTrace]);

  const handleOpenDmTranscript = useCallback((agentIdentity: string) => {
    setSelectedDmAgent(agentIdentity);
    setSelectedDmConversation(null);
    setViewMode('dm');
    clearSelection();
  }, [clearSelection, setViewMode]);

  const handleSelectDmConversation = useCallback((conversation: DirectConversation) => {
    setSelectedDmConversation(conversation);
    setSelectedDmAgent(null);
  }, []);

  const handleDmBack = useCallback(() => {
    setSelectedDmConversation(null);
    setSelectedDmAgent(null);
  }, []);

  const applyDocumentSelection = useCallback((doc: DocumentSummary) => {
    if (doc.project_id && doc.project_id !== selectedSpaceId) {
      setSelectedSpaceId(doc.project_id);
    }
    selectDocument(doc);
    setDocumentDetailDirty(false);
    setPendingDocumentSwitch(null);
    setViewMode('documents');
  }, [selectDocument, selectedSpaceId, setSelectedSpaceId, setViewMode]);

  const handleDocumentSelect = useCallback((doc: DocumentSummary) => {
    const currentDoc = selection.value?.kind === 'document' ? selection.value.doc : null;
    const action = documentSelectionAction(currentDoc, doc, documentDetailDirty);
    if (action === 'keep_current') {
      setPendingDocumentSwitch(null);
      return;
    }
    if (action === 'prompt_for_dirty_switch') {
      setPendingDocumentSwitch(doc);
      return;
    }
    applyDocumentSelection(doc);
  }, [applyDocumentSelection, documentDetailDirty, selection.value]);

  const handleDocumentSaved = useCallback((doc: Document) => {
    selectDocument({
      id: doc.id,
      project_id: doc.project_id,
      slug: doc.slug,
      title: doc.title,
      doc_type: doc.doc_type,
      tags: doc.tags,
      updated_at: doc.updated_at,
    });
    refreshDocs();
  }, [refreshDocs, selectDocument]);

  const handleDocumentDirtyChange = useCallback((dirty: boolean) => {
    setDocumentDetailDirty(dirty);
    if (!dirty) {
      setPendingDocumentSwitch(null);
    }
  }, []);

  const handleCancelDocumentSwitch = useCallback(() => {
    setPendingDocumentSwitch(null);
  }, []);

  const handleMessageOpen = useCallback(async (projectId: string, messageId: number) => {
    try {
      const message = await getMessage(projectId, messageId);
      if (!message) return;
      selectMessage(message);
    } catch (error) {
      console.error('Failed to load message detail', error);
    }
  }, [selectMessage]);

  const handleThreadOpen = useCallback(async (projectId: string, threadId: number) => {
    try {
      const thread = await getThread(projectId, threadId);
      selectMessage(thread.root);
    } catch (error) {
      console.error('Failed to load thread detail', error);
    }
  }, [selectMessage]);

  const handleOpenGitFocus = useCallback((focus: GitFocus) => {
    if (focus.projectId !== selectedSpaceId) {
      setSelectedSpaceId(focus.projectId);
    }
    setGitFocus(focus);
    setViewMode('git');
    clearSelection();
  }, [clearSelection, selectedSpaceId, setSelectedSpaceId, setViewMode]);

  const handleClearGitFocus = useCallback(() => {
    setGitFocus(null);
  }, []);

  const handleStreamThreadOpen = useCallback(async (entry: AgentStreamEntry) => {
    if (!entry.project_id || entry.thread_id == null) {
      return;
    }
    await handleThreadOpen(entry.project_id, entry.thread_id);
  }, [handleThreadOpen]);

  const closeDmConversation = useCallback(() => {
    setSelectedDmConversation(null);
  }, []);

  const closeDmAgent = useCallback(() => {
    setSelectedDmAgent(null);
    setSelectedDmConversation(null);
  }, []);

  const closeDetail = useCallback(() => {
    clearSelection();
    setDocumentDetailDirty(false);
    setPendingDocumentSwitch(null);
  }, [clearSelection]);

  return {
    gitFocus,
    selectedDmAgent,
    selectedDmConversation,
    documentDetailDirty,
    pendingDocumentSwitch,
    handleProjectSelect,
    handleTaskSelect,
    handleMessageSelect,
    handleStreamSelect,
    handleSubagentRunSelect,
    handleDispatchSelect,
    handleAssignmentTraceSelect,
    handleOpenGitFocus,
    handleClearGitFocus,
    handleStreamThreadOpen,
    handleMessageOpen,
    handleThreadOpen,
    handleOpenDmTranscript,
    handleSelectDmConversation,
    handleDmBack,
    applyDocumentSelection,
    handleDocumentSelect,
    handleDocumentSaved,
    handleDocumentDirtyChange,
    handleCancelDocumentSwitch,
    closeDmConversation,
    closeDmAgent,
    closeDetail,
  };
}
