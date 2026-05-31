import { useState, useCallback, useMemo, useEffect } from 'react';
import type { AgentStreamEntry, DispatchEntry, Document, DocumentSummary, Message, Space, SubagentRunSummary, TaskSummary } from '../api/types';
import {
  getDispatch,
  listProjects,
  listSpaces,
  listTasks,
  getMessage,
  getThread,
  listAgentStream,
  listDocuments,
} from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { ProjectSidebar } from './ProjectSidebar';
import { TaskTree } from '../features/tasks/TaskTree';
import { TaskDetail } from '../features/tasks/TaskDetail';
import { FilterBar } from './FilterBar';
import { WORKSPACE_VIEW_MODES } from './workspaceViewModes';
import type { WorkspaceViewMode } from './workspaceViewModes';
import { STATUSES } from '../features/tasks/taskStatuses';
import { MessageDetail } from '../features/messages/MessageDetail';
import { MessagesInbox } from '../features/messages/MessagesInbox';
import { AgentStreamFeed } from '../features/agents/AgentStreamFeed';
import { AgentStreamDetail } from '../features/agents/AgentStreamDetail';
import { SubagentRunDetail } from '../features/agents/SubagentRunDetail';
import { AssignmentTraceView } from '../features/agents/AssignmentTraceView';
import { WorkerPoolLobbyView } from '../features/agents/WorkerPoolLobbyView';
import { DocumentList } from '../features/documents/DocumentList';
import { DocumentDetail } from '../features/documents/DocumentDetail';
import { LibrarianView } from '../features/librarian/LibrarianView';
import { GitView } from '../features/git/GitView';
import { DispatchDetail } from '../features/agents/DispatchDetail';
import { ChannelChatPanel } from '../features/channels/ChannelChatPanel';
import type { ChannelChatPanelSize } from '../features/channels/ChannelChatPanel';
import { FocusedSessionView } from '../features/sessions/FocusedSessionView';
import { AgentsOverviewView } from '../features/agents/AgentsOverviewView';
import { agentStreamEntryVisibility } from '../features/agents/subagentRuns';
import { FleetOpsCockpit } from '../features/fleetops/FleetOpsCockpit';
import { documentSelectionAction } from '../features/documents/documentEditor';
import type { GitFocus } from '../features/git/git';
import { usePreferences } from '../features/preferences/usePreferences';
import { PreferencesDialog } from '../features/preferences/PreferencesDialog';
import { matchHotkey } from '../features/preferences/hotkeyParse';
import { NotificationHistoryPanel } from '../features/notifications/NotificationHistoryPanel';
import { isNotificationPanelRoute } from '../features/notifications/notificationWindow';

const ALL_SPACES_ID = '_all';
const GLOBAL_SPACE_ID = '_global';

const ALL_SPACES: Space = {
  id: ALL_SPACES_ID,
  name: 'All spaces',
  kind: 'system',
  visibility: 'hidden',
  owner: null,
  root_path: null,
  description: 'Aggregate views across accessible spaces',
  created_at: null,
  updated_at: null,
};

function withAllSpacesAggregate(spaces: Space[] | null | undefined): Space[] {
  const list = spaces ?? [];
  return list.some(space => space.id === ALL_SPACES.id) ? list : [ALL_SPACES, ...list];
}

function defaultSpaceId(spaces: Space[]): string | null {
  return spaces.find(space => space.kind === 'project' && space.visibility === 'normal')?.id
    ?? spaces.find(space => space.id !== ALL_SPACES.id)?.id
    ?? spaces[0]?.id
    ?? null;
}

function spaceSupportsGit(space: Space | null | undefined, isAllSpaces: boolean): boolean {
  return isAllSpaces || space?.kind === 'project' || Boolean(space?.root_path?.trim());
}

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

