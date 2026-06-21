import type { Channel, ChannelActivityEvent, ChannelMessage } from '../channels/types';
import { registerConversationSuccessorChannel, registerConversationSuccessorMessageId } from '../channels/conversationSuccessor';
import { normalizeApiBase } from '../config';
import { dedupedFetch } from '../requestCache';
import type { TimelineItem, TimelineItemsResponse } from './types';

export interface TimelineSuccessorConfig {
  enabled: boolean;
  apiBase: string;
  projectIds: string[];
}

export interface TimelineChannelProjection {
  messages: ChannelMessage[];
  activityEvents: ChannelActivityEvent[];
  nextCursor: string | null;
  snapshotAt: string | null;
}

export interface ListTimelineItemsOpts {
  after?: string | null;
  limit?: number;
  includeDebug?: boolean;
}

let config: TimelineSuccessorConfig = {
  enabled: false,
  apiBase: '/api/v1/timeline',
  projectIds: [],
};
const timelineChannelProjects = new Map<number, string | null>();

export function reinitTimelineSuccessor(next: Partial<TimelineSuccessorConfig>): void {
  config = {
    enabled: next.enabled ?? false,
    apiBase: normalizeApiBase(next.apiBase, '/api/v1/timeline'),
    projectIds: [...new Set((next.projectIds ?? []).map(id => id.trim()).filter(Boolean))],
  };
  timelineChannelProjects.clear();
}

export function timelineSuccessorEnabledForChannel(channel: Channel | null | undefined): boolean {
  if (!config.enabled || !channel) return false;
  const projectId = channel.projectId ?? null;
  timelineChannelProjects.set(channel.id, projectId);
  registerConversationSuccessorChannel(channel.id, projectId);
  if (!projectId && channel.kind === 'system') return true;
  return Boolean(projectId && config.projectIds.includes(projectId));
}

export function timelineSuccessorEnabledForChannelId(channelId: number): boolean {
  if (!config.enabled) return false;
  const projectId = timelineChannelProjects.get(channelId);
  if (projectId === null) return true;
  return Boolean(projectId && config.projectIds.includes(projectId));
}

function timelineUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${config.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function getTimeline<T>(path: string): Promise<T> {
  const requestUrl = timelineUrl(path);
  return dedupedFetch(`GET timeline ${requestUrl}`, async () => {
    const res = await fetch(requestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
    return res.json();
  });
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sourceNumericId(item: TimelineItem): number {
  const direct = Number(item.source_id);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = /:(\d+)$/.exec(item.timeline_id);
  return match ? Number(match[1]) : 0;
}

function jsonStringValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function timelineItemToChannelMessage(item: TimelineItem): ChannelMessage {
  const metadata = item.metadata ?? {};
  const messageId = sourceNumericId(item);
  const channelId = item.channel_id ?? 0;
  const projectId = item.project_id ?? nullableString(metadata.project_id);
  registerConversationSuccessorChannel(channelId, projectId);
  registerConversationSuccessorMessageId(messageId, projectId);
  return {
    id: messageId,
    channelId,
    senderType: stringValue(item.actor?.type, 'agent'),
    senderIdentity: stringValue(item.actor?.identity ?? item.actor?.profile_identity, 'unknown'),
    body: stringValue(item.body),
    messageKind: stringValue(metadata.message_kind, item.event_kind || 'message'),
    sourceKind: nullableString(metadata.source_kind),
    sourceId: nullableString(metadata.source_id),
    sourceProjectId: projectId,
    targetProjectId: nullableString(metadata.target_project_id),
    targetTaskId: nullableNumber(item.task_id ?? metadata.target_task_id),
    assignmentId: nullableString(metadata.assignment_id),
    workerRunId: nullableString(metadata.worker_run_id),
    workerRole: nullableString(metadata.worker_role),
    profileIdentity: nullableString(item.actor?.profile_identity ?? metadata.profile_identity),
    agentInstanceId: nullableString(item.actor?.agent_instance_id ?? metadata.agent_instance_id),
    poolMemberId: nullableString(metadata.pool_member_id),
    sessionOwnerId: nullableString(metadata.session_owner_id),
    sessionId: nullableString(metadata.session_id),
    summary: item.summary,
    deepLink: nullableString(metadata.deep_link),
    threadRootMessageId: nullableNumber(metadata.thread_root_message_id),
    replyToMessageId: nullableNumber(metadata.reply_to_message_id),
    metadataJson: jsonStringValue(metadata),
    deliveryRequestId: nullableString(metadata.delivery_request_id),
    dedupeKey: nullableString(metadata.dedupe_key) ?? item.timeline_id,
    finalChannelMessageId: nullableNumber(metadata.final_channel_message_id),
    createdAt: item.occurred_at,
    editedAt: nullableString(metadata.edited_at),
    deletedAt: nullableString(metadata.deleted_at),
  };
}

export function timelineItemToChannelActivityEvent(item: TimelineItem): ChannelActivityEvent {
  const metadata = item.metadata ?? {};
  const workRef = objectRecord(metadata.work_ref);
  const resultRef = objectRecord(metadata.result_ref);
  return {
    id: -3_000_000 - Math.abs(hashCode(item.timeline_id) % 900_000_000),
    channelId: item.channel_id ?? nullableNumber(workRef.channel_id) ?? 0,
    projectId: item.project_id ?? nullableString(workRef.project_id),
    agentIdentity: stringValue(item.actor?.identity ?? item.actor?.profile_identity, 'unknown-agent'),
    deliveryRequestId: nullableString(metadata.delivery_request_id),
    hermesSessionKey: nullableString(metadata.session_key),
    displayBlockId: nullableString(metadata.display_block_id ?? workRef.run_id ?? workRef.assignment_id ?? item.timeline_id),
    parentHermesSessionKey: nullableString(metadata.parent_session_key),
    parentAgentIdentity: nullableString(metadata.parent_agent_identity),
    workerRunId: nullableString(workRef.run_id ?? metadata.worker_run_id),
    workerRole: nullableString(metadata.surface),
    assignmentId: nullableString(workRef.assignment_id),
    agentInstanceId: nullableString(item.actor?.agent_instance_id),
    poolMemberId: nullableString(metadata.pool_member_id),
    taskId: nullableNumber(item.task_id ?? workRef.task_id),
    threadId: null,
    anchorMessageId: nullableNumber(workRef.channel_message_id),
    eventType: item.event_kind || 'timeline_event',
    status: item.severity ?? 'info',
    deliveryStage: stringValue(metadata.visibility, item.display_only ? 'display-only' : 'progress'),
    terminal: item.severity === 'success' || item.severity === 'error',
    sequence: Math.abs(hashCode(item.timeline_id) % 900_000_000),
    updateVersion: 1,
    title: item.event_kind,
    summary: item.summary ?? item.body,
    previewJson: JSON.stringify({ preview: item.summary ?? item.body ?? item.event_kind }),
    metadataJson: JSON.stringify({ ...metadata, source: 'timeline', timelineId: item.timeline_id, sourceRef: item.source_ref, resultRef }),
    dedupeKey: item.timeline_id,
    finalChannelMessageId: nullableNumber(resultRef.message_id),
    createdAt: item.occurred_at,
    updatedAt: item.occurred_at,
  };
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) | 0;
  }
  return hash;
}

export async function listChannelTimelineItems(channelId: number, opts: ListTimelineItemsOpts = {}): Promise<TimelineChannelProjection> {
  const q = buildQuery({ after: opts.after, limit: opts.limit, include_debug: opts.includeDebug });
  const response = await getTimeline<TimelineItemsResponse>(`/channels/${encodeURIComponent(String(channelId))}/items${q}`);
  return {
    messages: response.items.filter(item => item.render_kind === 'message').map(timelineItemToChannelMessage),
    activityEvents: response.items.filter(item => item.render_kind !== 'message').map(timelineItemToChannelActivityEvent),
    nextCursor: response.next_cursor,
    snapshotAt: response.snapshot_at,
  };
}

export function timelineChannelStreamUrl(channelId: number, opts: { after?: string | null; includeDebug?: boolean } = {}): string {
  const q = buildQuery({ after: opts.after, include_debug: opts.includeDebug });
  return timelineUrl(`/channels/${encodeURIComponent(String(channelId))}/stream${q}`);
}
