import type {
  AgentStreamEntry,
  DocumentSummary,
  Project,
  Space,
  TaskSummary,
} from '@den-web/api/types';
import { FilterBar } from './FilterBar';
import { AgentStreamFilterBar } from './AgentStreamFilterBar';
import { notificationScopeProjectIds } from './spaces';
import type { WorkspaceState } from './useWorkspaceState';
import type { StreamFilters } from './useStreamFilters';
import type { WorkspaceNavigation } from './useWorkspaceNavigation';
import { TaskTree } from '@den-web/features/tasks/TaskTree';
import { MessagesInbox } from '@den-web/features/messages/MessagesInbox';
import { DocumentList } from '@den-web/features/documents/DocumentList';
import { GitView } from '@den-web/features/git/GitView';
import { AgentStreamFeed } from '@den-web/features/agents/AgentStreamFeed';
import { FocusedSessionView } from '@den-web/features/sessions/FocusedSessionView';
import { AgentsOverviewView } from '@den-web/features/agents/AgentsOverviewView';
import { WorkerPoolLobbyView } from '@den-web/features/agents/WorkerPoolLobbyView';
import { DmConversationList } from '@den-web/features/dm/DmConversationList';
import { DmTranscriptView } from '@den-web/features/dm/DmTranscriptView';
import { PiCrewDiagnosticsPanel } from '@den-web/features/piCrewDiagnostics/PiCrewDiagnosticsPanel';
import { NotificationHistoryPanel } from '@den-web/features/notifications/NotificationHistoryPanel';
import { LibrarianView } from '@den-web/features/librarian/LibrarianView';

interface Props {
  mainTitle: string;
  mainCount: string | null;
  spaces: Space[];
  effectiveSpaceId: string | null;
  activeSpace: Space | null;
  isAllSpaces: boolean;
  isGlobal: boolean;
  isAggregateSpace: boolean;
  activeSpaceSupportsGit: boolean;
  projects: Project[];
  taskSpaceNames: Map<string, string>;
  displayedTasks: TaskSummary[];
  sortedDocs: DocumentSummary[];
  filteredAgentStream: AgentStreamEntry[];
  streamEventOptions: string[];
  dependencyWaitingTaskCount: number;
  manualBlockedTaskCount: number;
  selectedTaskId: number | null;
  closePanelKey: string;
  workspace: WorkspaceState;
  filters: StreamFilters;
  nav: WorkspaceNavigation;
}

/**
 * Renders the main workspace panel: header, filter bar, per-view toolbars, and
 * the body for the active view. This is the named view-routing module that
 * replaces the long inline ternary the App god component used to carry.
 */
