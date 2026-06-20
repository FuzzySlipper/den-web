import type { AgentStreamEntry, AttentionItem, SubagentRunDetail, SubagentRunSummary } from './types';
import { buildQuery, esc, get, post } from './http';

// Attention

export interface ListAttentionOpts {
  projectId?: string;
  taskId?: number;
  kind?: string;
  severity?: string;
  limit?: number;
}

export function listAttention(opts: ListAttentionOpts = {}): Promise<AttentionItem[]> {
  const q = buildQuery({
    projectId: opts.projectId,
    taskId: opts.taskId,
    kind: opts.kind,
    severity: opts.severity,
    limit: opts.limit,
  });
  return get(`/api/attention${q}`);
}

export function listProjectAttention(projectId: string, opts: Omit<ListAttentionOpts, 'projectId'> = {}): Promise<AttentionItem[]> {
  const q = buildQuery({
    taskId: opts.taskId,
    kind: opts.kind,
    severity: opts.severity,
    limit: opts.limit,
  });
  return get(`/api/projects/${esc(projectId)}/attention${q}`);
}

// Agent stream

export interface ListAgentStreamOpts {
  projectId?: string;
  taskId?: number;
  dispatchId?: number;
  streamKind?: string;
  eventType?: string;
  sender?: string;
  senderInstanceId?: string;
  recipientAgent?: string;
  recipientRole?: string;
  recipientInstanceId?: string;
  metadataRunId?: string;
  limit?: number;
}

export function listAgentStream(opts: ListAgentStreamOpts = {}): Promise<AgentStreamEntry[]> {
  const q = buildQuery({
    projectId: opts.projectId,
    taskId: opts.taskId,
    dispatchId: opts.dispatchId,
    streamKind: opts.streamKind,
    eventType: opts.eventType,
    sender: opts.sender,
    senderInstanceId: opts.senderInstanceId,
    recipientAgent: opts.recipientAgent,
    recipientRole: opts.recipientRole,
    recipientInstanceId: opts.recipientInstanceId,
    metadataRunId: opts.metadataRunId,
    limit: opts.limit,
  });
  return get(`/api/agent-stream${q}`);
}

export interface ListSubagentRunsOpts {
  projectId?: string;
  taskId?: number;
  state?: string;
  limit?: number;
}

export function listSubagentRuns(opts: ListSubagentRunsOpts = {}): Promise<SubagentRunSummary[]> {
  const q = buildQuery({
    projectId: opts.projectId,
    taskId: opts.taskId,
    state: opts.state,
    limit: opts.limit,
  });
  return get(`/api/subagent-runs${q}`);
}

export function getSubagentRun(runId: string, opts: Omit<ListSubagentRunsOpts, 'limit'> = {}): Promise<SubagentRunDetail> {
  const q = buildQuery({
    projectId: opts.projectId,
    taskId: opts.taskId,
  });
  return get(`/api/subagent-runs/${esc(runId)}${q}`);
}

export type SubagentRunControlAction = 'abort' | 'rerun';

export interface ControlSubagentRunOpts extends Omit<ListSubagentRunsOpts, 'state' | 'limit'> {
  action: SubagentRunControlAction;
  requestedBy?: string;
  reason?: string;
}

export function controlSubagentRun(runId: string, opts: ControlSubagentRunOpts): Promise<AgentStreamEntry> {
  const q = buildQuery({
    projectId: opts.projectId,
    taskId: opts.taskId,
  });
  return post(`/api/subagent-runs/${esc(runId)}/control${q}`, {
    action: opts.action,
    requested_by: opts.requestedBy ?? 'web-ui',
    reason: opts.reason,
  });
}
