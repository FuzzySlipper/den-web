export interface TimelineScope {
  kind: 'channel' | 'project' | string;
  channel_id?: number | null;
  project_id?: string | null;
}

export interface TimelineActor {
  type?: string | null;
  identity?: string | null;
  profile_identity?: string | null;
  agent_instance_id?: string | null;
}

export interface TimelineSourceRef {
  domain?: string | null;
  table?: string | null;
  id?: string | null;
}

export interface TimelineItem {
  timeline_id: string;
  cursor: string;
  occurred_at: string;
  source_domain: string;
  source_id: string;
  event_kind: string;
  render_kind: string;
  display_only: boolean;
  channel_id: number | null;
  project_id: string | null;
  task_id: number | null;
  actor: TimelineActor | null;
  body: string | null;
  summary: string | null;
  severity: string | null;
  metadata: Record<string, unknown> | null;
  source_ref: TimelineSourceRef | null;
}

export interface TimelineItemsResponse {
  scope: TimelineScope;
  items: TimelineItem[];
  next_cursor: string | null;
  snapshot_at: string;
}

export interface TimelineStreamOpenEvent {
  scope: TimelineScope;
  cursor?: string | null;
  supported_events?: string[];
  heartbeat_ms?: number;
}

export interface TimelineRefreshEvent {
  reason?: string | null;
  after?: string | null;
}

export interface TimelineHeartbeatEvent {
  now?: string | null;
  cursor?: string | null;
}

