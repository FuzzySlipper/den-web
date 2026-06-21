import type { DeliveryIntentResponse, GatewayDirectAgentMessage, PostGatewayDirectAgentMessageRequest } from './types';

const deliveryApiBase = '/api/v1/delivery';
const conversationApiBase = '/api/v1/conversation';

async function postJson<T>(base: string, url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const requestUrl = `${base}${url.startsWith('/') ? url : `/${url}`}`;
  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    const suffix = detail ? ` — ${detail}` : '';
    throw new Error(`POST ${requestUrl}: ${res.status}${suffix}`);
  }
  return res.json();
}

function getJson<T>(base: string, url: string): Promise<T> {
  const requestUrl = `${base}${url.startsWith('/') ? url : `/${url}`}`;
  return fetch(requestUrl, { cache: 'no-store', headers: { 'X-Den-Migrated-Functions': 'true' } }).then(async res => {
    if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
    return res.json();
  });
}

interface ConversationMessageResponse {
  id: number;
  channel_id: number;
  dedupe_key?: string | null;
}

interface ConversationChannelResponse {
  id: number;
  project_id?: string | null;
  kind?: string | null;
}

type ConversationChannelListResponse = ConversationChannelResponse[] | {
  channels?: ConversationChannelResponse[] | null;
  items?: ConversationChannelResponse[] | null;
  results?: ConversationChannelResponse[] | null;
};

interface ObservationAgentOverviewResponse {
  runtime_instances?: Array<{ instance_id?: string | null; runtime_instance_id?: string | null }> | null;
  activity_events?: Array<{
    runtime_instance_id?: string | null;
    agent_identity?: { instance_id?: string | null; runtime_instance_id?: string | null; session_key?: string | null } | null;
    session_key?: string | null;
  }> | null;
}

interface DeliveryTargetIdentity {
  profile: string;
  instanceId: string;
  sessionKey?: string;
}

function cleanIdempotencyPart(value: string | number | null | undefined, fallback: string): string {
  const normalized = String(value ?? fallback).trim().replace(/:/g, '-');
  return normalized || fallback;
}

