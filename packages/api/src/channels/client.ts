import type { Channel, ChannelMessage, ChannelReactionSummary, ChannelActivityEvent, ChannelProjectLink, ActiveWorkRouteResponse, ActiveWorkRoutesResponse, AgentWorkCurrentResponse, AgentWorkEventsResponse, AgentWorkLifecycleEvent, DirectAgentEventsResponse, DirectConversation, DirectConversationListResponse, DirectConversationEntriesResponse, DirectConversationCreateRequest, ReadCursor } from './types';
import { normalizeApiBase } from '../config';
import { dedupedFetch } from '../requestCache';
import { addConversationSuccessorReaction, conversationSuccessorReactionsEnabledForMessage, conversationSuccessorReadsEnabledForChannel, conversationSuccessorReadsEnabledForProject, conversationSuccessorWritesEnabledForChannel, listConversationSuccessorChannels, listConversationSuccessorMessages, postConversationSuccessorMessage, reinitConversationSuccessorReads, type ConversationSuccessorReadConfig } from './conversationSuccessor';
import { timelineChannelStreamUrl, timelineSuccessorEnabledForChannelId } from '../timeline/client';
import { reinitDirectMessagesRuntime } from './directMessages';
export { sendDirectMessage } from './directMessages';

let denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');

/** Reinitialize base URL from runtime config */
export function reinitChannelsBase(base: string): void {
  denChannelsApiBase = normalizeApiBase(base, '/api');
}

export function reinitChannelsRuntime(config: {
  denChannelsApiBase: string;
  conversationSuccessorReads: Partial<ConversationSuccessorReadConfig>;
}): void {
  reinitChannelsBase(config.denChannelsApiBase);
  reinitDirectMessagesRuntime(config.denChannelsApiBase);
  reinitConversationSuccessorReads(config.conversationSuccessorReads);
}

function channelsApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denChannelsApiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

