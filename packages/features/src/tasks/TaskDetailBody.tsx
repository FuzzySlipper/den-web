import type { AgentWorkspace, GitStatusResponse, Message, SubagentRunSummary, TaskDetail as TaskDetailType } from '@den-web/api/types';
import type { GitFocus } from '../git/git';
import type { StartWorkEvidence, StartWorkPhase } from './startWork';
import { isDependencyWaitingDetail, taskAvailabilityLabel, taskAvailabilityTitle } from './taskAvailability';
import { TaskRelationsSections } from './TaskRelationsSections';
import { TaskReviewSections } from './TaskReviewSections';
import { TaskStatusSection } from './TaskStatusSection';
import { TaskWorkspaceSection } from './TaskWorkspaceSection';

interface Props {
  detail: TaskDetailType;
  runs: SubagentRunSummary[];
  gitStatus: GitStatusResponse | null;
  gitWorkspace: AgentWorkspace | null;
  gitError: string | null;
  runsError: string | null;
  projectId: string;
  startWorkPhase: StartWorkPhase;
  startWorkEvidence: StartWorkEvidence | null;
  onClose: () => void;
  onOpenGit: (focus: GitFocus) => void;
  onSelectMessage: (message: Message) => void;
  onSelectRun: (run: SubagentRunSummary) => void;
  onSelectTask: (taskId: number) => void;
  onStartWork: () => void;
  onStatusChange: (newStatus: string) => void;
}

export function TaskDetailBody({
  detail,
  runs,
  gitStatus,
  gitWorkspace,
  gitError,
  runsError,
  projectId,
  startWorkPhase,
  startWorkEvidence,
  onClose,
  onOpenGit,
  onSelectMessage,
  onSelectRun,
  onSelectTask,
  onStartWork,
  onStatusChange,
}: Props) {
  const { task } = detail;
  const dependencyWaiting = isDependencyWaitingDetail(detail);
  const availabilityLabel = taskAvailabilityLabel(task);
  const availabilityTitle = taskAvailabilityTitle(task);

  return (
    <div className="detail-overlay detail-overlay-wide">
      <div className="detail-header">
        <h2>#{task.id} {task.title}</h2>
        <button className="detail-close" onClick={onClose}>✕</button>
      </div>
      <div className="detail-body">
        <TaskStatusSection
          task={task}
          dependencyWaiting={dependencyWaiting}
          availabilityLabel={availabilityLabel}
          availabilityTitle={availabilityTitle}
          startWorkPhase={startWorkPhase}
          startWorkEvidence={startWorkEvidence}
          onStartWork={onStartWork}
          onStatusChange={onStatusChange}
        />

        <TaskWorkspaceSection
          detail={detail}
          runs={runs}
          gitStatus={gitStatus}
          gitWorkspace={gitWorkspace}
          gitError={gitError}
          runsError={runsError}
          projectId={projectId}
          onOpenGit={onOpenGit}
          onSelectRun={onSelectRun}
        />

        <TaskReviewSections detail={detail} />
        <TaskRelationsSections
          detail={detail}
          dependencyWaiting={dependencyWaiting}
          onSelectMessage={onSelectMessage}
          onSelectTask={onSelectTask}
        />
      </div>
    </div>
  );
}
