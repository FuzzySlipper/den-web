import type { Channel, ChannelMessage, ChannelReactionSummary, ChannelActivityEvent, ChannelProjectLink } from './types';
import { normalizeApiBase } from '../config';

let denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');

/** Reinitialize base URL from runtime config */
export function reinitChannelsBase(base: string): void {
  denChannelsApiBase = normalizeApiBase(base, '/api');
}

function channelsApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denChannelsApiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

async function getChannels<T>(url: string): Promise<T> {
  const requestUrl = channelsApiUrl(url);
  const res = await fetch(requestUrl);
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
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

export interface PostChannelMessageRequest {
  senderType: string;
  senderIdentity: string;
  body: string;
  messageKind?: string;
  sourceKind?: string | null;
  sourceId?: string | null;
  sourceProjectId?: string | null;
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
