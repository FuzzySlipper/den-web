import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskSummary } from '@den-web/api/types';
import {
  listProjects,
  listSpaces,
  listTasks,
  listDocuments,
} from '@den-web/api/client';
import { useLiveData } from '@den-web/ui/hooks/useLiveData';
import { ProjectSidebar } from './ProjectSidebar';
import {
  coreStatusForTaskFilter,
  taskFilterLabel,
  taskMatchesStatusFilter,
} from '@den-web/features/tasks/taskStatuses';
import { isDependencyWaitingTask } from '@den-web/features/tasks/taskAvailability';
import { usePreferences } from '@den-web/features/preferences/usePreferences';
import { PreferencesDialog } from '@den-web/features/preferences/PreferencesDialog';
import { ChannelChatPanel } from '@den-web/features/channels/ChannelChatPanel';
import type { ChannelChatPanelSize } from '@den-web/features/channels/ChannelChatPanel';
import { NotificationHistoryPanel } from '@den-web/features/notifications/NotificationHistoryPanel';
import { isNotificationPanelRoute } from '@den-web/features/notifications/notificationWindow';
import { fetchNotificationFeed } from '@den-web/features/notifications/notificationFeed';
import {
  closeNotificationSidePanel,
  shouldRenderNotificationSidePanel,
  toggleNotificationSidePanel,
} from '@den-web/features/notifications/notificationSidePanelState';
import {
  ALL_SPACES_ID,
  GLOBAL_SPACE_ID,
  defaultSpaceId,
  filterSpacesByVisibility,
  nextSpaceId,
  notificationScopeProjectIds,
  spaceSupportsGit,
  withAllSpacesAggregate,
} from './spaces';
import {
  mainPanelCountLabel,
  mainPanelTitle,
  nextTaskFilter,
  nextViewMode,
} from './workspaceState';
import { useWorkspaceState } from './useWorkspaceState';
import { useDetailSelection } from './useDetailSelection';
import { useNotificationBell } from './useNotificationBell';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { MobileTopBar } from './MobileTopBar';
import { MainPanel } from './MainPanel';
import { DetailOverlays } from './DetailOverlays';
import { NotificationSidePanel } from './NotificationSidePanel';

