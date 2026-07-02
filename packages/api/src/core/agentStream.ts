import type { AgentStreamEntry, AttentionItem, SubagentRunDetail, SubagentRunSummary } from './types';

// Attention

export interface ListAttentionOpts {
  projectId?: string;
  taskId?: number;
  kind?: string;
  severity?: string;
  limit?: number;
}

export function listAttention(opts: ListAttentionOpts = {}): Promise<AttentionItem[]> {
  void opts;
  return Promise.resolve([]);
}

export function listProjectAttention(projectId: string, opts: Omit<ListAttentionOpts, 'projectId'> = {}): Promise<AttentionItem[]> {
  void projectId;
  void opts;
  return Promise.resolve([]);
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
  void opts;
  return Promise.resolve([]);
}

export interface ListSubagentRunsOpts {
  projectId?: string;
  taskId?: number;
  state?: string;
  limit?: number;
}

export function listSubagentRuns(opts: ListSubagentRunsOpts = {}): Promise<SubagentRunSummary[]> {
  void opts;
  return Promise.resolve([]);
}

export function getSubagentRun(runId: string, opts: Omit<ListSubagentRunsOpts, 'limit'> = {}): Promise<SubagentRunDetail> {
  void runId;
  void opts;
  return Promise.reject(new Error('Subagent run detail is disabled after the den-core cutover.'));
}

export type SubagentRunControlAction = 'abort' | 'rerun';

export interface ControlSubagentRunOpts extends Omit<ListSubagentRunsOpts, 'state' | 'limit'> {
  action: SubagentRunControlAction;
  requestedBy?: string;
  reason?: string;
}

export function controlSubagentRun(runId: string, opts: ControlSubagentRunOpts): Promise<AgentStreamEntry> {
  void runId;
  void opts;
  return Promise.reject(new Error('Subagent run control is disabled after the den-core cutover.'));
}
