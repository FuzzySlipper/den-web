import type { AddChannelReactionRequest, PostChannelMessageRequest } from './client';
import type { Channel, ChannelMessage } from './types';
import { normalizeApiBase } from '../config';
import { dedupedFetch } from '../requestCache';
import type { ListChannelsOpts, ListChannelMessagesOpts } from './client';

export interface ConversationSuccessorReadConfig {
  enabled: boolean;
  writeEnabled: boolean;
  apiBase: string;
  projectIds: string[];
  writeProjectIds: string[];
}

type JsonObject = Record<string, unknown>;

interface SuccessorChannelDto extends JsonObject {
  id?: unknown;
  slug?: unknown;
  display_name?: unknown;
  displayName?: unknown;
  kind?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  space_id?: unknown;
  spaceId?: unknown;
  created_by?: unknown;
  createdBy?: unknown;
  visibility?: unknown;
  settings?: unknown;
  settings_json?: unknown;
  settingsJson?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  archived_at?: unknown;
  archivedAt?: unknown;
}

interface SuccessorMessageDto extends JsonObject {
  id?: unknown;
  channel_id?: unknown;
  channelId?: unknown;
  sender_type?: unknown;
  senderType?: unknown;
  sender_identity?: unknown;
  senderIdentity?: unknown;
  body?: unknown;
  message_kind?: unknown;
  messageKind?: unknown;
  source_kind?: unknown;
  sourceKind?: unknown;
  source_id?: unknown;
  sourceId?: unknown;
  source_project_id?: unknown;
  sourceProjectId?: unknown;
  target_project_id?: unknown;
  targetProjectId?: unknown;
  target_task_id?: unknown;
  targetTaskId?: unknown;
  assignment_id?: unknown;
  assignmentId?: unknown;
  worker_run_id?: unknown;
  workerRunId?: unknown;
  worker_role?: unknown;
  workerRole?: unknown;
  profile_identity?: unknown;
  profileIdentity?: unknown;
  agent_instance_id?: unknown;
  agentInstanceId?: unknown;
  pool_member_id?: unknown;
  poolMemberId?: unknown;
  session_owner_id?: unknown;
  sessionOwnerId?: unknown;
  session_id?: unknown;
  sessionId?: unknown;
  summary?: unknown;
  deep_link?: unknown;
  deepLink?: unknown;
  thread_root_message_id?: unknown;
  threadRootMessageId?: unknown;
  reply_to_message_id?: unknown;
  replyToMessageId?: unknown;
  metadata?: unknown;
  metadata_json?: unknown;
  metadataJson?: unknown;
  delivery_request_id?: unknown;
  deliveryRequestId?: unknown;
  dedupe_key?: unknown;
  dedupeKey?: unknown;
  final_channel_message_id?: unknown;
  finalChannelMessageId?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  edited_at?: unknown;
  editedAt?: unknown;
  deleted_at?: unknown;
  deletedAt?: unknown;
}

let config: ConversationSuccessorReadConfig = {
  enabled: false,
  writeEnabled: false,
  apiBase: '/api/v1/conversation',
  projectIds: [],
  writeProjectIds: [],
};
const successorChannelIds = new Set<number>();
const successorChannelProjects = new Map<number, string | null>();
const successorMessageIds = new Set<number>();
const successorMessageProjects = new Map<number, string | null>();

export function reinitConversationSuccessorReads(next: Partial<ConversationSuccessorReadConfig>): void {
  config = {
    enabled: next.enabled ?? false,
    writeEnabled: next.writeEnabled ?? false,
    apiBase: normalizeApiBase(next.apiBase, '/api/v1/conversation'),
    projectIds: [...new Set((next.projectIds ?? []).map(id => id.trim()).filter(Boolean))],
    writeProjectIds: [...new Set((next.writeProjectIds ?? []).map(id => id.trim()).filter(Boolean))],
  };
  successorChannelIds.clear();
  successorChannelProjects.clear();
  successorMessageIds.clear();
  successorMessageProjects.clear();
}

export function conversationSuccessorReadsEnabledForProject(projectId: string | null | undefined): boolean {
  return Boolean(config.enabled && projectId && config.projectIds.includes(projectId));
}

export function conversationSuccessorReadsEnabledForChannel(channelId: number): boolean {
  return config.enabled && successorChannelIds.has(channelId);
}

export function conversationSuccessorWritesEnabledForChannel(channelId: number): boolean {
  if (!config.writeEnabled || !successorChannelIds.has(channelId)) return false;
  const projectId = successorChannelProjects.get(channelId);
  return Boolean(projectId && config.writeProjectIds.includes(projectId));
}

