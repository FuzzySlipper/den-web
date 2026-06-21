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
  degradedAgentDetail,
  degradedAssignmentTrace,
  observationAgentDetail,
  observationOverviewFromLane,
} from './observationAdapters';
import { normalizeApiBase } from '../config';
import { dedupedFetch } from '../requestCache';
export { postGatewayDirectAgentMessage } from './directAgentWake';

const denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');

function channelsApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denChannelsApiBase}${url.startsWith('/') ? url : `/${url}`}`;
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

function getChannels<T>(url: string): Promise<T> {
  const requestUrl = channelsApiUrl(url);
  // Share overlapping identical GETs across panels (#2145).
  return dedupedFetch(`GET ${requestUrl}`, async () => {
    const res = await fetch(requestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
    return res.json();
  });
}

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
  cooldownSeconds?: number;
  maxAutoRepliesPerWindow?: number;
  settingsJson?: string | null;
}

export function upsertChannelMembership(channelId: number, request: UpsertChannelMembershipRequest): Promise<GatewayMemberships['members'][number]> {
  return putChannels(`/channels/${channelId}/memberships`, request);
}

export function listGatewayMemberships(opts: { channelId?: number; projectId?: string; includeLeft?: boolean; leftGraceMinutes?: number }): Promise<GatewayMemberships> {
  const q = buildQuery({
    channelId: opts.channelId,
    projectId: opts.projectId,
    includeLeft: opts.includeLeft,
    leftGraceMinutes: opts.leftGraceMinutes,
  });
  return getChannels(`/gateway/memberships${q}`);
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
  return getChannels(`/v1/observation/lane${q}`);
}

export function getObservationAgentOverview(agentIdentity: string): Promise<ObservationAgentOverviewResponse> {
  return getChannels(`/v1/observation/agents/${encodeURIComponent(agentIdentity)}/overview`);
}

export function listObservationActiveWork(): Promise<ObservationActiveWorkResponse> {
  return getChannels('/v1/observation/active-work');
}

// Worker-pool assignment trace (#1729 / #3076)
// The den-channels trace aggregate is retired. Until den-services exposes
// successor parity, return an explicit degraded trace projection for the UI.

export function getAssignmentTrace(assignmentId: string, opts: { projectId?: string; channelId?: string } = {}): Promise<AssignmentTraceResponse> {
  return Promise.resolve(degradedAssignmentTrace(assignmentId, opts));
}

// Worker-pool lobby presence (#1781)
// GET /api/worker-pool/lobby/presence — proxied through static server to Channels

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
  return getChannels<RawWorkerPoolLobbyResponse>('/worker-pool/lobby/presence').then(mapWorkerPoolLobbyPresence);
}
