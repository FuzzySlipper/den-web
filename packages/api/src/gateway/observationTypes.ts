export type ObservationSeverity = 'info' | 'success' | 'warning' | 'error' | string;
export type ObservationVisibility = 'channel' | 'task' | 'agent' | 'debug' | string;

export interface ObservationAgentIdentity {
  profile: string;
  instance_id: string;
  session_key?: string | null;
}

export interface ObservationWorkRef {
  project_id?: string | null;
  task_id?: number | null;
  assignment_id?: string | null;
  run_id?: string | null;
  review_round_id?: string | null;
  channel_id?: number | null;
  channel_message_id?: number | null;
}

export interface ObservationResultRef {
  document_slug?: string | null;
  message_id?: number | null;
  commit?: string | null;
  artifact_path?: string | null;
}

export interface ObservationAgentActivityPayload {
  kind?: 'agent_activity.v1' | string;
  schema_version?: number;
  summary?: string | null;
  severity?: ObservationSeverity | null;
  visibility?: ObservationVisibility | null;
  adapter?: string | null;
  surface?: string | null;
  work_ref?: ObservationWorkRef | null;
  result_ref?: ObservationResultRef | null;
  session_key?: string | null;
  tool_name?: string | null;
  model?: string | null;
  reason_code?: string | null;
  [key: string]: unknown;
}

export interface ObservationLaneEvent {
  event_id: string;
  source_domain: string;
  event_type: string;
  agent_identity?: ObservationAgentIdentity | null;
  runtime_instance_id?: string | null;
  payload: ObservationAgentActivityPayload | Record<string, unknown> | string | null;
  display_only: boolean;
  created_at: string;
}

export interface ObservationLaneResponse {
  events: ObservationLaneEvent[];
}

export interface ObservationActiveWorkItem {
  intent_id: number;
  target_identity: ObservationAgentIdentity;
  state: string;
  claimed_by?: ObservationAgentIdentity | null;
  runtime_instance_id?: string | null;
  runtime_state?: string | null;
  source_ref?: string | null;
  channel_message_id?: number | null;
  created_at: string;
}

export interface ObservationActiveWorkResponse {
  items: ObservationActiveWorkItem[];
}

export interface ObservationRuntimeProjection {
  runtime_instance_id: string;
  profile_identity: string;
  host: string;
  state: string;
  last_heartbeat_at?: string | null;
  started_at: string;
  display_only: boolean;
}

export interface ObservationAgentOverviewResponse {
  agent_id: string;
  runtime_instances: ObservationRuntimeProjection[];
  active_work: ObservationActiveWorkItem[];
  activity_events: ObservationLaneEvent[];
}