export default function App() {
  // Standalone notification popup: detect the #/notification-panel hash route.
  const [standalonePopup, setStandalonePopup] = useState(false);
  useEffect(() => {
    function checkHash() {
      setStandalonePopup(isNotificationPanelRoute());
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // --- Shell-local state ---------------------------------------------------
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [channelPanelSize, setChannelPanelSize] = useState<ChannelChatPanelSize>('medium');
  const [showPreferences, setShowPreferences] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showHiddenSpaces, setShowHiddenSpaces] = useState(false);
  const [showArchivedSpaces, setShowArchivedSpaces] = useState(false);

  const { prefs, updateSection, resetToDefaults } = usePreferences();
  const workspace = useWorkspaceState();
  const selection = useDetailSelection();

  // --- Data (polling lives here; #2140 introduces the useLiveData boundary) ---
  const fetchProjects = useCallback(() => listProjects(), []);
  const { data: projects } = useLiveData(fetchProjects, { interval: 5000 });
  const fetchOperatorNotifications = useCallback(() => fetchNotificationFeed([]), []);
  const { data: operatorNotificationFeed } = useLiveData(fetchOperatorNotifications, { interval: 10000 });
  const fetchSpaces = useCallback(() => listSpaces({ includeHidden: true, includeArchived: true }), []);
  const { data: fetchedSpaces } = useLiveData(fetchSpaces, { interval: 5000 });
  const visibleFetchedSpaces = useMemo(
    () => filterSpacesByVisibility(fetchedSpaces, {
      showHidden: showHiddenSpaces,
      showArchived: showArchivedSpaces,
    }),
    [fetchedSpaces, showArchivedSpaces, showHiddenSpaces],
  );
  const spaces = useMemo(() => withAllSpacesAggregate(visibleFetchedSpaces), [visibleFetchedSpaces]);
  const hiddenSpaceCount = useMemo(
    () => (fetchedSpaces ?? []).filter(space => space.visibility === 'hidden').length,
    [fetchedSpaces],
  );
  const archivedSpaceCount = useMemo(
    () => (fetchedSpaces ?? []).filter(space => space.visibility === 'archived').length,
    [fetchedSpaces],
  );

  const bell = useNotificationBell(operatorNotificationFeed, prefs.layout.notificationHistoryMode);

  // Auto-select a normal project-kind space when possible to preserve project-centric startup.
  const effectiveSpaceId = selectedSpaceId ?? defaultSpaceId(spaces);
  const activeSpace = spaces.find(space => space.id === effectiveSpaceId) ?? null;
  const isAllSpaces = effectiveSpaceId === ALL_SPACES_ID;
  const isGlobal = effectiveSpaceId === GLOBAL_SPACE_ID;
  const isAggregateSpace = isAllSpaces;
  const activeSpaceSupportsGit = spaceSupportsGit(activeSpace, isAllSpaces);
  const scopedProjectId = !isAggregateSpace && !isGlobal ? effectiveSpaceId : null;

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

    const coreStatusFilter = coreStatusForTaskFilter(workspace.statusFilter);
    const options = { tree: true, status: coreStatusFilter ?? undefined };
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
  }, [effectiveSpaceId, isAllSpaces, workspace.statusFilter, taskSpaces]);
  const { data: tasks } = useLiveData(fetchTasks, { interval: 5000 });

  const fetchDocs = useCallback(
    () => effectiveSpaceId
      ? listDocuments(isAllSpaces ? undefined : effectiveSpaceId)
      : Promise.resolve([]),
    [effectiveSpaceId, isAllSpaces],
  );
  const { data: documents, refresh: refreshDocs } = useLiveData(fetchDocs, { interval: 5000 });

  const sortedDocs = useMemo(
    () => documents ? [...documents].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : [],
    [documents],
  );
  const displayedTasks = useMemo(() => {
    const currentTasks = tasks ?? [];
    return currentTasks.filter(task => taskMatchesStatusFilter(task, workspace.statusFilter));
  }, [workspace.statusFilter, tasks]);

  const taskCount = displayedTasks.length;
  const dependencyWaitingTaskCount = (tasks ?? []).filter(isDependencyWaitingTask).length;
  const manualBlockedTaskCount = (tasks ?? []).filter(task => task.status === 'blocked' && !isDependencyWaitingTask(task)).length;

  // --- Navigation + keyboard ----------------------------------------------
  const nav = useWorkspaceNavigation({
    selection,
    selectedSpaceId,
    effectiveSpaceId,
    setSelectedSpaceId,
    setViewMode: workspace.setViewMode,
    refreshDocs,
  });

  useKeyboardShortcuts({
    keyboard: prefs.keyboard,
    context: {
      showPreferences,
      viewMode: workspace.viewMode,
      dmConversationOpen: nav.selectedDmConversation != null,
      dmAgentOpen: nav.selectedDmAgent != null,
      hasDetailSelection: selection.value !== null,
    },
    actions: {
      closePreferences: () => setShowPreferences(false),
      closeDmConversation: nav.closeDmConversation,
      closeDmAgent: nav.closeDmAgent,
      closeDetail: nav.closeDetail,
      openPreferences: () => setShowPreferences(true),
      switchProject: () => {
        const next = nextSpaceId(spaces, effectiveSpaceId);
        if (next) nav.handleProjectSelect(next);
      },
      cycleMainPanel: () => workspace.setViewMode(nextViewMode(workspace.viewMode)),
      cycleTaskFilter: () => workspace.setStatusFilter(nextTaskFilter(workspace.statusFilter)),
      jump: view => workspace.setViewMode(view),
    },
  });

  // --- Derived presentation ------------------------------------------------
  const filterLabel = workspace.statusFilter ? ` [${taskFilterLabel(workspace.statusFilter)}]` : '';
  const sortLabel = workspace.sortMode !== 'priority' ? ` ↕${workspace.sortMode}` : '';
  const mainTitle = mainPanelTitle(workspace.viewMode);
  const mainCount = mainPanelCountLabel(workspace.viewMode, {
    taskCount,
    filterLabel,
    sortLabel,
    docCount: sortedDocs.length,
  });
  const selectedTaskId = selection.value?.kind === 'task' ? selection.value.taskId : null;

  // Standalone notification popup: render full-screen panel when the hash route is present.
  if (standalonePopup) {
    return <NotificationHistoryPanel projectIds={notificationScopeProjectIds(effectiveSpaceId, spaces)} standalone />;
  }

  const renderNotificationSidePanel = shouldRenderNotificationSidePanel(
    showNotificationPanel,
    prefs.layout.notificationHistoryMode,
  );

  const dashboardClasses = [
    'dashboard',
    `dashboard-channel-size-${channelPanelSize}`,
    `dashboard-mobile-section-${workspace.mobilePrimarySection}`,
    renderNotificationSidePanel ? 'dashboard-notification-docked' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={dashboardClasses}>
      <MobileTopBar
        spaces={spaces}
        effectiveSpaceId={effectiveSpaceId}
        viewMode={workspace.viewMode}
        mobilePrimarySection={workspace.mobilePrimarySection}
        onProjectSelect={nav.handleProjectSelect}
        onSelectViewMode={mode => {
          workspace.setViewMode(mode);
          workspace.setMobilePrimarySection('workspace');
        }}
        onSelectSection={workspace.setMobilePrimarySection}
      />
      <div className="dashboard-workspace">
        <ProjectSidebar
          spaces={spaces}
          selectedId={effectiveSpaceId}
          onSelect={nav.handleProjectSelect}
          showHiddenSpaces={showHiddenSpaces}
          showArchivedSpaces={showArchivedSpaces}
          hiddenSpaceCount={hiddenSpaceCount}
          archivedSpaceCount={archivedSpaceCount}
          onToggleHiddenSpaces={() => setShowHiddenSpaces(value => !value)}
          onToggleArchivedSpaces={() => setShowArchivedSpaces(value => !value)}
          notificationHistoryMode={prefs.layout.notificationHistoryMode}
          onToggleNotificationPanel={() => setShowNotificationPanel(toggleNotificationSidePanel)}
          notificationUnreadCount={bell.unreadCount}
          notificationNewCount={bell.newCount}
          notificationCue={bell.cueLabel}
          notificationFocusBlocked={bell.focusBlocked}
          onAcknowledgeNotificationCue={bell.acknowledgeCue}
        />

        <MainPanel
          mainTitle={mainTitle}
          mainCount={mainCount}
          spaces={spaces}
          effectiveSpaceId={effectiveSpaceId}
          activeSpace={activeSpace}
          isAllSpaces={isAllSpaces}
          isGlobal={isGlobal}
          isAggregateSpace={isAggregateSpace}
          activeSpaceSupportsGit={activeSpaceSupportsGit}
          projects={projects ?? []}
          taskSpaceNames={taskSpaceNames}
          displayedTasks={displayedTasks}
          sortedDocs={sortedDocs}
          dependencyWaitingTaskCount={dependencyWaitingTaskCount}
          manualBlockedTaskCount={manualBlockedTaskCount}
          selectedTaskId={selectedTaskId}
          closePanelKey={prefs.keyboard.closePanel}
          workspace={workspace}
          nav={nav}
        />
      </div>

      <ChannelChatPanel
        projectId={scopedProjectId}
        spaceName={activeSpace?.name ?? effectiveSpaceId}
        showDebugActivity={prefs.chat.showDebugActivity}
        panelSize={channelPanelSize}
        scrollResetKey={effectiveSpaceId}
        onPanelSizeChange={setChannelPanelSize}
        onOpenPreferences={() => setShowPreferences(true)}
        onOpenAssignmentTrace={nav.handleAssignmentTraceSelect}
        onOpenDmTranscript={nav.handleOpenDmTranscript}
      />

      {renderNotificationSidePanel && (
        <NotificationSidePanel
          projectIds={spaces.filter(space => space.id !== ALL_SPACES_ID).map(space => space.id)}
          onClose={() => setShowNotificationPanel(closeNotificationSidePanel())}
          onOpenTask={nav.handleTaskSelect}
        />
      )}

      <DetailOverlays
        selection={selection.value}
        effectiveSpaceId={effectiveSpaceId}
        scopedProjectId={scopedProjectId}
        closePanelKey={prefs.keyboard.closePanel}
        nav={nav}
      />

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
