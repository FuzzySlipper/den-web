export type AgentWorkspaceState = 'planned' | 'active' | 'review' | 'complete' | 'failed' | 'archived';
export type AgentWorkspaceCleanupPolicy = 'keep' | 'delete_worktree' | 'archive';

export interface AgentWorkspace {
  id: string;
  project_id: string;
  task_id: number;
  branch: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string | null;
  head_commit: string | null;
  state: AgentWorkspaceState;
  created_by_run_id: string | null;
  dev_server_url: string | null;
  preview_url: string | null;
  cleanup_policy: AgentWorkspaceCleanupPolicy;
  changed_file_summary: unknown | null;
  created_at: string;
  updated_at: string;
}