function getChannels<T>(url: string): Promise<T> {
  const requestUrl = channelsApiUrl(url);
  // Share overlapping identical GETs across panels (#2145).
  return dedupedFetch(`GET ${requestUrl}`, async () => {
    const res = await fetch(requestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
    return res.json();
  });
}

async function putChannels<T>(url: string, body: unknown): Promise<T> {
  const requestUrl = channelsApiUrl(url);
  const res = await fetch(requestUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${requestUrl}: ${res.status}`);
  return res.json();
}

async function postChannels<T>(url: string, body: unknown): Promise<T> {
  const requestUrl = channelsApiUrl(url);
  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${requestUrl}: ${res.status}`);
  return res.json();
}

function esc(s: string): string {
  return encodeURIComponent(s);
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export interface ChannelEventStreamCursor {
  afterMessageId?: number;
  afterActivityId?: number;
  afterTimelineCursor?: string | null;
}

/**
 * Resolve the channel SSE stream URL (#2146), against the runtime channels base.
 * The stream is consumed via EventSource, not the JSON `get` helpers, so this
 * only builds the URL. Reconnect normally relies on EventSource's Last-Event-ID;
 * the explicit cursor query is available for a fresh connect from a known point.
 */
export function channelEventStreamUrl(channelId: number, cursor: ChannelEventStreamCursor = {}): string {
  if (timelineSuccessorEnabledForChannelId(channelId)) {
    return timelineChannelStreamUrl(channelId, { after: cursor.afterTimelineCursor ?? null });
  }
  const q = buildQuery({
    afterMessageId: cursor.afterMessageId,
    afterActivityId: cursor.afterActivityId,
  });
  return channelsApiUrl(`/channels/${channelId}/events/stream${q}`);
}

export interface ListChannelsOpts {
  projectId?: string;
  kind?: string;
  limit?: number;
}

export function listChannels(opts: ListChannelsOpts = {}): Promise<Channel[]> {
  if (conversationSuccessorReadsEnabledForProject(opts.projectId)) {
    return listConversationSuccessorChannels(opts);
  }
  const q = buildQuery({ projectId: opts.projectId, kind: opts.kind, limit: opts.limit });
  return getChannels(`/channels${q}`);
}

export function listProjectLinkedChannels(projectId: string): Promise<Channel[]> {
  return getChannels(`/projects/${esc(projectId)}/linked-channels`);
}

export function listChannelLinkedProjects(channelId: number): Promise<ChannelProjectLink[]> {
  return getChannels(`/channels/${channelId}/linked-projects`);
}

export interface ResolveActiveWorkRouteRequest {
  targetProjectId?: string | null;
  targetTaskId?: number | null;
  assignmentId?: string | null;
  workerRunId?: string | null;
  profileIdentity?: string | null;
  sourceChannelId?: number | null;
  sourceProjectId?: string | null;
}

export interface ListActiveWorkRoutesOpts {
  targetProjectId?: string | null;
  targetTaskId?: number | null;
  assignmentId?: string | null;
  profileIdentity?: string | null;
  includeStale?: boolean;
  limit?: number;
}

export function resolveActiveWorkRoute(request: ResolveActiveWorkRouteRequest): Promise<ActiveWorkRouteResponse> {
  return postChannels('/active-work/resolve', request);
}

export function listActiveWorkRoutes(opts: ListActiveWorkRoutesOpts = {}): Promise<ActiveWorkRoutesResponse> {
  const q = buildQuery({
    targetProjectId: opts.targetProjectId,
    targetTaskId: opts.targetTaskId,
    assignmentId: opts.assignmentId,
    profileIdentity: opts.profileIdentity,
    includeStale: opts.includeStale,
    limit: opts.limit,
  });
  return getChannels(`/active-work/routes${q}`);
}

export interface EnsureProjectDefaultChannelRequest {
  displayName?: string;
  createdBy?: string;
  settingsJson?: string | null;
}

export function ensureProjectDefaultChannel(
  projectId: string,
  request: EnsureProjectDefaultChannelRequest = {},
): Promise<Channel> {
  return putChannels(`/projects/${esc(projectId)}/default-channel`, {
    displayName: request.displayName,
    createdBy: request.createdBy ?? 'den-web',
    settingsJson: request.settingsJson,
  });
}

export function ensureAgentCommonsChannel(): Promise<Channel> {
  return putChannels('/agent-commons', {});
}

export interface ListChannelMessagesOpts {
  afterId?: number;
  limit?: number;
}

export function listChannelMessages(channelId: number, opts: ListChannelMessagesOpts = {}): Promise<ChannelMessage[]> {
  if (conversationSuccessorReadsEnabledForChannel(channelId)) {
    return listConversationSuccessorMessages(channelId, opts);
  }
  const q = buildQuery({ afterId: opts.afterId, limit: opts.limit });
  return getChannels(`/channels/${channelId}/messages${q}`);
}

export interface ListChannelActivityEventsOpts {
  deliveryRequestId?: string;
  hermesSessionKey?: string;
  displayBlockId?: string;
  workerRunId?: string;
  anchorMessageId?: number;
  taskId?: number;
  afterId?: number;
  limit?: number;
}

export function listChannelActivityEvents(channelId: number, opts: ListChannelActivityEventsOpts = {}): Promise<ChannelActivityEvent[]> {
  const q = buildQuery({
    deliveryRequestId: opts.deliveryRequestId,
    hermesSessionKey: opts.hermesSessionKey,
    displayBlockId: opts.displayBlockId,
    workerRunId: opts.workerRunId,
    anchorMessageId: opts.anchorMessageId,
    taskId: opts.taskId,
    afterId: opts.afterId,
    limit: opts.limit,
  });
  return getChannels(`/channels/${channelId}/activity-events${q}`);
}

export interface ListAgentWorkOpts {
  channelId?: number;
  agentIdentity?: string;
  taskId?: number;
  workerRunId?: string;
  assignmentId?: string;
  sessionId?: string;
  limit?: number;
}

export function listAgentWorkCurrent(opts: Pick<ListAgentWorkOpts, 'channelId' | 'limit'> = {}): Promise<AgentWorkCurrentResponse> {
  const q = buildQuery({ channelId: opts.channelId, limit: opts.limit });
  return getChannels(`/agent-work/current${q}`);
}

export function listAgentWorkEvents(opts: ListAgentWorkOpts = {}): Promise<AgentWorkEventsResponse> {
  const q = buildQuery({
    channelId: opts.channelId,
    agentIdentity: opts.agentIdentity,
    taskId: opts.taskId,
    workerRunId: opts.workerRunId,
    assignmentId: opts.assignmentId,
    sessionId: opts.sessionId,
    limit: opts.limit,
  });
  return getChannels<AgentWorkEventsResponse | { events?: AgentWorkEventsResponse['items']; count?: number; channelId?: number | null; filters?: Record<string, string | number | boolean | null> }>(`/agent-work/events${q}`)
    .then(response => 'items' in response
      ? { ...response, items: response.items.map(normalizeAgentWorkLifecycleEvent) }
      : {
        items: (response.events ?? []).map(normalizeAgentWorkLifecycleEvent),
        count: response.count ?? response.events?.length ?? 0,
        channelId: response.channelId ?? opts.channelId ?? null,
        filters: response.filters ?? {},
      });
}

function normalizeAgentWorkLifecycleEvent(event: AgentWorkLifecycleEvent): AgentWorkLifecycleEvent {
  const metadata = event.metadata ?? {};
  return {
    ...event,
    state: event.state ?? event.status ?? null,
    source: firstMetadataString(event.source, metadata.source),
    eventFamily: firstMetadataString(event.eventFamily, metadata.eventFamily, metadata.event_family),
    piCrewEventType: firstMetadataString(event.piCrewEventType, metadata.piCrewEventType, metadata.pi_crew_event_type),
    childSessionId: firstMetadataString(event.childSessionId, metadata.childSessionId, metadata.child_session_id),
    rootSessionId: firstMetadataString(event.rootSessionId, metadata.rootSessionId, metadata.root_session_id),
    ownerSessionId: firstMetadataString(event.ownerSessionId, metadata.ownerSessionId, metadata.owner_session_id),
    toolName: firstMetadataString(event.toolName, metadata.toolName, metadata.tool_name),
    toolCallId: firstMetadataString(event.toolCallId, metadata.toolCallId, metadata.tool_call_id),
    phase: firstMetadataString(event.phase, metadata.phase),
    provider: firstMetadataString(event.provider, metadata.provider),
    model: firstMetadataString(event.model, metadata.model),
    policyId: firstMetadataString(event.policyId, metadata.policyId, metadata.policy_id),
    outcome: firstMetadataString(event.outcome, metadata.outcome),
    durationMs: firstMetadataNumber(event.durationMs, metadata.durationMs, metadata.duration_ms),
    depth: firstMetadataNumber(event.depth, metadata.depth),
    turnsUsed: firstMetadataNumber(event.turnsUsed, metadata.turnsUsed, metadata.turns_used),
    tokensConsumed: event.tokensConsumed ?? firstMetadataNumber(null, metadata.tokensConsumed, metadata.tokens_consumed),
    artifactCount: firstMetadataNumber(event.artifactCount, metadata.artifactCount, metadata.artifact_count),
    isError: firstMetadataBoolean(event.isError, metadata.isError, metadata.is_error),
    evidenceChecked: firstMetadataBoolean(event.evidenceChecked, metadata.evidenceChecked, metadata.evidence_checked),
  };
}

function firstMetadataString(...values: unknown[]): string | null | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstMetadataNumber(...values: unknown[]): number | null | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function firstMetadataBoolean(...values: unknown[]): boolean | null | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === 'true';
  }
  return undefined;
}

