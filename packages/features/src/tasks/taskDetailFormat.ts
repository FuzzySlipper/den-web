import type {
  AgentWorkspace,
  ReviewTimelineEntry,
  ReviewVerdict,
  SubagentRunState,
  SubagentRunSummary,
  TaskDetail as TaskDetailType,
  TaskStatus,
} from '@den-web/api/types';
import { formatSubagentDuration } from '@den-web/models/agents/subagentRunsDisplay';
import { isDependencyWaitingDetail } from './taskAvailability';

export const TASK_DETAIL_STATUSES: TaskStatus[] = ['planned', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];

export function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function formatVerdict(verdict: ReviewVerdict | null): string {
  return verdict ? formatLabel(verdict) : 'pending';
}

export function formatDelta(detail: TaskDetailType): string {
  const delta = detail.review_workflow.current_round?.delta_diff;
  return delta?.base_commit ? `${delta.base_commit}..${delta.head_commit}` : '(initial review)';
}

export function formatTimeline(entry: ReviewTimelineEntry): string {
  const parts = [`${entry.total_finding_count} findings`];
  if (entry.open_finding_count > 0) parts.push(`${entry.open_finding_count} open`);
  if (entry.addressed_finding_count > 0) parts.push(`${entry.addressed_finding_count} addressed`);
  if (entry.resolved_finding_count > 0) parts.push(`${entry.resolved_finding_count} resolved`);
  return parts.join(' · ');
}

export function isActiveRunState(state: SubagentRunState): boolean {
  return state === 'running' || state === 'retrying' || state === 'aborting' || state === 'rerun_requested';
}

export function isProblemRunState(state: SubagentRunState): boolean {
  return state === 'failed' || state === 'timeout' || state === 'aborted' || state === 'unknown';
}

export function shortSha(value: string | null | undefined): string {
  return value ? value.slice(0, 8) : 'unknown';
}

export function summarizeRun(run: SubagentRunSummary): string {
  const bits = [run.role, run.model, run.duration_ms != null ? formatSubagentDuration(run.duration_ms) : null]
    .filter(Boolean);
  return bits.length > 0 ? bits.join(' · ') : run.run_id;
}

export function selectRelevantWorkspace(workspaces: AgentWorkspace[], branch?: string | null): AgentWorkspace | null {
  if (workspaces.length === 0) return null;
  if (branch) {
    const byBranch = workspaces.find(workspace => workspace.branch === branch);
    if (byBranch) return byBranch;
  }
  return workspaces[0];
}

export function nextAction(detail: TaskDetailType, runs: SubagentRunSummary[]): string {
  const activeRun = runs.find(run => isActiveRunState(run.state));
  const latestRun = runs[0] ?? null;
  const currentProblemRun = latestRun && isProblemRunState(latestRun.state) ? latestRun : null;
  const currentRound = detail.review_workflow.current_round;
  if (activeRun) return `Monitor ${activeRun.role ?? 'agent'} run ${activeRun.run_id.slice(0, 8)} or abort if it drifts.`;
  if (currentProblemRun) return `Inspect latest ${currentProblemRun.state} run ${currentProblemRun.run_id.slice(0, 8)} and rerun or fix the task.`;
  if (detail.task.status === 'blocked') return 'Manual blocker: resolve the attention-requiring blocker and explicitly unblock/status-change this task.';
  if (isDependencyWaitingDetail(detail)) return 'Waiting on dependencies; Core will make this task available automatically when dependencies resolve.';
  if (detail.open_review_findings.length > 0) return 'Address open review findings, then request rereview.';
  if (detail.task.status === 'review' && currentRound?.verdict === 'looks_good') return 'Confirm the reviewed head still matches, then merge.';
  if (detail.task.status === 'review') return 'Wait for review or launch a reviewer run if none is active.';
  if (detail.task.status === 'planned') return 'Claim/start implementation on a task branch.';
  if (detail.task.status === 'in_progress') return 'Continue implementation, then request review with a stable diff.';
  if (detail.task.status === 'done') return 'No action needed; task is complete.';
  return 'Triage task state and decide the next operator action.';
}
