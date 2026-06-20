import { normalizeApiBase } from '../config';
import { dedupedFetch } from '../requestCache';
import { postGatewayDirectAgentMessage } from '../gateway/directAgentWake';
import type { DirectConversation, DirectConversationSendRequest, DirectConversationSendResponse } from './types';

let denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');

export function reinitDirectMessagesRuntime(base: string): void {
  denChannelsApiBase = normalizeApiBase(base, '/api');
}

function channelsApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denChannelsApiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

function getChannels<T>(url: string): Promise<T> {
  const requestUrl = channelsApiUrl(url);
  return dedupedFetch(`GET ${requestUrl}`, async () => {
    const res = await fetch(requestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
    return res.json();
  });
}

function getDirectConversation(conversationId: number): Promise<DirectConversation> {
  return getChannels(`/direct-conversations/${conversationId}`);
}

export async function sendDirectMessage(conversationId: number, request: DirectConversationSendRequest): Promise<DirectConversationSendResponse> {
  const conversation = await getDirectConversation(conversationId);
  const delivery = await postGatewayDirectAgentMessage({
    projectId: request.sourceProjectId ?? conversation.scopeProjectId ?? undefined,
    memberIdentity: conversation.agentIdentity,
    senderIdentity: request.senderIdentity,
    body: request.body,
    sourceProjectId: request.sourceProjectId ?? conversation.scopeProjectId ?? null,
    targetTaskId: request.targetTaskId ?? null,
    workerRunId: request.workerRunId ?? null,
    workerRole: request.workerRole ?? null,
    profileIdentity: request.profileIdentity ?? conversation.agentIdentity,
    poolMemberId: request.poolMemberId ?? null,
    agentInstanceId: request.agentInstanceId ?? null,
    sessionOwnerId: request.sessionOwnerId ?? null,
    sessionId: request.sessionId ?? null,
  });
  return {
    status: delivery.status,
    eventId: delivery.messageId,
    channelId: delivery.channelId,
    conversationId,
    entryId: 0,
    requestId: delivery.requestId,
    memberIdentity: delivery.memberIdentity,
  };
}
