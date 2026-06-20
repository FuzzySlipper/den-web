export interface GitDirtyCounts {
  total: number;
  staged: number;
  unstaged: number;
  untracked: number;
  modified: number;
  added: number;
  deleted: number;
  renamed: number;
}

export interface GitFileStatus {
  path: string;
  old_path: string | null;
  index_status: string | null;
  worktree_status: string | null;
  category: string;
  is_untracked: boolean;
}

export interface GitStatusResponse {
  project_id: string;
  workspace_id: string | null;
  task_id: number | null;
  workspace_branch: string | null;
  workspace_base_branch: string | null;
  workspace_base_commit: string | null;
  workspace_head_commit: string | null;
  root_path: string;
  is_git_repository: boolean;
  branch: string | null;
  is_detached: boolean;
  head_sha: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  dirty_counts: GitDirtyCounts;
  files: GitFileStatus[];
  warnings: string[];
  errors: string[];
  truncated: boolean;
}

export interface GitFilesResponse {
  project_id: string;
  workspace_id: string | null;
  task_id: number | null;
  workspace_branch: string | null;
  workspace_base_branch: string | null;
  workspace_base_commit: string | null;
  workspace_head_commit: string | null;
  root_path: string;
  base_ref: string | null;
  head_ref: string | null;
  files: GitFileStatus[];
  warnings: string[];
  errors: string[];
  truncated: boolean;
}

export interface GitDiffResponse {
  project_id: string;
  workspace_id: string | null;
  task_id: number | null;
  workspace_branch: string | null;
  workspace_base_branch: string | null;
  workspace_base_commit: string | null;
  workspace_head_commit: string | null;
  root_path: string;
  path: string | null;
  base_ref: string | null;
  head_ref: string | null;
  max_bytes: number;
  staged: boolean;
  diff: string;
  truncated: boolean;
  binary: boolean;
  warnings: string[];
  errors: string[];
}
