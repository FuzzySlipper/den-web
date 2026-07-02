import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentWorkspace, GitStatusResponse, Message, SubagentRunSummary, TaskDetail as TaskDetailType } from '@den-web/api/types';
import { getProjectGitStatus, getTask, getWorkspaceGitStatus, listProjectAgentWorkspaces, updateTask } from '@den-web/api/client';
import type { GitFocus } from '../git/git';
import { sendTaskStartWork, type StartWorkEvidence, type StartWorkPhase } from './startWork';
import { selectRelevantWorkspace } from './taskDetailFormat';
import { TaskDetailBody } from './TaskDetailBody';

interface Props {
  projectId: string;
  taskId: number;
  onSelectTask: (taskId: number) => void;
  onSelectMessage: (message: Message) => void;
  onSelectRun: (run: SubagentRunSummary) => void;
  onOpenGit: (focus: GitFocus) => void;
  onClose: () => void;
}


export function TaskDetail({ projectId, taskId, onSelectTask, onSelectMessage, onSelectRun, onOpenGit, onClose }: Props) {
  const [detail, setDetail] = useState<TaskDetailType | null>(null);
  const [runs] = useState<SubagentRunSummary[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [gitWorkspace, setGitWorkspace] = useState<AgentWorkspace | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startWorkPhase, setStartWorkPhase] = useState<StartWorkPhase>('idle');
  const [startWorkEvidence, setStartWorkEvidence] = useState<StartWorkEvidence | null>(null);
  const startWorkInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getTask(projectId, taskId)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [projectId, taskId]);

  useEffect(() => {
    let cancelled = false;
    async function loadGitStatus() {
      if (!detail) return;
      try {
        const workspaces = await listProjectAgentWorkspaces(projectId, { taskId, limit: 20 });
        const workspace = selectRelevantWorkspace(workspaces, detail.review_workflow.current_round?.branch);
        const status = workspace
          ? await getWorkspaceGitStatus(projectId, workspace.id)
          : await getProjectGitStatus(projectId);
        if (!cancelled) {
          setGitWorkspace(workspace);
          setGitStatus(status);
          setGitError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setGitWorkspace(null);
          setGitStatus(null);
          setGitError(e instanceof Error ? e.message : String(e));
        }
      }
    }
    void loadGitStatus();
    return () => { cancelled = true; };
  }, [detail, projectId, taskId]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTask(projectId, taskId, 'web-ui', { status: newStatus });
      const d = await getTask(projectId, taskId);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStartWork = useCallback(async () => {
    if (startWorkInFlight.current || !detail) return;
    startWorkInFlight.current = true;
    setStartWorkPhase('preflighting');
    setStartWorkEvidence(null);
    try {
      setStartWorkPhase('sending');
      const evidence = await sendTaskStartWork(detail.task);
      setStartWorkPhase(evidence.phase);
      setStartWorkEvidence(evidence);
    } catch (e) {
      setStartWorkPhase('failed');
      setStartWorkEvidence({
        phase: 'failed',
        summary: e instanceof Error ? e.message : String(e),
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      startWorkInFlight.current = false;
    }
  }, [detail]);

  if (error) {
    return (
      <div className="detail-overlay">
        <div className="detail-header">
          <h2>Error</h2>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="detail-body"><div className="empty">{error}</div></div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="detail-overlay">
        <div className="detail-header">
          <h2>Loading...</h2>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <TaskDetailBody
      detail={detail}
      runs={runs}
      gitStatus={gitStatus}
      gitWorkspace={gitWorkspace}
      gitError={gitError}
      runsError={null}
      projectId={projectId}
      startWorkPhase={startWorkPhase}
      startWorkEvidence={startWorkEvidence}
      onClose={onClose}
      onOpenGit={onOpenGit}
      onSelectMessage={onSelectMessage}
      onSelectRun={onSelectRun}
      onSelectTask={onSelectTask}
      onStartWork={handleStartWork}
      onStatusChange={newStatus => void handleStatusChange(newStatus)}
    />
  );
}
