import type { Channel, ChannelMessage, ChannelReactionSummary, ChannelActivityEvent, ChannelProjectLink, ActiveWorkRouteResponse, ActiveWorkRoutesResponse, AgentWorkCurrentResponse, AgentWorkEventsResponse, DirectAgentEventsResponse, DirectConversation, DirectConversationListResponse, DirectConversationEntriesResponse, DirectConversationSendRequest, DirectConversationSendResponse, DirectConversationCreateRequest, ReadCursor } from './types';
import { normalizeApiBase } from '../config';
import { dedupedFetch } from '../requestCache';

let denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');

/** Reinitialize base URL from runtime config */
export function reinitChannelsBase(base: string): void {
  denChannelsApiBase = normalizeApiBase(base, '/api');
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

export interface ListChannelsOpts {
  projectId?: string;
  kind?: string;
  limit?: number;
}

export function listChannels(opts: ListChannelsOpts = {}): Promise<Channel[]> {
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
  return getChannels(`/agent-work/events${q}`);
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
  return postChannels(`/channel-messages/${messageId}/reactions`, request);
}

// =========================================================================
// Direct Conversation / DM Transcript API (task #2003 / den-web #2004)
// =========================================================================

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

export function sendDirectMessage(conversationId: number, request: DirectConversationSendRequest): Promise<DirectConversationSendResponse> {
  return postChannels(`/direct-conversations/${conversationId}/send`, request);
}

export function updateReadCursor(conversationId: number, request: { readerIdentity: string; lastReadEntryId?: number | null }): Promise<ReadCursor> {
  return putChannels(`/direct-conversations/${conversationId}/read-cursor`, request);
}

export function getReadCursor(conversationId: number, readerIdentity: string): Promise<ReadCursor> {
  return getChannels(`/direct-conversations/${conversationId}/read-cursor?readerIdentity=${esc(readerIdentity)}`);
}
