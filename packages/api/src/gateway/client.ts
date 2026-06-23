import type {
  GatewayMemberships,
  AgentsOverviewResponse,
  AgentDetailResponse,
  AssignmentTraceResponse,
  WorkerPoolLobbyPresence,
  WorkerPoolMemberPresence,
  RawWorkerPoolLobbyResponse,
  RawWorkerPoolMember,
} from './types';
import type {
  ObservationLaneResponse,
  ObservationAgentOverviewResponse,
  ObservationActiveWorkResponse,
} from './observationTypes';
import {
  getConversationSuccessorChannel,
  listConversationSuccessorChannels,
  listConversationSuccessorMemberships,
  putConversationSuccessorMembership,
  type ConversationSuccessorMembership,
  type ListConversationSuccessorMembershipsOpts,
} from '../channels/conversationSuccessor';
import {
  degradedAgentDetail,
  degradedAssignmentTrace,
  observationAgentDetail,
  observationOverviewFromLane,
} from './observationAdapters';
import { dedupedFetch } from '../requestCache';
export { postGatewayDirectAgentMessage } from './directAgentWake';

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// Memberships

export interface UpsertChannelMembershipRequest {
  memberType: string;
  memberIdentity: string;
  membershipStatus?: string;
  wakePolicy?: string;
  canSend?: boolean;
  canReact?: boolean;
  canInvite?: boolean;
  membershipPurpose?: string | null;
  cooldownSeconds?: number;
  maxAutoRepliesPerWindow?: number;
  settingsJson?: string | null;
}

export function upsertChannelMembership(channelId: number, request: UpsertChannelMembershipRequest): Promise<GatewayMemberships['members'][number]> {
  return putConversationSuccessorMembership(channelId, {
    memberType: request.memberType,
    memberIdentity: request.memberIdentity,
    membershipStatus: request.membershipStatus,
    wakePolicy: request.wakePolicy,
    canSend: request.canSend,
    canReact: request.canReact,
    canInvite: request.canInvite,
    membershipPurpose: request.membershipPurpose,
    settingsJson: request.settingsJson,
  }).then(mapConversationMembership);
}

export function listGatewayMemberships(opts: { channelId?: number; projectId?: string; includeLeft?: boolean; leftGraceMinutes?: number }): Promise<GatewayMemberships> {
  void opts.leftGraceMinutes;
  return listConversationMembershipProjection({
    channelId: opts.channelId,
    projectId: opts.projectId,
    includeLeft: opts.includeLeft,
    limit: 200,
  });
}

async function listConversationMembershipProjection(opts: ListConversationSuccessorMembershipsOpts): Promise<GatewayMemberships> {
  const [memberships, channel] = await Promise.all([
    listConversationSuccessorMemberships(opts),
    resolveMembershipChannel(opts),
  ]);
  return {
    channelId: channel?.id ?? opts.channelId ?? memberships[0]?.channelId ?? 0,
    channelSlug: channel?.slug ?? '',
    channelKind: channel?.kind ?? '',
    projectId: channel?.projectId ?? opts.projectId ?? null,
    members: memberships.map(mapConversationMembership),
  };
}

async function resolveMembershipChannel(opts: ListConversationSuccessorMembershipsOpts) {
  if (opts.channelId) return getConversationSuccessorChannel(opts.channelId).catch(() => null);
  if (!opts.projectId) return null;
  const channels = await listConversationSuccessorChannels({ projectId: opts.projectId, kind: 'project_default', limit: 5 }).catch(() => []);
  return channels.find(channel => channel.projectId === opts.projectId && channel.kind === 'project_default') ?? channels[0] ?? null;
}

function mapConversationMembership(member: ConversationSuccessorMembership): GatewayMemberships['members'][number] {
  const settings = parseSettings(member.settingsJson);
  return {
    id: member.id,
    memberType: member.memberType,
    memberIdentity: member.memberIdentity,
    membershipStatus: member.membershipStatus,
    wakePolicy: member.wakePolicy,
    canSend: member.canSend,
    canReact: member.canReact,
    canInvite: member.canInvite,
    cooldownSeconds: numberSetting(settings.cooldownSeconds),
    maxAutoRepliesPerWindow: numberSetting(settings.maxAutoRepliesPerWindow),
    settingsLabel: stringSetting(settings.label),
    membershipPurpose: member.membershipPurpose,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    leftAt: member.leftAt,
  };
}