function randomNonce(): string {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, '') ?? `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function directAgentIdempotencyKey(request: PostGatewayDirectAgentMessageRequest, operation = 'direct-agent-message'): string {
  return [
    cleanIdempotencyPart(operation, 'direct-agent-message'),
    cleanIdempotencyPart(request.channelId ?? request.projectId ?? 'direct', 'direct'),
    cleanIdempotencyPart(request.profileIdentity ?? request.memberIdentity, 'agent'),
    cleanIdempotencyPart(randomNonce(), 'nonce'),
  ].join(':');
}

function directAgentMetadata(request: PostGatewayDirectAgentMessageRequest, deliveryDedupeKey: string): Record<string, unknown> {
  return {
    source: 'den-web',
    deliveryIntentIdempotencyKey: deliveryDedupeKey,
    targetMemberIdentity: request.memberIdentity,
    sourceProjectId: request.sourceProjectId ?? request.projectId ?? null,
    targetProjectId: request.targetProjectId ?? request.projectId ?? null,
    targetTaskId: request.targetTaskId ?? null,
    assignmentId: request.assignmentId ?? null,
    workerRunId: request.workerRunId ?? null,
    workerRole: request.workerRole ?? null,
    profileIdentity: request.profileIdentity ?? request.memberIdentity,
    poolMemberId: request.poolMemberId ?? null,
    agentInstanceId: request.agentInstanceId ?? null,
    sessionOwnerId: request.sessionOwnerId ?? null,
    sessionId: request.sessionId ?? null,
  };
}

async function appendDirectAgentConversationMessage(
  request: PostGatewayDirectAgentMessageRequest,
  deliveryDedupeKey: string,
): Promise<ConversationMessageResponse | null> {
  const channelId = await resolveConversationChannelId(request);
  if (!channelId) return null;
  const messageDedupeKey = `conversation-${deliveryDedupeKey}`;
  return postJson<ConversationMessageResponse>(
    conversationApiBase,
    `/channels/${encodeURIComponent(String(channelId))}/messages`,
    {
      sender_type: 'user',
      sender_identity: request.senderIdentity,
      body: request.body,
      message_kind: 'direct_agent_wake',
      source_kind: 'den_web_direct_agent',
      source_project_id: request.sourceProjectId ?? request.projectId ?? null,
      target_project_id: request.targetProjectId ?? request.projectId ?? null,
      target_task_id: request.targetTaskId ?? null,
      assignment_id: request.assignmentId ?? null,
      worker_run_id: request.workerRunId ?? null,
      worker_role: request.workerRole ?? null,
      profile_identity: request.profileIdentity ?? request.memberIdentity,
      agent_instance_id: request.agentInstanceId ?? null,
      pool_member_id: request.poolMemberId ?? null,
      session_owner_id: request.sessionOwnerId ?? null,
      session_id: request.sessionId ?? null,
      metadata: directAgentMetadata(request, deliveryDedupeKey),
      dedupe_key: messageDedupeKey,
    },
    {
      'X-Den-Migrated-Functions': 'true',
      'Idempotency-Key': messageDedupeKey,
    },
  );
}

async function resolveConversationChannelId(request: PostGatewayDirectAgentMessageRequest): Promise<number | null> {
  if (!request.projectId) return request.channelId ?? null;
  const q = `?project_id=${encodeURIComponent(request.projectId)}&kind=project_default&limit=5`;
  const response = await getJson<ConversationChannelListResponse>(conversationApiBase, `/channels${q}`);
  const channels = Array.isArray(response)
    ? response
    : response.channels ?? response.items ?? response.results ?? [];
  return channels.find(channel => channel.project_id === request.projectId && channel.kind === 'project_default')?.id
    ?? channels[0]?.id
    ?? request.channelId
    ?? null;
}

function deliverySourceRef(request: PostGatewayDirectAgentMessageRequest, message: ConversationMessageResponse | null): string {
  if (message) return `/api/v1/conversation/channels/${message.channel_id}/messages/${message.id}`;
  return JSON.stringify({
    source: 'den-web',
    channelId: request.channelId ?? null,
    projectId: request.projectId ?? request.sourceProjectId ?? null,
    senderIdentity: request.senderIdentity,
  });
}

async function createDeliveryIntent(
  request: PostGatewayDirectAgentMessageRequest,
  idempotencyKey: string,
  message: ConversationMessageResponse | null,
): Promise<DeliveryIntentResponse> {
  const target = await resolveDeliveryTargetIdentity(request);
  return postJson<DeliveryIntentResponse>(
    deliveryApiBase,
    '/intents',
    {
      target_identity: {
        profile: target.profile,
        instance_id: target.instanceId,
        ...(target.sessionKey ? { session_key: target.sessionKey } : {}),
      },
      idempotency_key: idempotencyKey,
      source_ref: deliverySourceRef(request, message),
      channel_message_id: message?.id ?? undefined,
    },
    { 'X-Den-Migrated-Functions': 'true' },
  );
}

async function resolveDeliveryTargetIdentity(request: PostGatewayDirectAgentMessageRequest): Promise<DeliveryTargetIdentity> {
  const profile = request.profileIdentity ?? request.memberIdentity;
  const explicitInstanceId = cleanTargetIdentityPart(request.agentInstanceId);
  if (explicitInstanceId) {
    return { profile, instanceId: explicitInstanceId, sessionKey: cleanTargetIdentityPart(request.sessionId) ?? undefined };
  }
  const observed = await resolveObservedAgentIdentity(request.memberIdentity);
  if (observed) {
    return { profile, instanceId: observed.instanceId, sessionKey: cleanTargetIdentityPart(request.sessionId) ?? observed.sessionKey };
  }
  throw new Error(`No concrete delivery target instance found for ${request.memberIdentity}; Delivery successor requires target_identity.instance_id.`);
}

function cleanTargetIdentityPart(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function resolveObservedAgentIdentity(memberIdentity: string): Promise<{ instanceId: string; sessionKey?: string } | null> {
  try {
    const overview = await getJson<ObservationAgentOverviewResponse>('/api/v1/observation', `/agents/${encodeURIComponent(memberIdentity)}/overview`);
    const runtime = overview.runtime_instances?.find(item => cleanTargetIdentityPart(item.instance_id) || cleanTargetIdentityPart(item.runtime_instance_id));
    const runtimeInstanceId = cleanTargetIdentityPart(runtime?.instance_id) ?? cleanTargetIdentityPart(runtime?.runtime_instance_id);
    if (runtimeInstanceId) return { instanceId: runtimeInstanceId };
    const event = overview.activity_events?.find(item => (
      cleanTargetIdentityPart(item.agent_identity?.instance_id)
      || cleanTargetIdentityPart(item.agent_identity?.runtime_instance_id)
      || cleanTargetIdentityPart(item.runtime_instance_id)
      || cleanTargetIdentityPart(item.session_key)
      || cleanTargetIdentityPart(item.agent_identity?.session_key)
    ));
    const eventInstanceId = cleanTargetIdentityPart(event?.agent_identity?.instance_id)
      ?? cleanTargetIdentityPart(event?.agent_identity?.runtime_instance_id)
      ?? cleanTargetIdentityPart(event?.runtime_instance_id)
      ?? cleanTargetIdentityPart(event?.session_key)
      ?? cleanTargetIdentityPart(event?.agent_identity?.session_key);
    if (!eventInstanceId) return null;
    return {
      instanceId: eventInstanceId,
      sessionKey: cleanTargetIdentityPart(event?.session_key) ?? cleanTargetIdentityPart(event?.agent_identity?.session_key) ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function postGatewayDirectAgentMessage(request: PostGatewayDirectAgentMessageRequest): Promise<GatewayDirectAgentMessage> {
  const idempotencyKey = directAgentIdempotencyKey(request);
  const message = await appendDirectAgentConversationMessage(request, idempotencyKey);
  const intent = await createDeliveryIntent(request, idempotencyKey, message);
  return {
    status: intent.state,
    deliveryStatus: intent.state,
    claimStatus: intent.claimed_at ? 'claimed' : 'unclaimed',
    completionStatus: intent.completed_at ? 'completed' : 'pending',
    suppressionStatus: 'not_applicable',
    memberIdentity: request.memberIdentity,
    wakePolicy: '',
    messageId: message?.id ?? intent.id,
    channelId: message?.channel_id ?? request.channelId ?? 0,
    requestId: intent.idempotency_key,
    gatewayMessageUrl: message ? `/api/v1/conversation/channels/${message.channel_id}/messages?after_id=${Math.max(0, message.id - 1)}&limit=10` : `/api/v1/delivery/intents/${intent.id}`,
    gatewayEventsUrl: `/api/v1/delivery/intents/${intent.id}`,
    evidenceSummary: `Delivery successor intent ${intent.id} created for ${request.memberIdentity}.`,
  };
}