export interface ListDirectAgentEventsOpts {
  channelId?: number;
  afterId?: number;
  limit?: number;
}

export function listDirectAgentEvents(opts: ListDirectAgentEventsOpts = {}): Promise<DirectAgentEventsResponse> {
  const q = buildQuery({ channelId: opts.channelId, afterId: opts.afterId, limit: opts.limit });
  return getChannels(`/direct-agent-events${q}`);
}

export interface PostChannelMessageRequest {
  senderType: string;
  senderIdentity: string;
  body: string;
  messageKind?: string;
  sourceKind?: string | null;
  sourceId?: string | null;
  sourceProjectId?: string | null;
  targetProjectId?: string | null;
  targetTaskId?: number | null;
  assignmentId?: string | null;
  workerRunId?: string | null;
  workerRole?: string | null;
  profileIdentity?: string | null;
  agentInstanceId?: string | null;
  poolMemberId?: string | null;
  sessionOwnerId?: string | null;
  sessionId?: string | null;
  summary?: string | null;
  deepLink?: string | null;
  threadRootMessageId?: number | null;
  replyToMessageId?: number | null;
  metadataJson?: string | null;
  deliveryRequestId?: string | null;
  dedupeKey?: string | null;
}

export function postChannelMessage(channelId: number, request: PostChannelMessageRequest): Promise<ChannelMessage> {
  if (conversationSuccessorWritesEnabledForChannel(channelId)) {
    return postConversationSuccessorMessage(channelId, request);
  }
  return postChannels(`/channels/${channelId}/messages`, request);
}

