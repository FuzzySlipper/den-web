import type { Channel, ChannelMessage, ChannelReactionSummary, ChannelActivityEvent, ChannelProjectLink, ActiveWorkRouteResponse, ActiveWorkRoutesResponse, AgentWorkCurrentResponse, AgentWorkEventsResponse, DirectAgentEventsResponse, DirectConversation, DirectConversationEntriesResponse, DirectConversationCreateRequest, ReadCursor } from './types';
import { normalizeApiBase } from '../config';
import { addConversationSuccessorReaction, conversationSuccessorConfigured, conversationSuccessorReactionsEnabledForMessage, conversationSuccessorReadsEnabledForChannel as channelUsesConversationSuccessor, conversationSuccessorReadsEnabledForProject, conversationSuccessorWritesEnabledForChannel, conversationSuccessorWritesEnabledForProject, ensureConversationSuccessorAgentCommonsChannel, listConversationSuccessorChannels, listConversationSuccessorMessages, postConversationSuccessorMessage, postConversationSuccessorProjectMessage, putConversationSuccessorProjectDefaultChannel, reinitConversationSuccessorReads, type ConversationSuccessorReadConfig } from './conversationSuccessor';
import { timelineChannelStreamUrl, timelineSuccessorEnabledForChannelId } from '../timeline/client';
import { reinitDirectMessagesRuntime } from './directMessages';
export { sendDirectMessage } from './directMessages';
export { channelUsesConversationSuccessor };

let denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');

/** Reinitialize base URL from runtime config */
export function reinitChannelsBase(base: string): void {
  denChannelsApiBase = normalizeApiBase(base, '/api');
}

export function reinitChannelsRuntime(config: { denChannelsApiBase: string; conversationSuccessorReads: Partial<ConversationSuccessorReadConfig> }): void {
  reinitChannelsBase(config.denChannelsApiBase);
  reinitDirectMessagesRuntime(config.denChannelsApiBase);
  reinitConversationSuccessorReads(config.conversationSuccessorReads);
}

function channelsApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denChannelsApiBase}${url.startsWith('/') ? url : `/${url}`}`;
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
  includeDebug?: boolean;
}

/**
 * Resolve the channel SSE stream URL (#2146), against the runtime channels base.
 * The stream is consumed via EventSource, not the JSON `get` helpers, so this
 * only builds the URL. Reconnect normally relies on EventSource's Last-Event-ID;
 * the explicit cursor query is available for a fresh connect from a known point.
 */
export function channelEventStreamUrl(channelId: number, cursor: ChannelEventStreamCursor = {}): string {
  if (timelineSuccessorEnabledForChannelId(channelId)) {
    return timelineChannelStreamUrl(channelId, { after: cursor.afterTimelineCursor ?? null, includeDebug: cursor.includeDebug });
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
  if (conversationSuccessorConfigured() && (!opts.projectId || conversationSuccessorReadsEnabledForProject(opts.projectId))) {
    return listConversationSuccessorChannels(opts);
  }
  return Promise.resolve([]);
}

export function listProjectLinkedChannels(projectId: string): Promise<Channel[]> {
  void projectId;
  return Promise.resolve([]);
}

export function listChannelLinkedProjects(channelId: number): Promise<ChannelProjectLink[]> {
  void channelId;
  return Promise.resolve([]);
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
  void request;
  return Promise.resolve({
    routeStatus: 'no_active_route',
    reason: 'Legacy den-channels active-work routing is retired; direct sends use Delivery intents.',
    route: null,
    evidence: {
      sources: [{ source: 'den-services-delivery', available: true, recordsExamined: 0, detail: 'Use /api/v1/delivery/intents for wake routing.' }],
      candidatesConsidered: 0,
      resolvedAt: new Date().toISOString(),
    },
  });
}

export function listActiveWorkRoutes(opts: ListActiveWorkRoutesOpts = {}): Promise<ActiveWorkRoutesResponse> {
  void opts;
  return Promise.resolve({
    routes: [],
    totalCount: 0,
    evidence: {
      sources: [{ source: 'den-services-observation', available: true, recordsExamined: 0, detail: 'Focused-session route listing is waiting on successor parity.' }],
      candidatesConsidered: 0,
      resolvedAt: new Date().toISOString(),
    },
  });
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
  return putConversationSuccessorProjectDefaultChannel(projectId, request);
}

export function ensureAgentCommonsChannel(): Promise<Channel> {
  return ensureConversationSuccessorAgentCommonsChannel();
}

export interface ListChannelMessagesOpts { afterId?: number; limit?: number; }

export function listChannelMessages(channelId: number, opts: ListChannelMessagesOpts = {}): Promise<ChannelMessage[]> {
  if (channelUsesConversationSuccessor(channelId)) {
    return listConversationSuccessorMessages(channelId, opts);
  }
  return Promise.resolve([]);
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
  void channelId;
  void opts;
  return Promise.resolve([]);
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
  void opts;
  return Promise.resolve({
    items: [],
    totalCount: 0,
    generatedAt: new Date().toISOString(),
    stalenessSummary: null,
    migrationNote: 'Legacy den-channels agent-work projection is retired; timeline/observation successor data is shown in the channel feed.',
  });
}

export function listAgentWorkEvents(opts: ListAgentWorkOpts = {}): Promise<AgentWorkEventsResponse> {
  return Promise.resolve({ items: [], count: 0, channelId: opts.channelId ?? null, filters: {} });
}

export interface ListDirectAgentEventsOpts {
  channelId?: number;
  afterId?: number;
  limit?: number;
}

export function listDirectAgentEvents(opts: ListDirectAgentEventsOpts = {}): Promise<DirectAgentEventsResponse> {
  void opts;
  return Promise.resolve({ items: [], nextAfterId: null, hasMore: false });
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
  const sourceProjectId = request.sourceProjectId;
  if (conversationSuccessorWritesEnabledForChannel(channelId)) {
    return postConversationSuccessorMessage(channelId, request);
  }
  if (sourceProjectId && conversationSuccessorWritesEnabledForProject(sourceProjectId)) {
    return postConversationSuccessorProjectMessage(sourceProjectId, request);
  }
  return Promise.reject(new Error(`Conversation successor writes are not enabled for channel ${channelId}.`));
}

export function listChannelReactions(channelId: number): Promise<ChannelReactionSummary[]> {
  void channelId;
  return Promise.resolve([]);
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
  void request;
  return Promise.reject(new Error(`Conversation successor reactions are not enabled for message ${messageId}.`));
}

export interface ListDirectConversationsOpts {
  humanIdentity?: string;
  limit?: number;
  afterId?: number;
}
export async function listDirectConversations(opts: ListDirectConversationsOpts = {}): Promise<DirectConversation[]> {
  void opts;
  return [];
}

export function createDirectConversation(request: DirectConversationCreateRequest): Promise<DirectConversation> {
  return Promise.reject(new Error(`Legacy direct-conversation transcripts are retired for ${request.agentIdentity}. Use channel direct-agent mode.`));
}
export function getDirectConversation(conversationId: number): Promise<DirectConversation> {
  return Promise.reject(new Error(`Legacy direct-conversation transcript ${conversationId} is retired.`));
}

export interface ListDirectConversationEntriesOpts {
  limit?: number;
  afterId?: number;
}

export function listDirectConversationEntries(conversationId: number, opts: ListDirectConversationEntriesOpts = {}): Promise<DirectConversationEntriesResponse> {
  void conversationId;
  void opts;
  return Promise.resolve({ entries: [], nextCursor: null, hasMore: false });
}

export function updateReadCursor(conversationId: number, request: { readerIdentity: string; lastReadEntryId?: number | null }): Promise<ReadCursor> {
  return Promise.resolve({
    conversationId,
    readerIdentity: request.readerIdentity,
    lastReadEntryId: request.lastReadEntryId ?? null,
    updatedAt: new Date().toISOString(),
  });
}

export function getReadCursor(conversationId: number, readerIdentity: string): Promise<ReadCursor> {
  return Promise.resolve({
    conversationId,
    readerIdentity,
    lastReadEntryId: null,
    updatedAt: new Date().toISOString(),
  });
}
