import type { GitDirtyCounts, GitFileStatus } from './git';

export type DesktopSessionEventType =
  | 'created'
  | 'discovered'
  | 'status_changed'
  | 'capabilities_changed'
  | 'attached'
  | 'detached'
  | 'input_sent'
  | 'resize_requested'
  | 'terminate_requested'
  | 'terminate_completed'
  | 'reconnect'
  | 'reconnect_requested'
  | 'reconnected'
  | 'lease_acquired'
  | 'lease_lost'
  | 'lease_conflict'
  | 'warning'
  | 'crashed'
  | 'exited'
  | 'snapshot_published'
  | 'snapshot_publish_failed';

export type DesktopSnapshotState =
  | 'ok'
  | 'path_not_visible'
  | 'not_git_repository'
  | 'git_error'
  | 'source_offline'
  | 'missing';

export interface DesktopGitSnapshot {
  id: number;
  project_id: string;
  task_id: number | null;
  workspace_id: string | null;
  root_path: string;
  state: DesktopSnapshotState;
  branch: string | null;
  is_detached: boolean;
  head_sha: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  dirty_counts: GitDirtyCounts;
  changed_files: GitFileStatus[];
  warnings: string[];
  truncated: boolean;
  source_instance_id: string;
  source_display_name: string | null;
  observed_at: string;
  received_at: string;
  updated_at: string;
  is_stale: boolean;
  freshness_seconds: number;
  freshness_status: string;
}

export interface DesktopGitSnapshotLatestResult {
  project_id: string;
  task_id: number | null;
  workspace_id: string | null;
  root_path: string | null;
  source_instance_id: string | null;
  state: DesktopSnapshotState;
  is_stale: boolean;
  freshness_status: string;
  snapshot: DesktopGitSnapshot | null;
}

export interface DesktopDiffSnapshot {
  id: number;
  project_id: string;
  task_id: number | null;
  workspace_id: string | null;
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
  source_instance_id: string;
  source_display_name: string | null;
  observed_at: string;
  received_at: string;
  updated_at: string;
  is_stale: boolean;
  freshness_seconds: number;
}

export interface DesktopDiffSnapshotLatestResult {
  project_id: string;
  task_id: number | null;
  workspace_id: string | null;
  root_path: string | null;
  path: string | null;
  source_instance_id: string | null;
  state: DesktopSnapshotState;
  snapshot: DesktopDiffSnapshot | null;
}

export interface DesktopSessionSnapshot {
  id: number;
  project_id: string;
  task_id: number | null;
  workspace_id: string | null;
  session_id: string;
  parent_session_id: string | null;
  agent_identity: string | null;
  role: string | null;
  current_command: string | null;
  current_phase: string | null;
  title: string | null;
  display_name: string | null;
  cwd: string | null;
  kind: string | null;
  backend: string | null;
  status: string | null;
  started_at: string | null;
  last_activity_at: string | null;
  exited_at: string | null;
  exit_code: number | null;
  source_display_name: string | null;
  capabilities: unknown | null;
  recent_activity: unknown | null;
  child_sessions: unknown | null;
  control_capabilities: unknown | null;
  warnings: string[];
  source_instance_id: string;
  observed_at: string;
  received_at: string;
  updated_at: string;
  is_stale: boolean;
  freshness_seconds: number;
}

export interface DesktopSessionEvent {
  id: number;
  project_id: string;
  task_id: number | null;
  workspace_id: string | null;
  source_instance_id: string;
  session_id: string;
  event_type: DesktopSessionEventType;
  payload: string | null;
  requested_by: string | null;
  reason: string | null;
  observed_at: string;
  created_at: string;
}

export interface AppendDesktopSessionEventRequest {
  task_id?: number | null;
  workspace_id?: string | null;
  source_instance_id: string;
  session_id: string;
  event_type: DesktopSessionEventType;
  payload?: string | null;
  requested_by?: string | null;
  reason?: string | null;
  observed_at?: string | null;
}

export interface ListDesktopSessionEventsOptions {
  taskId?: number;
  workspaceId?: string;
  sourceInstanceId?: string;
  sessionId?: string;
  eventTypes?: DesktopSessionEventType[] | string;
  limit?: number;
}
