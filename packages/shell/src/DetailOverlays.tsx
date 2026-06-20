import type { DetailSelection } from './detailSelection';
import type { WorkspaceNavigation } from './useWorkspaceNavigation';
import { TaskDetail } from '@den-web/features/tasks/TaskDetail';
import { MessageDetail } from '@den-web/features/messages/MessageDetail';
import { AgentStreamDetail } from '@den-web/features/agents/AgentStreamDetail';
import { SubagentRunDetail } from '@den-web/features/agents/SubagentRunDetail';
import { DispatchDetail } from '@den-web/features/agents/DispatchDetail';
import { AssignmentTraceView } from '@den-web/features/agents/AssignmentTraceView';
import { DocumentDetail } from '@den-web/features/documents/DocumentDetail';

interface Props {
  selection: DetailSelection;
  effectiveSpaceId: string | null;
  /** Project scope for assignment traces (null for aggregate/global scopes). */
  scopedProjectId: string | null;
  closePanelKey: string;
  nav: WorkspaceNavigation;
}

/**
 * Renders the single active detail overlay for the current selection. The
 * discriminated union guarantees only one overlay is open at a time, so this is
 * a straight switch rather than a stack of mutually-clearing nullable checks.
 */
export function DetailOverlays({ selection, effectiveSpaceId, scopedProjectId, closePanelKey, nav }: Props) {
  if (!selection) return null;

  switch (selection.kind) {
    case 'task':
      if (!effectiveSpaceId) return null;
      return (
        <TaskDetail
          key={`${selection.projectId ?? effectiveSpaceId}:${selection.taskId}`}
          projectId={selection.projectId ?? effectiveSpaceId}
          taskId={selection.taskId}
          onSelectTask={nav.handleTaskSelect}
          onSelectMessage={nav.handleMessageSelect}
          onSelectRun={nav.handleSubagentRunSelect}
          onOpenGit={nav.handleOpenGitFocus}
          onClose={nav.closeDetail}
        />
      );
    case 'message':
      return (
        <MessageDetail
          key={`${selection.message.project_id}:${selection.message.id}`}
          message={selection.message}
          onClose={nav.closeDetail}
        />
      );
    case 'streamEntry':
      return (
        <AgentStreamDetail
          key={selection.entry.id}
          entry={selection.entry}
          onClose={nav.closeDetail}
          onOpenTask={nav.handleTaskSelect}
          onOpenThread={entry => void nav.handleStreamThreadOpen(entry)}
          onOpenDispatch={dispatchId => void nav.handleDispatchSelect(dispatchId)}
        />
      );
    case 'subagentRun':
      return (
        <SubagentRunDetail
          key={selection.run.run_id}
          run={selection.run}
          onClose={nav.closeDetail}
          onOpenTask={nav.handleTaskSelect}
          onOpenEntry={nav.handleStreamSelect}
        />
      );
    case 'dispatch':
      return (
        <DispatchDetail
          dispatch={selection.dispatch}
          onClose={nav.closeDetail}
          onOpenTask={nav.handleTaskSelect}
        />
      );
    case 'assignmentTrace':
      return (
        <AssignmentTraceView
          key={selection.assignmentId}
          assignmentId={selection.assignmentId}
          projectId={scopedProjectId}
          closePanelKey={closePanelKey}
          onClose={nav.closeDetail}
        />
      );
    case 'document':
      return (
        <DocumentDetail
          summary={selection.doc}
          onClose={nav.closeDetail}
          onSaved={nav.handleDocumentSaved}
          onOpenDocument={nav.handleDocumentSelect}
          onDirtyChange={nav.handleDocumentDirtyChange}
          pendingSwitch={nav.pendingDocumentSwitch}
          onCancelSwitch={nav.handleCancelDocumentSwitch}
          onConfirmSwitch={nav.applyDocumentSelection}
        />
      );
  }
}