export function conversationSuccessorWritesEnabledForProject(projectId: string | null | undefined): boolean {
  return Boolean(config.writeEnabled && projectId && config.writeProjectIds.includes(projectId));
}

export function conversationSuccessorReactionsEnabledForMessage(messageId: number): boolean {
  if (!config.writeEnabled || !successorMessageIds.has(messageId)) return false;
  const projectId = successorMessageProjects.get(messageId);
  return Boolean(projectId && config.writeProjectIds.includes(projectId));
}

export function registerConversationSuccessorChannel(channelId: number, projectId: string | null | undefined): void {
  if (channelId > 0) {
    successorChannelIds.add(channelId);
    successorChannelProjects.set(channelId, projectId ?? null);
  }
}

export function registerConversationSuccessorMessageId(messageId: number, projectId?: string | null): void {
  if (messageId > 0) {
    successorMessageIds.add(messageId);
    if (projectId !== undefined || !successorMessageProjects.has(messageId)) {
      successorMessageProjects.set(messageId, projectId ?? null);
    }
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function conversationSuccessorUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${config.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function getSuccessor<T>(path: string): Promise<T> {
  const requestUrl = conversationSuccessorUrl(path);
  return dedupedFetch(`GET successor ${requestUrl}`, async () => {
    const res = await fetch(requestUrl, {
      cache: 'no-store',
      headers: { 'X-Den-Migrated-Functions': 'true' },
    });
    if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
    return res.json();
  });
}

async function postSuccessor<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const requestUrl = conversationSuccessorUrl(path);
  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Den-Migrated-Functions': 'true',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${requestUrl}: ${res.status}`);
  return res.json();
}

function objectRecord(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayFromResponse(value: unknown, key: string): JsonObject[] {
  if (Array.isArray(value)) return value.map(objectRecord);
  const record = objectRecord(value);
  const nested = record[key];
  return Array.isArray(nested) ? nested.map(objectRecord) : [];
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

export function normalizeConversationSuccessorChannel(raw: SuccessorChannelDto): Channel {
  const id = numberValue(raw.id);
  const displayName = stringValue(raw.display_name ?? raw.displayName, stringValue(raw.slug, `Channel ${id}`));
  return {
    id,
    slug: stringValue(raw.slug, String(id)),
    displayName,
    kind: stringValue(raw.kind, 'project_default'),
    projectId: nullableString(raw.project_id ?? raw.projectId),
    spaceId: nullableString(raw.space_id ?? raw.spaceId),
    createdBy: stringValue(raw.created_by ?? raw.createdBy, 'conversation-successor'),
    visibility: stringValue(raw.visibility, 'normal'),
    settingsJson: jsonStringValue(raw.settings ?? raw.settings_json ?? raw.settingsJson),
    createdAt: stringValue(raw.created_at ?? raw.createdAt),
    updatedAt: stringValue(raw.updated_at ?? raw.updatedAt),
    archivedAt: nullableString(raw.archived_at ?? raw.archivedAt),
  };
}

export function normalizeConversationSuccessorMessage(raw: SuccessorMessageDto): ChannelMessage {
  return {
    id: numberValue(raw.id),
    channelId: numberValue(raw.channel_id ?? raw.channelId),
    senderType: stringValue(raw.sender_type ?? raw.senderType),
    senderIdentity: stringValue(raw.sender_identity ?? raw.senderIdentity),
    body: stringValue(raw.body),
    messageKind: stringValue(raw.message_kind ?? raw.messageKind, 'message'),
    sourceKind: nullableString(raw.source_kind ?? raw.sourceKind),
    sourceId: nullableString(raw.source_id ?? raw.sourceId),
    sourceProjectId: nullableString(raw.source_project_id ?? raw.sourceProjectId),
    targetProjectId: nullableString(raw.target_project_id ?? raw.targetProjectId),
    targetTaskId: nullableNumber(raw.target_task_id ?? raw.targetTaskId),
    assignmentId: nullableString(raw.assignment_id ?? raw.assignmentId),
    workerRunId: nullableString(raw.worker_run_id ?? raw.workerRunId),
    workerRole: nullableString(raw.worker_role ?? raw.workerRole),
    profileIdentity: nullableString(raw.profile_identity ?? raw.profileIdentity),
    agentInstanceId: nullableString(raw.agent_instance_id ?? raw.agentInstanceId),
    poolMemberId: nullableString(raw.pool_member_id ?? raw.poolMemberId),
    sessionOwnerId: nullableString(raw.session_owner_id ?? raw.sessionOwnerId),
    sessionId: nullableString(raw.session_id ?? raw.sessionId),
    summary: nullableString(raw.summary),
    deepLink: nullableString(raw.deep_link ?? raw.deepLink),
    threadRootMessageId: nullableNumber(raw.thread_root_message_id ?? raw.threadRootMessageId),
    replyToMessageId: nullableNumber(raw.reply_to_message_id ?? raw.replyToMessageId),
    metadataJson: jsonStringValue(raw.metadata ?? raw.metadata_json ?? raw.metadataJson),
    deliveryRequestId: nullableString(raw.delivery_request_id ?? raw.deliveryRequestId),
    dedupeKey: nullableString(raw.dedupe_key ?? raw.dedupeKey),
    finalChannelMessageId: nullableNumber(raw.final_channel_message_id ?? raw.finalChannelMessageId),
    createdAt: stringValue(raw.created_at ?? raw.createdAt),
    editedAt: nullableString(raw.edited_at ?? raw.editedAt),
    deletedAt: nullableString(raw.deleted_at ?? raw.deletedAt),
  };
}

export async function listConversationSuccessorChannels(opts: ListChannelsOpts): Promise<Channel[]> {
  const q = buildQuery({ project_id: opts.projectId, kind: opts.kind, limit: opts.limit });
  const response = await getSuccessor<unknown>(`/channels${q}`);
  const channels = arrayFromResponse(response, 'channels').map(normalizeConversationSuccessorChannel);
  for (const channel of channels) {
    registerConversationSuccessorChannel(channel.id, channel.projectId);
  }
  return channels;
}

export async function listConversationSuccessorMessages(channelId: number, opts: ListChannelMessagesOpts): Promise<ChannelMessage[]> {
  const q = buildQuery({ after_id: opts.afterId, limit: opts.limit });
  const response = await getSuccessor<unknown>(`/channels/${encodeURIComponent(String(channelId))}/messages${q}`);
  const messages = arrayFromResponse(response, 'messages').map(normalizeConversationSuccessorMessage);
  const projectId = successorChannelProjects.get(channelId) ?? null;
  for (const message of messages) registerConversationSuccessorMessageId(message.id, projectId);
  return messages;
}

export function postConversationSuccessorMessage(channelId: number, request: PostChannelMessageRequest): Promise<ChannelMessage> {
  const idempotencyKey = request.dedupeKey || generateIdempotencyKey(channelId);
  return postSuccessor<unknown>(`/channels/${encodeURIComponent(String(channelId))}/messages`, {
    sender_type: request.senderType,
    sender_identity: request.senderIdentity,
    body: request.body,
    message_kind: request.messageKind,
    source_kind: request.sourceKind ?? 'den_web_channel_post',
    source_id: request.sourceId,
    source_project_id: request.sourceProjectId,
    target_project_id: request.targetProjectId,
    target_task_id: request.targetTaskId,
    assignment_id: request.assignmentId,
    worker_run_id: request.workerRunId,
    worker_role: request.workerRole,
    profile_identity: request.profileIdentity,
    agent_instance_id: request.agentInstanceId,
    pool_member_id: request.poolMemberId,
    session_owner_id: request.sessionOwnerId,
    session_id: request.sessionId,
    summary: request.summary,
    deep_link: request.deepLink,
    thread_root_message_id: request.threadRootMessageId,
    reply_to_message_id: request.replyToMessageId,
    metadata: parseMetadataJson(request.metadataJson),
    delivery_request_id: request.deliveryRequestId,
    dedupe_key: idempotencyKey,
  }, idempotencyKey).then(raw => {
    const record = objectRecord(raw);
    const message = normalizeConversationSuccessorMessage(objectRecord(record.message ?? record));
    registerConversationSuccessorMessageId(message.id, successorChannelProjects.get(channelId) ?? message.sourceProjectId);
    return message;
  });
}

export async function postConversationSuccessorProjectMessage(projectId: string, request: PostChannelMessageRequest): Promise<ChannelMessage> {
  const channels = await listConversationSuccessorChannels({ projectId, kind: 'project_default', limit: 5 });
  const channel = channels.find(item => item.projectId === projectId && item.kind === 'project_default') ?? channels[0];
  if (!channel) throw new Error(`No conversation successor project channel found for ${projectId}.`);
  return postConversationSuccessorMessage(channel.id, request);
}

export function addConversationSuccessorReaction(messageId: number, request: AddChannelReactionRequest): Promise<unknown> {
  return postSuccessor(`/messages/${encodeURIComponent(String(messageId))}/reactions`, {
    reactor_type: request.reactorType,
    reactor_identity: request.reactorIdentity,
    reaction: request.reactionKey,
  });
}

function parseMetadataJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function generateIdempotencyKey(channelId: number): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return `den-web:${channelId}:${random}`;
  return `den-web:${channelId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