export function listChannelReactions(channelId: number): Promise<ChannelReactionSummary[]> {
  return getChannels(`/channels/${channelId}/reactions`);
}

export interface AddChannelReactionRequest {
  reactorType: string;
  reactorIdentity: string;
  reactionKey: string;
}

export function addChannelReaction(messageId: number, request: AddChannelReactionRequest): Promise<unknown> {
  if (conversationSuccessorReactionsEnabledForMessage(messageId)) {
    return addConversationSuccessorReaction(messageId, request);
  }
  return postChannels(`/channel-messages/${messageId}/reactions`, request);
}

export interface ListDirectConversationsOpts {
  humanIdentity?: string;
  limit?: number;
  afterId?: number;
}
export async function listDirectConversations(opts: ListDirectConversationsOpts = {}): Promise<DirectConversation[]> {
  const q = buildQuery({ humanIdentity: opts.humanIdentity, limit: opts.limit, afterId: opts.afterId });
  const response = await getChannels<DirectConversationListResponse | DirectConversation[]>(`/direct-conversations${q}`);
  return Array.isArray(response) ? response : response.conversations;
}

export function createDirectConversation(request: DirectConversationCreateRequest): Promise<DirectConversation> {
  return postChannels('/direct-conversations', request);
}
export function getDirectConversation(conversationId: number): Promise<DirectConversation> {
  return getChannels(`/direct-conversations/${conversationId}`);
}

export interface ListDirectConversationEntriesOpts {
  limit?: number;
  afterId?: number;
}

export function listDirectConversationEntries(conversationId: number, opts: ListDirectConversationEntriesOpts = {}): Promise<DirectConversationEntriesResponse> {
  const q = buildQuery({ limit: opts.limit, afterId: opts.afterId });
  return getChannels(`/direct-conversations/${conversationId}/entries${q}`);
}

export function updateReadCursor(conversationId: number, request: { readerIdentity: string; lastReadEntryId?: number | null }): Promise<ReadCursor> {
  return putChannels(`/direct-conversations/${conversationId}/read-cursor`, request);
}

export function getReadCursor(conversationId: number, readerIdentity: string): Promise<ReadCursor> {
  return getChannels(`/direct-conversations/${conversationId}/read-cursor?readerIdentity=${esc(readerIdentity)}`);
}
