import type { AgentWorkspace, GitStatusResponse, SubagentRunSummary, TaskDetail as TaskDetailType } from '@den-web/api/types';
import { truncate } from '@den-web/shared';
import { buildTaskGitFocus, dirtyCount, reviewGitAlignmentWarnings, summarizeGitStatus, type GitFocus } from '../git/git';
import {
  formatVerdict,
  isActiveRunState,
  isProblemRunState,
  nextAction,
  shortSha,
  summarizeRun,
} from './taskDetailFormat';

interface Props {
  detail: TaskDetailType;
  runs: SubagentRunSummary[];
  gitStatus: GitStatusResponse | null;
  gitWorkspace: AgentWorkspace | null;
  gitError: string | null;
  runsError: string | null;
  projectId: string;
  onOpenGit: (focus: GitFocus) => void;
  onSelectRun: (run: SubagentRunSummary) => void;
}

function WorkspaceRunSummaryCard({ runs }: { runs: SubagentRunSummary[] }) {
  const activeRuns = runs.filter(run => isActiveRunState(run.state));
  const latestRun = runs[0] ?? null;
  const latestProblemRun = latestRun && isProblemRunState(latestRun.state) ? latestRun : null;

  return (
    <div className={`workspace-card ${activeRuns.length > 0 ? 'workspace-card-active' : latestProblemRun ? 'workspace-card-problem' : ''}`}>
      <span>Running</span>
      <strong>{activeRuns.length > 0 ? `${activeRuns.length} active run${activeRuns.length === 1 ? '' : 's'}` : latestRun ? `last ${latestRun.state}` : 'no runs yet'}</strong>
      <p>{activeRuns[0] ? summarizeRun(activeRuns[0]) : latestRun ? summarizeRun(latestRun) : 'No sub-agent activity is linked to this task yet.'}</p>
    </div>
  );
}

function WorkspaceGitCard({
  currentRound,
  gitError,
  gitFocus,
  gitStatus,
  onOpenGit,
}: {
  currentRound: TaskDetailType['review_workflow']['current_round'];
  gitError: string | null;
  gitFocus: GitFocus;
  gitStatus: GitStatusResponse | null;
  onOpenGit: (focus: GitFocus) => void;
}) {
  return (
    <button
      type="button"
      className={`workspace-card workspace-card-button ${gitStatus && dirtyCount(gitStatus) > 0 ? 'workspace-card-active' : ''}`}
      onClick={() => onOpenGit(gitFocus)}
      title="Open Git view for this task/workspace"
    >
      <span>Changed</span>
      <strong>{gitStatus ? `${dirtyCount(gitStatus)} live changed file${dirtyCount(gitStatus) === 1 ? '' : 's'}` : currentRound ? `${currentRound.preferred_diff.base_ref}...${currentRound.preferred_diff.head_ref}` : 'open Git view'}</strong>
      <p>{gitStatus ? summarizeGitStatus(gitStatus) : gitError ? `Could not load live git state: ${gitError}` : currentRound ? `head ${shortSha(currentRound.head_commit)} on ${currentRound.branch}` : 'Open the read-only Git view for project/workspace changes.'}</p>
    </button>
  );
}

function WorkspaceReviewCard({ detail }: { detail: TaskDetailType }) {
  const currentRound = detail.review_workflow.current_round;

  return (
    <div className={`workspace-card ${detail.open_review_findings.length > 0 ? 'workspace-card-problem' : detail.review_workflow.current_verdict === 'looks_good' ? 'workspace-card-ready' : ''}`}>
      <span>Review</span>
      <strong>{currentRound ? formatVerdict(detail.review_workflow.current_verdict) : 'not requested'}</strong>
      <p>{currentRound ? `${detail.open_review_findings.length} open findings · R${currentRound.round_number}` : 'No review round is linked to this task.'}</p>
    </div>
  );
}

function WorkspaceRunList({
  runs,
  onSelectRun,
}: {
  runs: SubagentRunSummary[];
  onSelectRun: (run: SubagentRunSummary) => void;
}) {
  if (runs.length === 0) return null;

  return (
    <div className="workspace-run-list">
      {runs.slice(0, 4).map(run => (
        <button
          key={run.run_id}
          type="button"
          className={`workspace-run-card workspace-run-card-${run.state}`}
          onClick={() => onSelectRun(run)}
          title={`Open run ${run.run_id}`}
        >
          <span className={`subagent-state subagent-state-${run.state}`}>{run.state}</span>
          <span className="workspace-run-title">{run.role ?? 'agent'} · {run.run_id.slice(0, 8)}</span>
          <span className="workspace-run-meta">{truncate(summarizeRun(run), 90)}</span>
        </button>
      ))}
    </div>
  );
}

export function TaskWorkspaceSection({
  detail,
  runs,
  gitStatus,
  gitWorkspace,
  gitError,
  runsError,
  projectId,
  onOpenGit,
  onSelectRun,
}: Props) {
  const { task } = detail;
  const currentRound = detail.review_workflow.current_round;
  const operatorNextAction = nextAction(detail, runs);
  const gitWarnings = reviewGitAlignmentWarnings(currentRound, gitStatus);
  const gitFocus = buildTaskGitFocus(projectId, task.id, gitWorkspace, currentRound?.branch);

  return (
    <div className="detail-section workspace-section">
      <h3>Workspace</h3>
      <div className="workspace-grid">
        <WorkspaceRunSummaryCard runs={runs} />
        <WorkspaceGitCard
          currentRound={currentRound}
          gitError={gitError}
          gitFocus={gitFocus}
          gitStatus={gitStatus}
          onOpenGit={onOpenGit}
        />
        <WorkspaceReviewCard detail={detail} />
        <div className="workspace-card workspace-card-next">
          <span>Next</span>
          <strong>{task.status.replace(/_/g, ' ')}</strong>
          <p>{operatorNextAction}</p>
        </div>
      </div>
      {gitWorkspace && <div className="detail-description">Git view target: workspace <code>{gitWorkspace.id}</code> on <code>{gitWorkspace.branch}</code>.</div>}
      {gitWarnings.length > 0 && (
        <div className="workspace-warning-list">
          {gitWarnings.map(warning => <div key={warning} className="workspace-warning">{warning}</div>)}
        </div>
      )}
      {runsError && <div className="detail-description">Could not load agent runs: {runsError}</div>}
      <WorkspaceRunList runs={runs} onSelectRun={onSelectRun} />
    </div>
  );
}