function parseSettings(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function numberSetting(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringSetting(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// Agents Overview API (#1694 / #1695)

export interface ListAgentsOverviewOpts {
  projectId?: string;
  channelId?: string;
  scope?: string;
  agentIdentity?: string;
  activityLimit?: number;
  includeLeft?: boolean;
  includeGateway?: boolean;
}

export function listAgentsOverview(opts: ListAgentsOverviewOpts = {}): Promise<AgentsOverviewResponse> {
  return Promise.all([
    listObservationLane({ limit: opts.activityLimit ?? 50 }),
    listObservationActiveWork(),
  ]).then(([lane, activeWork]) => observationOverviewFromLane(lane, activeWork, {
    projectId: opts.projectId,
    agentIdentity: opts.agentIdentity,
    activityLimit: opts.activityLimit,
  }));
}

export function getAgentDetail(agentIdentity: string, opts: { projectId?: string; channelId?: string; activityLimit?: number; deliveryLimit?: number } = {}): Promise<AgentDetailResponse> {
  void opts.channelId;
  void opts.projectId;
  void opts.deliveryLimit;
  return getObservationAgentOverview(agentIdentity)
    .then(overview => observationAgentDetail(agentIdentity, overview, opts.activityLimit ?? 50))
    .catch(error => degradedAgentDetail(
      agentIdentity,
      error instanceof Error ? error.message : 'Observation agent overview unavailable.',
    ));
}

// Observation agent-activity reads (#2813)
// The browser calls the same-origin static proxy at /api/v1/observation/*.
// den-web-static-server injects the Gateway observation read token server-side.

export function listObservationLane(opts: { limit?: number } = {}): Promise<ObservationLaneResponse> {
  const q = buildQuery({ limit: opts.limit });
  return getSameOrigin(`/api/v1/observation/lane${q}`);
}

export function getObservationAgentOverview(agentIdentity: string): Promise<ObservationAgentOverviewResponse> {
  return getSameOrigin(`/api/v1/observation/agents/${encodeURIComponent(agentIdentity)}/overview`);
}

export function listObservationActiveWork(): Promise<ObservationActiveWorkResponse> {
  return getSameOrigin('/api/v1/observation/active-work');
}

function getSameOrigin<T>(url: string): Promise<T> {
  return dedupedFetch(`GET ${url}`, async () => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
    return res.json();
  });
}

// Worker-pool assignment trace (#1729 / #3076)
// The den-channels trace aggregate is retired. Until den-services exposes
// successor parity, return an explicit degraded trace projection for the UI.

export function getAssignmentTrace(assignmentId: string, opts: { projectId?: string; channelId?: string } = {}): Promise<AssignmentTraceResponse> {
  return Promise.resolve(degradedAssignmentTrace(assignmentId, opts));
}

// Worker-pool lobby presence (#1781)
// The den-channels lobby endpoint is retired. Return a stable empty projection
// until den-services exposes successor lobby parity.

function mapWorkerPoolAvailabilityState(status: string | null | undefined): WorkerPoolMemberPresence['availabilityState'] {
  switch (status) {
    case 'idle':
    case 'available':
    case 'leased':
    case 'busy':
    case 'draining':
    case 'cleanup':
    case 'quarantined':
    case 'offline':
      return status;
    default:
      return 'unknown';
  }
}

function mapRawWorkerPoolMember(raw: RawWorkerPoolMember): WorkerPoolMemberPresence {
  const assignmentId = raw.currentAssignmentId == null ? null : String(raw.currentAssignmentId);
  const availabilityState = mapWorkerPoolAvailabilityState(raw.availabilityState ?? raw.status);
  const isBusy = availabilityState === 'leased' || availabilityState === 'busy';
  const isQuarantined = raw.isQuarantined ?? availabilityState === 'quarantined';

  return {
    identity: raw.identity ?? raw.memberIdentity ?? raw.poolMemberId ?? 'unknown-worker',
    role: raw.role ?? raw.profile ?? 'unknown',
    availabilityState,
    statusDetail: assignmentId ? `Assignment ${assignmentId}` : null,
    activeAssignmentCount: isBusy ? 1 : 0,
    completedAssignmentCount: 0,
    activeAssignmentIds: assignmentId ? [assignmentId] : [],
    lastSeenAt: raw.lastSeenAt ?? raw.lastActivityAt ?? raw.updatedAt ?? null,
    isLegacyPilot: raw.isLegacyPilot ?? false,
    isQuarantined,
  };
}

function mapWorkerPoolLobbyPresence(raw: RawWorkerPoolLobbyResponse): WorkerPoolLobbyPresence {
  const members = (raw.members ?? []).map(mapRawWorkerPoolMember);
  const roleCounts: Record<string, number> = { ...(raw.roleCounts ?? {}) };

  if (Object.keys(roleCounts).length === 0) {
    for (const group of raw.byRole ?? []) {
      if (!group.role) continue;
      roleCounts[group.role] = group.count ?? group.members?.length ?? 0;
    }
  }

  return {
    channelId: raw.channelId ?? raw.lobbyChannelId ?? 0,
    availableCount: raw.availableCount ?? members.filter(m => m.availabilityState === 'available' || m.availabilityState === 'idle').length,
    totalCandidateCount: raw.totalCandidateCount ?? raw.totalMembers ?? members.filter(m => !m.isLegacyPilot).length,
    roleCounts,
    members,
    observedAt: raw.observedAt ?? new Date().toISOString(),
  };
}

export function getWorkerPoolLobbyPresence(): Promise<WorkerPoolLobbyPresence> {
  return Promise.resolve(mapWorkerPoolLobbyPresence({ members: [], roleCounts: {}, observedAt: new Date().toISOString() }));
}
