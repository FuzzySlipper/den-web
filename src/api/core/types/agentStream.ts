export type AgentStreamKind = 'ops' | 'message';
export type AgentStreamDeliveryMode = 'record_only' | 'notify' | 'wake';

export interface AgentStreamEntry {
  id: number;
  stream_kind: AgentStreamKind;
  event_type: string;
  project_id: string | null;
  task_id: number | null;
  thread_id: number | null;
  dispatch_id: number | null;
  sender: string;
  sender_instance_id: string | null;
  recipient_agent: string | null;
  recipient_role: string | null;
  recipient_instance_id: string | null;
  delivery_mode: AgentStreamDeliveryMode;
  body: string | null;
  metadata: Record<string, unknown> | null;
  dedup_key: string | null;
  created_at: string;
}

export type SubagentRunState =
  | 'running'
  | 'retrying'
  | 'aborting'
  | 'rerun_requested'
  | 'rerun_accepted'
  | 'complete'
  | 'failed'
  | 'timeout'
  | 'aborted'
  | 'unknown';

export interface SubagentRunSummary {
  run_id: string;
  state: SubagentRunState;
  schema: string | null;
  schema_version: number | null;
  latest: AgentStreamEntry;
  started: AgentStreamEntry | null;
  role: string | null;
  task_id: number | null;
  project_id: string | null;
  backend: string | null;
  model: string | null;
  review_round_id: number | null;
  workspace_id: string | null;
  purpose: string | null;
  worktree_path: string | null;
  branch: string | null;
  base_branch: string | null;
  base_commit: string | null;
  head_commit: string | null;
  final_head_commit: string | null;
  final_head_status: string | null;
  started_at: string | null;
  ended_at: string | null;
  usage_summary: SubagentRunUsageSummary | null;
  event_counts: SubagentRunEventCounts;
  operator_events: SubagentRunOperatorEvent[];
  output_status: string | null;
  timeout_kind: string | null;
  infrastructure_failure_reason: string | null;
  infrastructure_warning_reason: string | null;
  exit_code: number | null;
  signal: string | null;
  pid: number | null;
  stderr_preview: string | null;
  fallback_model: string | null;
  fallback_from_model: string | null;
  fallback_from_exit_code: number | null;
  heartbeat_count: number;
  assistant_output_count: number;
  last_heartbeat_at: string | null;
  last_assistant_output_at: string | null;
  duration_ms: number | null;
  artifact_dir: string | null;
  event_count: number;
}

export interface SubagentRunUsageSummary {
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  total_tokens: number | null;
  total_cost: number | null;
  currency: string | null;
  source: string | null;
  message_count: number | null;
  latest_usage_at: string | null;
}

export interface SubagentRunEventCounts {
  total: number;
  lifecycle: number;
  raw_work: number;
  operator_summary: number;
  debug: number;
}

export interface SubagentRunOperatorEvent {
  event_name: string;
  source: string;
  source_event_type: string | null;
  stream_entry_id: number | null;
  source_message_type: string | null;
  occurred_at: string | null;
  visibility: string;
}

export interface SubagentRunDetail {
  summary: SubagentRunSummary;
  events: AgentStreamEntry[];
  work_events: SubagentRunWorkEvent[];
  artifacts: SubagentRunArtifactSnapshot | null;
}

export interface SubagentRunWorkEvent {
  type: string;
  ts?: number | null;
  source_type?: string | null;
  run_id?: string | null;
  task_id?: number | null;
  subagent_role?: string | null;
  backend?: string | null;
  requested_model?: string | null;
  role?: string | null;
  provider?: string | null;
  model?: string | null;
  update_kind?: string | null;
  content_types?: string[] | null;
  text_preview?: string | null;
  text_chars?: number | null;
  reasoning_kind?: string | null;
  reasoning_chars?: number | null;
  reasoning_redacted?: boolean | null;
  reasoning_summary_preview?: string | null;
  reasoning_summary_chars?: number | null;
  reasoning_summary_source?: string | null;
  thinking_chars?: number | null;
  stop_reason?: string | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
  args_preview?: string | null;
  result_preview?: string | null;
  is_error?: boolean | null;
  tool_calls?: Array<{
    id?: string | null;
    name?: string | null;
    args_preview?: string | null;
  }> | null;
  [key: string]: unknown;
}

export interface SubagentRunArtifactSnapshot {
  dir: string;
  readable: boolean;
  status_json: string | null;
  events_tail: string | null;
  stdout_tail: string | null;
  stderr_tail: string | null;
  session_file_path: string | null;
  session_tail: string | null;
  read_error: string | null;
}

export interface AttentionItem {
  id: string;
  project_id: string;
  task_id: number | null;
  run_id: string | null;
  review_round_id: number | null;
  dispatch_id: number | null;
  message_id: number | null;
  kind: string;
  severity: string;
  title: string;
  summary: string;
  created_at: string;
  latest_at: string;
  suggested_action: string;
}
