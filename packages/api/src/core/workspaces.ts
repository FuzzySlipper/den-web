import type { AgentWorkspace } from './types';
import { buildQuery, esc, get } from './http';

export interface ListAgentWorkspacesOpts {
  taskId?: number;
  state?: string;
  limit?: number;
}

export function listProjectAgentWorkspaces(projectId: string, opts: ListAgentWorkspacesOpts = {}): Promise<AgentWorkspace[]> {
  const q = buildQuery({
    taskId: opts.taskId,
    state: opts.state,
    limit: opts.limit,
  });
  return get(`/api/projects/${esc(projectId)}/agent-workspaces${q}`);
}