export function MainPanel({
  mainTitle,
  mainCount,
  spaces,
  effectiveSpaceId,
  activeSpace,
  isAllSpaces,
  isGlobal,
  isAggregateSpace,
  activeSpaceSupportsGit,
  projects,
  taskSpaceNames,
  displayedTasks,
  sortedDocs,
  filteredAgentStream,
  streamEventOptions,
  dependencyWaitingTaskCount,
  manualBlockedTaskCount,
  selectedTaskId,
  closePanelKey,
  workspace,
  filters,
  nav,
}: Props) {
  const { viewMode } = workspace;
  const scopedProjectId = !isAggregateSpace && !isGlobal ? effectiveSpaceId : null;

  const selectViewMode = (mode: typeof viewMode) => {
    workspace.setViewMode(mode);
    workspace.setMobilePrimarySection('workspace');
  };

  return (
    <div className="panel panel-main">
      <div className="panel-header">
        {mainTitle}
        {effectiveSpaceId && mainCount && <span className="count">{mainCount}</span>}
      </div>
      <FilterBar
        statusFilter={workspace.statusFilter}
        onStatusFilterChange={workspace.setStatusFilter}
        sortMode={workspace.sortMode}
        onSortChange={workspace.setSortMode}
        viewMode={viewMode}
        onViewModeChange={selectViewMode}
      />
      {viewMode === 'tasks' && (
        <div className="task-availability-summary" title="Dependency waits are computed by Core and clear automatically; manual blocked tasks need attention and an explicit unblock/status change.">
          <span className="task-availability-summary-item task-availability-summary-waiting">
            {dependencyWaitingTaskCount} auto dependency wait{dependencyWaitingTaskCount === 1 ? '' : 's'}
          </span>
          <span className="task-availability-summary-item task-availability-summary-blocked">
            {manualBlockedTaskCount} manual block{manualBlockedTaskCount === 1 ? '' : 's'}
          </span>
        </div>
      )}
      {viewMode === 'agent-stream' && (
        <AgentStreamFilterBar
          filters={filters}
          isAggregateSpace={isAggregateSpace}
          streamEventOptions={streamEventOptions}
        />
      )}
      <div className="panel-body">
        {viewMode === 'tasks' ? (
          <TaskTree
            tasks={displayedTasks}
            selectedTaskId={selectedTaskId}
            onSelect={nav.handleTaskSelect}
            statusFilter={workspace.statusFilter}
            sortMode={workspace.sortMode}
            showProjectLabels={isAllSpaces}
            projectNames={taskSpaceNames}
          />
        ) : viewMode === 'messages' ? (
          <MessagesInbox
            spaces={spaces}
            currentSpaceId={effectiveSpaceId}
            isAggregate={isAggregateSpace}
            onSelect={nav.handleMessageSelect}
            onOpenTask={nav.handleTaskSelect}
          />
        ) : viewMode === 'documents' ? (
          <DocumentList
            documents={sortedDocs}
            projectId={effectiveSpaceId}
            isGlobal={isAggregateSpace}
            onSelect={nav.handleDocumentSelect}
          />
        ) : viewMode === 'git' ? (
          <GitView
            projectId={activeSpaceSupportsGit ? effectiveSpaceId : null}
            projects={projects}
            isGlobal={isAggregateSpace}
            scopeSupportsGit={activeSpaceSupportsGit}
            focus={nav.gitFocus}
            onClearFocus={nav.handleClearGitFocus}
          />
        ) : viewMode === 'agent-stream' ? (
          <AgentStreamFeed
            entries={filteredAgentStream}
            isGlobal={isAggregateSpace}
            onSelect={nav.handleStreamSelect}
            onOpenTask={nav.handleTaskSelect}
            onOpenThread={entry => void nav.handleStreamThreadOpen(entry)}
            onOpenDispatch={dispatchId => void nav.handleDispatchSelect(dispatchId)}
          />
        ) : viewMode === 'sessions' ? (
          <FocusedSessionView
            projectId={scopedProjectId}
            spaceName={activeSpace?.name ?? effectiveSpaceId}
          />
        ) : viewMode === 'agents' ? (
          <>
            <div className="agents-sub-view-tabs">
              <button
                className={`agents-sub-view-tab ${workspace.agentsSubView === 'overview' ? 'active' : ''}`}
                onClick={() => workspace.setAgentsSubView('overview')}
              >
                Overview
              </button>
              <button
                className={`agents-sub-view-tab ${workspace.agentsSubView === 'worker-pool' ? 'active' : ''}`}
                onClick={() => workspace.setAgentsSubView('worker-pool')}
              >
                Worker Pool
              </button>
            </div>
            {workspace.agentsSubView === 'overview' ? (
              <AgentsOverviewView
                projectId={scopedProjectId}
                isAggregate={isAggregateSpace}
                closePanelKey={closePanelKey}
                onOpenAssignmentTrace={nav.handleAssignmentTraceSelect}
                onOpenDmTranscript={nav.handleOpenDmTranscript}
              />
            ) : (
              <WorkerPoolLobbyView
                onOpenAssignmentTrace={nav.handleAssignmentTraceSelect}
              />
            )}
          </>
        ) : viewMode === 'dm' ? (
          nav.selectedDmConversation ? (
            <DmTranscriptView
              conversation={nav.selectedDmConversation}
              onBack={nav.handleDmBack}
            />
          ) : (
            <DmConversationList
              onSelectConversation={nav.handleSelectDmConversation}
              initialAgentIdentity={nav.selectedDmAgent}
              scopeProjectId={scopedProjectId}
            />
          )
        ) : viewMode === 'pi-crew-diagnostics' ? (
          <PiCrewDiagnosticsPanel />
        ) : viewMode === 'notifications' ? (
          <NotificationHistoryPanel
            projectIds={notificationScopeProjectIds(effectiveSpaceId, spaces)}
            onOpenTask={nav.handleTaskSelect}
          />
        ) : (
          <LibrarianView
            projects={spaces}
            currentProjectId={effectiveSpaceId}
            onOpenTask={nav.handleTaskSelect}
            onOpenDocument={nav.handleDocumentSelect}
            onOpenMessage={(projectId, messageId) => void nav.handleMessageOpen(projectId, messageId)}
            onOpenThread={(projectId, threadId) => void nav.handleThreadOpen(projectId, threadId)}
          />
        )}
      </div>
    </div>
  );
}