export default function App() {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedTaskProjectId, setSelectedTaskProjectId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedStreamEntry, setSelectedStreamEntry] = useState<AgentStreamEntry | null>(null);
  const [selectedSubagentRun, setSelectedSubagentRun] = useState<SubagentRunSummary | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchEntry | null>(null);
  const [selectedAssignmentTrace, setSelectedAssignmentTrace] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentSummary | null>(null);
  const [documentDetailDirty, setDocumentDetailDirty] = useState(false);
  const [pendingDocumentSwitch, setPendingDocumentSwitch] = useState<DocumentSummary | null>(null);
  const [gitFocus, setGitFocus] = useState<GitFocus | null>(null);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('tasks');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [streamKindFilter, setStreamKindFilter] = useState<'ops' | 'message'>('ops');
  const [streamEventFilter, setStreamEventFilter] = useState('');
  const [streamProjectFilter, setStreamProjectFilter] = useState('');
  const [streamSenderFilter, setStreamSenderFilter] = useState('');
  const [streamRecipientFilter, setStreamRecipientFilter] = useState('');
  const [streamTaskFilter, setStreamTaskFilter] = useState('');
  const [showRawSubagentWorkEvents, setShowRawSubagentWorkEvents] = useState(false);
  const [sortMode, setSortMode] = useState('priority');
  const [channelPanelSize, setChannelPanelSize] = useState<ChannelChatPanelSize>('medium');
  const [showPreferences, setShowPreferences] = useState(false);
  const { prefs, updateSection, resetToDefaults } = usePreferences();

  // Agents sub-view toggle: 'overview' (default) or 'worker-pool'
  const [agentsSubView, setAgentsSubView] = useState<'overview' | 'worker-pool'>('overview');

  // Standalone notification popup: detect #/notification-panel hash route
  const [standalonePopup, setStandalonePopup] = useState(false);

  useEffect(() => {
    function checkHash() {
      setStandalonePopup(isNotificationPanelRoute());
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const fetchProjects = useCallback(() => listProjects(), []);
  const { data: projects } = usePolling(fetchProjects, 5000);
  const fetchSpaces = useCallback(() => listSpaces({ includeHidden: true, includeArchived: true }), []);
  const { data: fetchedSpaces } = usePolling(fetchSpaces, 5000);
  const spaces = useMemo(() => withAllSpacesAggregate(fetchedSpaces), [fetchedSpaces]);

  // Auto-select a normal project-kind space when possible to preserve existing project-centric startup.
  const effectiveSpaceId = selectedSpaceId ?? defaultSpaceId(spaces);
  const activeSpace = spaces.find(space => space.id === effectiveSpaceId) ?? null;
  const isAllSpaces = effectiveSpaceId === ALL_SPACES_ID;
  const isGlobal = effectiveSpaceId === GLOBAL_SPACE_ID;
  const isAggregateSpace = isAllSpaces;
  const activeSpaceSupportsGit = spaceSupportsGit(activeSpace, isAllSpaces);

  const taskSpaces = useMemo(
    () => spaces.filter(space => space.id !== ALL_SPACES_ID),
    [spaces],
  );
  const taskSpaceNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const space of taskSpaces) {
      names.set(space.id, space.name || space.id);
    }
    return names;
  }, [taskSpaces]);

  const fetchTasks = useCallback(async () => {
    if (!effectiveSpaceId) return [];

    const options = { tree: true, status: statusFilter ?? undefined };
    if (!isAllSpaces) {
      return listTasks(effectiveSpaceId, options);
    }

    const taskResults = await Promise.allSettled(
      taskSpaces.map(space => listTasks(space.id, options)),
    );
    const aggregateTasks: TaskSummary[] = [];
    for (const result of taskResults) {
      if (result.status === 'fulfilled') {
        aggregateTasks.push(...result.value);
      } else {
        console.warn('Failed to load tasks for an All spaces task source', result.reason);
      }
    }
    return aggregateTasks;
  }, [effectiveSpaceId, isAllSpaces, statusFilter, taskSpaces]);
  const { data: tasks } = usePolling(fetchTasks, 5000);

  const parsedStreamTaskId = useMemo(() => {
    const trimmed = streamTaskFilter.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  }, [streamTaskFilter]);

  const fetchAgentStream = useCallback(
    () => effectiveSpaceId
      ? listAgentStream({
        projectId: isAggregateSpace ? (streamProjectFilter.trim() || undefined) : effectiveSpaceId,
        taskId: parsedStreamTaskId,
        streamKind: streamKindFilter,
        eventType: streamEventFilter || undefined,
        sender: streamSenderFilter.trim() || undefined,
        limit: 100,
      })
      : Promise.resolve([]),
    [
      effectiveSpaceId,
      isAggregateSpace,
      parsedStreamTaskId,
      streamEventFilter,
      streamKindFilter,
      streamProjectFilter,
      streamSenderFilter,
    ],
  );
  const { data: agentStream } = usePolling(fetchAgentStream, 5000);

  const fetchDocs = useCallback(
    () => effectiveSpaceId
      ? listDocuments(isAllSpaces ? undefined : effectiveSpaceId)
      : Promise.resolve([]),
    [effectiveSpaceId, isAllSpaces],
  );
  const { data: documents, refresh: refreshDocs } = usePolling(fetchDocs, 5000);

  const sortedDocs = useMemo(
    () => documents ? [...documents].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : [],
    [documents],
  );
  const filteredAgentStream = useMemo(() => {
    const recipientFilter = streamRecipientFilter.trim().toLowerCase();
    return (agentStream ?? []).filter(entry => {
      if (!showRawSubagentWorkEvents && !streamEventFilter && agentStreamEntryVisibility(entry) === 'debug') {
        return false;
      }
      if (!recipientFilter) {
        return true;
      }
      const recipients = [
        entry.recipient_agent,
        entry.recipient_role,
        entry.recipient_instance_id,
      ]
        .filter((value): value is string => Boolean(value))
        .map(value => value.toLowerCase());
      return recipients.some(value => value.includes(recipientFilter));
    });
  }, [agentStream, showRawSubagentWorkEvents, streamEventFilter, streamRecipientFilter]);
  const streamEventOptions = useMemo(() => {
    const options = new Set((agentStream ?? []).map(entry => entry.event_type));
    if (streamEventFilter) {
      options.add(streamEventFilter);
    }
    return Array.from(options).sort((left, right) => left.localeCompare(right));
  }, [agentStream, streamEventFilter]);

  const taskCount = tasks?.length ?? 0;
  const filterLabel = statusFilter ? ` [${statusFilter}]` : '';
  const sortLabel = sortMode !== 'priority' ? ` ↕${sortMode}` : '';
  const mainTitle = viewMode === 'tasks'
    ? 'Tasks'
    : viewMode === 'messages'
      ? 'Messages'
      : viewMode === 'documents'
        ? 'Documents'
        : viewMode === 'git'
          ? 'Git'
          : viewMode === 'sessions'
            ? 'Sessions'
            : viewMode === 'agent-stream'
              ? 'Agent Stream'
              : viewMode === 'agents'
                ? 'Agents'
                : viewMode === 'fleet-ops'
                  ? 'Fleet Ops'
                  : viewMode === 'notifications'
                    ? 'Notifications'
                    : 'Librarian';
  const mainCount = viewMode === 'tasks'
    ? `(${taskCount}${filterLabel}${sortLabel})`
    : viewMode === 'documents'
      ? `(${sortedDocs.length})`
      : viewMode === 'agent-stream'
        ? `(${filteredAgentStream.length})`
        : null;

  const handleProjectSelect = useCallback((id: string) => {
    setSelectedSpaceId(id);
    setSelectedTaskId(null);
    setSelectedTaskProjectId(null);
    setSelectedMessage(null);
    setSelectedStreamEntry(null);
    setSelectedSubagentRun(null);
    setSelectedDispatch(null);
    setSelectedDoc(null);
  }, []);

  const handleTaskSelect = useCallback((taskId: number, projectId?: string | null) => {
    const targetProjectId = projectId?.trim() || effectiveSpaceId;
    if (targetProjectId && targetProjectId !== selectedSpaceId) {
      setSelectedSpaceId(targetProjectId);
    }
    setSelectedTaskId(taskId);
    setSelectedTaskProjectId(targetProjectId ?? null);
    setSelectedMessage(null);
    setSelectedStreamEntry(null);
    setSelectedSubagentRun(null);
    setSelectedDispatch(null);
    setSelectedDoc(null);
    setViewMode('tasks');
  }, [effectiveSpaceId, selectedSpaceId]);

  const handleMessageSelect = useCallback((message: Message) => {
    setSelectedMessage(message);
    setSelectedStreamEntry(null);
    setSelectedSubagentRun(null);
    setSelectedDispatch(null);
    setSelectedDoc(null);
  }, []);

  const handleStreamSelect = useCallback((entry: AgentStreamEntry) => {
    setSelectedStreamEntry(entry);
    setSelectedSubagentRun(null);
    setSelectedDispatch(null);
    setSelectedDoc(null);
    setViewMode('agent-stream');
  }, []);

  const handleSubagentRunSelect = useCallback((run: SubagentRunSummary) => {
    setSelectedSubagentRun(run);
    setSelectedStreamEntry(null);
    setSelectedDispatch(null);
    setSelectedDoc(null);
  }, []);

  const handleDispatchSelect = useCallback(async (dispatchId: number) => {
    try {
      const dispatch = await getDispatch(dispatchId);
      setSelectedDispatch(dispatch);
      setSelectedStreamEntry(null);
      setSelectedSubagentRun(null);
      setSelectedDoc(null);
    } catch (error) {
      console.error('Failed to load dispatch detail', error);
    }
  }, []);

  const handleAssignmentTraceSelect = useCallback((assignmentId: string) => {
    setSelectedAssignmentTrace(assignmentId);
    setSelectedStreamEntry(null);
    setSelectedSubagentRun(null);
    setSelectedDoc(null);
    setSelectedDispatch(null);
  }, []);

  const applyDocumentSelection = useCallback((doc: DocumentSummary) => {
    if (doc.project_id && doc.project_id !== selectedSpaceId) {
      setSelectedSpaceId(doc.project_id);
    }
    setSelectedDoc(doc);
    setDocumentDetailDirty(false);
    setPendingDocumentSwitch(null);
    setSelectedTaskId(null);
    setSelectedTaskProjectId(null);
    setSelectedMessage(null);
    setSelectedStreamEntry(null);
    setSelectedSubagentRun(null);
    setSelectedDispatch(null);
    setViewMode('documents');
  }, [selectedSpaceId]);

  const handleDocumentSelect = useCallback((doc: DocumentSummary) => {
    const action = documentSelectionAction(selectedDoc, doc, documentDetailDirty);
    if (action === 'keep_current') {
      setPendingDocumentSwitch(null);
      return;
    }
    if (action === 'prompt_for_dirty_switch') {
      setPendingDocumentSwitch(doc);
      return;
    }
    applyDocumentSelection(doc);
  }, [applyDocumentSelection, documentDetailDirty, selectedDoc]);

  const handleDocumentSaved = useCallback((doc: Document) => {
    setSelectedDoc({
      id: doc.id,
      project_id: doc.project_id,
      slug: doc.slug,
      title: doc.title,
      doc_type: doc.doc_type,
      tags: doc.tags,
      updated_at: doc.updated_at,
    });
    refreshDocs();
  }, [refreshDocs]);

  const handleDocumentDirtyChange = useCallback((dirty: boolean) => {
    setDocumentDetailDirty(dirty);
    if (!dirty) {
      setPendingDocumentSwitch(null);
    }
  }, []);

  const handleMessageOpen = useCallback(async (projectId: string, messageId: number) => {
    try {
      const message = await getMessage(projectId, messageId);
      if (!message) return;
      setSelectedMessage(message);
      setSelectedStreamEntry(null);
      setSelectedSubagentRun(null);
      setSelectedDispatch(null);
      setSelectedDoc(null);
    } catch (error) {
      console.error('Failed to load message detail', error);
    }
  }, []);

  const handleThreadOpen = useCallback(async (projectId: string, threadId: number) => {
    try {
      const thread = await getThread(projectId, threadId);
      setSelectedMessage(thread.root);
      setSelectedStreamEntry(null);
      setSelectedSubagentRun(null);
      setSelectedDispatch(null);
      setSelectedDoc(null);
    } catch (error) {
      console.error('Failed to load thread detail', error);
    }
  }, []);

  const handleOpenGitFocus = useCallback((focus: GitFocus) => {
    if (focus.projectId !== selectedSpaceId) {
      setSelectedSpaceId(focus.projectId);
    }
    setGitFocus(focus);
    setViewMode('git');
    setSelectedTaskId(null);
    setSelectedTaskProjectId(null);
    setSelectedMessage(null);
    setSelectedStreamEntry(null);
    setSelectedSubagentRun(null);
    setSelectedDispatch(null);
    setSelectedDoc(null);
  }, [selectedSpaceId]);

  const handleStreamThreadOpen = useCallback(async (entry: AgentStreamEntry) => {
    if (!entry.project_id || entry.thread_id == null) {
      return;
    }

    await handleThreadOpen(entry.project_id, entry.thread_id);
  }, [handleThreadOpen]);

  useEffect(() => {
    const kb = prefs.keyboard;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      // All navigation shortcuts require the user to not be typing in an editable element
      if (editableTarget(event.target)) return;

      // 1) Open preferences (existing behavior)
      if (kb.openPreferences && matchHotkey(event, kb.openPreferences)) {
        event.preventDefault();
        setShowPreferences(true);
        return;
      }

      // 2) Close panel (existing behavior, now through the same configurable matcher)
      if (kb.closePanel && matchHotkey(event, kb.closePanel)) {
        if (showPreferences) {
          event.preventDefault();
          setShowPreferences(false);
          return;
        }
        if (selectedDoc || selectedDispatch || selectedSubagentRun || selectedStreamEntry || selectedMessage || selectedTaskId != null || selectedAssignmentTrace) {
          event.preventDefault();
          if (selectedAssignmentTrace) {
            setSelectedAssignmentTrace(null);
          } else if (selectedDoc) {
            setSelectedDoc(null);
            setDocumentDetailDirty(false);
            setPendingDocumentSwitch(null);
          } else if (selectedDispatch) {
            setSelectedDispatch(null);
          } else if (selectedSubagentRun) {
            setSelectedSubagentRun(null);
          } else if (selectedStreamEntry) {
            setSelectedStreamEntry(null);
          } else if (selectedMessage) {
            setSelectedMessage(null);
          } else {
            setSelectedTaskId(null);
            setSelectedTaskProjectId(null);
          }
        }
        return;
      }

      // 3) Switch project/space — cycle forward through spaces order
      if (kb.switchProject && matchHotkey(event, kb.switchProject)) {
        event.preventDefault();
        if (spaces.length > 0) {
          const currentIdx = effectiveSpaceId
            ? spaces.findIndex(s => s.id === effectiveSpaceId)
            : -1;
          const nextIdx = (currentIdx + 1) % spaces.length;
          handleProjectSelect(spaces[nextIdx].id);
        }
        return;
      }

      // 4) Cycle main panel forward
      if (kb.cycleMainPanel && matchHotkey(event, kb.cycleMainPanel)) {
        event.preventDefault();
        const currentIdx = WORKSPACE_VIEW_MODES.indexOf(viewMode);
        const nextIdx = (currentIdx + 1) % WORKSPACE_VIEW_MODES.length;
        setViewMode(WORKSPACE_VIEW_MODES[nextIdx]);
        return;
      }

      // 5) Cycle task status filter (matters mostly in tasks mode)
      if (kb.cycleTaskFilter && matchHotkey(event, kb.cycleTaskFilter)) {
        if (viewMode !== 'tasks') return;
        event.preventDefault();
        const allIncludingAll = ['', ...STATUSES];
        const currentIdx = statusFilter
          ? allIncludingAll.indexOf(statusFilter)
          : 0;
        const nextIdx = (currentIdx + 1) % allIncludingAll.length;
        setStatusFilter(allIncludingAll[nextIdx] || null);
        return;
      }

      // 6) Direct panel jumps
      if (kb.jumpToTasks && matchHotkey(event, kb.jumpToTasks)) {
        event.preventDefault();
        setViewMode('tasks');
        return;
      }
      if (kb.jumpToAgents && matchHotkey(event, kb.jumpToAgents)) {
        event.preventDefault();
        setViewMode('agents');
        return;
      }
      if (kb.jumpToMessages && matchHotkey(event, kb.jumpToMessages)) {
        event.preventDefault();
        setViewMode('messages');
        return;
      }
      if (kb.jumpToDocs && matchHotkey(event, kb.jumpToDocs)) {
        event.preventDefault();
        setViewMode('documents');
        return;
      }
      if (kb.jumpToGit && matchHotkey(event, kb.jumpToGit)) {
        event.preventDefault();
        setViewMode('git');
        return;
      }
      if (kb.jumpToSessions && matchHotkey(event, kb.jumpToSessions)) {
        event.preventDefault();
        setViewMode('sessions');
        return;
      }
      if (kb.jumpToLibrarian && matchHotkey(event, kb.jumpToLibrarian)) {
        event.preventDefault();
        setViewMode('librarian');
        return;
      }
      if (kb.jumpToAgentStream && matchHotkey(event, kb.jumpToAgentStream)) {
        event.preventDefault();
        setViewMode('agent-stream');
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    prefs.keyboard,
    selectedDispatch,
    selectedDoc,
    selectedMessage,
    selectedStreamEntry,
    selectedSubagentRun,
    selectedTaskId,
    selectedAssignmentTrace,
    showPreferences,
    spaces,
    effectiveSpaceId,
    handleProjectSelect,
    viewMode,
    statusFilter,
    setViewMode,
  ]);

  // Standalone notification popup: render full-screen panel when #/notification-panel hash is present
  if (standalonePopup) {
      const notificationProjectIds = effectiveSpaceId && effectiveSpaceId !== ALL_SPACES_ID && effectiveSpaceId !== GLOBAL_SPACE_ID
        ? [effectiveSpaceId]
        : (spaces ?? []).filter(s => s.id !== ALL_SPACES_ID).map(s => s.id);
      return <NotificationHistoryPanel projectIds={notificationProjectIds} standalone />;
    }

    return (
    <div className={`dashboard dashboard-channel-size-${channelPanelSize}`}>
      <div className="dashboard-workspace">
        <ProjectSidebar
          spaces={spaces}
          selectedId={effectiveSpaceId}
          onSelect={handleProjectSelect}
        />

        <div className="panel panel-main">
          <div className="panel-header">
            {mainTitle}
            {effectiveSpaceId && mainCount && <span className="count">{mainCount}</span>}
          </div>
          <FilterBar
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortMode={sortMode}
            onSortChange={setSortMode}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          {viewMode === 'agent-stream' && (
            <div className="feed-toolbar agent-stream-toolbar">
              <label className="panel-filter-label" htmlFor="stream-kind-filter">Kind</label>
              <select
                id="stream-kind-filter"
                className="panel-filter-select"
                value={streamKindFilter}
                onChange={e => setStreamKindFilter(e.target.value as 'ops' | 'message')}
              >
                <option value="ops">Ops</option>
                <option value="message">Messages</option>
              </select>

              <label className="panel-filter-label" htmlFor="stream-event-filter">Event</label>
              <select
                id="stream-event-filter"
                className="panel-filter-select"
                value={streamEventFilter}
                onChange={e => setStreamEventFilter(e.target.value)}
              >
                <option value="">All</option>
                {streamEventOptions.map(eventType => (
                  <option key={eventType} value={eventType}>{eventType}</option>
                ))}
              </select>

              {isAggregateSpace && (
                <input
                  className="feed-text-filter"
                  value={streamProjectFilter}
                  onChange={e => setStreamProjectFilter(e.target.value)}
                  placeholder="Space"
                />
              )}

              <input
                className="feed-text-filter"
                value={streamSenderFilter}
                onChange={e => setStreamSenderFilter(e.target.value)}
                placeholder="Sender"
              />

              <input
                className="feed-text-filter"
                value={streamRecipientFilter}
                onChange={e => setStreamRecipientFilter(e.target.value)}
                placeholder="Recipient"
              />

              <input
                className="feed-text-filter feed-text-filter-short"
                value={streamTaskFilter}
                onChange={e => setStreamTaskFilter(e.target.value)}
                placeholder="Task #"
              />

              <label
                className="thought-raw-toggle"
                title="Show verbose subagent_work_* audit events in the normal stream feed"
              >
                <input
                  type="checkbox"
                  checked={showRawSubagentWorkEvents}
                  onChange={e => setShowRawSubagentWorkEvents(e.target.checked)}
                />
                Raw sub-agent work
              </label>
            </div>
          )}
          <div className="panel-body">
            {viewMode === 'tasks' ? (
              <TaskTree
                tasks={tasks ?? []}
                selectedTaskId={selectedTaskId}
                onSelect={handleTaskSelect}
                statusFilter={statusFilter}
                sortMode={sortMode}
                showProjectLabels={isAllSpaces}
                projectNames={taskSpaceNames}
              />
            ) : viewMode === 'messages' ? (
              <MessagesInbox
                spaces={spaces}
                currentSpaceId={effectiveSpaceId}
                isAggregate={isAggregateSpace}
                onSelect={handleMessageSelect}
                onOpenTask={handleTaskSelect}
              />
            ) : viewMode === 'documents' ? (
              <DocumentList
                documents={sortedDocs}
                projectId={effectiveSpaceId}
                isGlobal={isAggregateSpace}
                onSelect={handleDocumentSelect}
              />
            ) : viewMode === 'git' ? (
              <GitView
                projectId={activeSpaceSupportsGit ? effectiveSpaceId : null}
                projects={projects ?? []}
                isGlobal={isAggregateSpace}
                scopeSupportsGit={activeSpaceSupportsGit}
                focus={gitFocus}
                onClearFocus={() => setGitFocus(null)}
              />
            ) : viewMode === 'agent-stream' ? (
              <AgentStreamFeed
                entries={filteredAgentStream}
                isGlobal={isAggregateSpace}
                onSelect={handleStreamSelect}
                onOpenTask={handleTaskSelect}
                onOpenThread={entry => void handleStreamThreadOpen(entry)}
                onOpenDispatch={dispatchId => void handleDispatchSelect(dispatchId)}
              />
            ) : viewMode === 'sessions' ? (
              <FocusedSessionView
                projectId={!isAggregateSpace && !isGlobal ? effectiveSpaceId : null}
                spaceName={activeSpace?.name ?? effectiveSpaceId}
              />
            ) : viewMode === 'agents' ? (
              <>
                <div className="agents-sub-view-tabs">
                  <button
                    className={`agents-sub-view-tab ${agentsSubView === 'overview' ? 'active' : ''}`}
                    onClick={() => setAgentsSubView('overview')}
                  >
                    Overview
                  </button>
                  <button
                    className={`agents-sub-view-tab ${agentsSubView === 'worker-pool' ? 'active' : ''}`}
                    onClick={() => setAgentsSubView('worker-pool')}
                  >
                    Worker Pool
                  </button>
                </div>
                {agentsSubView === 'overview' ? (
                  <AgentsOverviewView
                    projectId={!isAggregateSpace && !isGlobal ? effectiveSpaceId : null}
                    isAggregate={isAggregateSpace}
                    closePanelKey={prefs.keyboard.closePanel}
                    onOpenAssignmentTrace={handleAssignmentTraceSelect}
                  />
                ) : (
                  <WorkerPoolLobbyView
                    onOpenAssignmentTrace={handleAssignmentTraceSelect}
                  />
                )}
              </>
            ) : viewMode === 'fleet-ops' ? (
              <FleetOpsCockpit />
            ) : viewMode === 'notifications' ? (
              <NotificationHistoryPanel
                projectIds={effectiveSpaceId && effectiveSpaceId !== ALL_SPACES_ID && effectiveSpaceId !== GLOBAL_SPACE_ID
                  ? [effectiveSpaceId]
                  : (spaces ?? []).filter(s => s.id !== ALL_SPACES_ID).map(s => s.id)
                }
                onOpenTask={handleTaskSelect}
              />
            ) : (
              <LibrarianView
                projects={spaces}
                currentProjectId={effectiveSpaceId}
                onOpenTask={handleTaskSelect}
                onOpenDocument={handleDocumentSelect}
                onOpenMessage={(projectId, messageId) => void handleMessageOpen(projectId, messageId)}
                onOpenThread={(projectId, threadId) => void handleThreadOpen(projectId, threadId)}
              />
            )}
          </div>
        </div>
      </div>

      <ChannelChatPanel
        projectId={!isAggregateSpace && !isGlobal ? effectiveSpaceId : null}
        spaceName={activeSpace?.name ?? effectiveSpaceId}
        panelSize={channelPanelSize}
        scrollResetKey={effectiveSpaceId}
        onPanelSizeChange={setChannelPanelSize}
        onOpenPreferences={() => setShowPreferences(true)}
        onOpenAssignmentTrace={handleAssignmentTraceSelect}
      />

      {/* Detail overlays */}
      {selectedTaskId != null && effectiveSpaceId && (
        <TaskDetail
          key={`${selectedTaskProjectId ?? effectiveSpaceId}:${selectedTaskId}`}
          projectId={selectedTaskProjectId ?? effectiveSpaceId}
          taskId={selectedTaskId}
          onSelectTask={handleTaskSelect}
          onSelectMessage={handleMessageSelect}
          onSelectRun={handleSubagentRunSelect}
          onOpenGit={handleOpenGitFocus}
          onClose={() => {
            setSelectedTaskId(null);
            setSelectedTaskProjectId(null);
          }}
        />
      )}

      {selectedMessage && (
        <MessageDetail
          key={`${selectedMessage.project_id}:${selectedMessage.id}`}
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}

      {selectedStreamEntry && (
        <AgentStreamDetail
          key={selectedStreamEntry.id}
          entry={selectedStreamEntry}
          onClose={() => setSelectedStreamEntry(null)}
          onOpenTask={handleTaskSelect}
          onOpenThread={entry => void handleStreamThreadOpen(entry)}
          onOpenDispatch={dispatchId => void handleDispatchSelect(dispatchId)}
        />
      )}

      {selectedSubagentRun && (
        <SubagentRunDetail
          key={selectedSubagentRun.run_id}
          run={selectedSubagentRun}
          onClose={() => setSelectedSubagentRun(null)}
          onOpenTask={handleTaskSelect}
          onOpenEntry={handleStreamSelect}
        />
      )}

      {selectedDispatch && (
        <DispatchDetail
          dispatch={selectedDispatch}
          onClose={() => setSelectedDispatch(null)}
          onOpenTask={handleTaskSelect}
        />
      )}

      {selectedAssignmentTrace && (
        <AssignmentTraceView
          key={selectedAssignmentTrace}
          assignmentId={selectedAssignmentTrace}
          projectId={!isAggregateSpace && !isGlobal ? effectiveSpaceId : null}
          closePanelKey={prefs.keyboard.closePanel}
          onClose={() => setSelectedAssignmentTrace(null)}
        />
      )}

      {selectedDoc && (
        <DocumentDetail
          summary={selectedDoc}
          onClose={() => {
            setSelectedDoc(null);
            setDocumentDetailDirty(false);
            setPendingDocumentSwitch(null);
          }}
          onSaved={handleDocumentSaved}
          onOpenDocument={handleDocumentSelect}
          onDirtyChange={handleDocumentDirtyChange}
          pendingSwitch={pendingDocumentSwitch}
          onCancelSwitch={() => setPendingDocumentSwitch(null)}
          onConfirmSwitch={applyDocumentSelection}
        />
      )}

      {showPreferences && (
        <PreferencesDialog
          prefs={prefs}
          onUpdateSection={updateSection}
          onReset={resetToDefaults}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </div>
  );
}
