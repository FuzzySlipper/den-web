import type {
  GatewayMemberships,
  GatewayTestWake,
  GatewayDirectAgentMessage,
  PostGatewayTestWakeRequest,
  PostGatewayDirectAgentMessageRequest,
  AgentsOverviewResponse,
  AgentDetailResponse,
  AssignmentTraceResponse,
  WorkerPoolLobbyPresence,
  WorkerPoolMemberPresence,
  RawWorkerPoolLobbyResponse,
  RawWorkerPoolMember,
  FleetOpsResponse,
  FleetOpsActionRunRequest,
  FleetOpsActionRunResponse,
  FleetOpsRunDetailResponse,
} from './types';
import { normalizeApiBase } from '../config';

const denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');
let denHostApiBase = normalizeApiBase(import.meta.env.VITE_DEN_HOST_API_BASE, '/den-host-api');

/** Reinitialize Den Host-specific base URL from runtime config. */
export function reinitHostBase(base: string): void {
  denHostApiBase = normalizeApiBase(base, '/den-host-api');
}

function channelsApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denChannelsApiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

function hostApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denHostApiBase}${url.startsWith('/') ? url : `/${url}`}`;
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

async function getChannels<T>(url: string): Promise<T> {
  const requestUrl = channelsApiUrl(url);
  const res = await fetch(requestUrl);
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
}

async function getHost<T>(url: string): Promise<T> {
  const requestUrl = hostApiUrl(url);
  const res = await fetch(requestUrl);
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
}

async function postHost<T>(url: string, body: unknown): Promise<T> {
  const requestUrl = hostApiUrl(url);
  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${requestUrl}: ${res.status}`);
  return res.json();
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

export function postGatewayTestWake(request: PostGatewayTestWakeRequest): Promise<GatewayTestWake> {
  return postChannels('/gateway/test-wakes', request);
}

export function postGatewayDirectAgentMessage(request: PostGatewayDirectAgentMessageRequest): Promise<GatewayDirectAgentMessage> {
  return postChannels('/gateway/direct-agent-messages', request);
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
  const q = buildQuery({
    projectId: opts.projectId,
    channelId: opts.channelId,
    scope: opts.scope,
    agentIdentity: opts.agentIdentity,
    activityLimit: opts.activityLimit,
    includeLeft: opts.includeLeft,
    includeGateway: opts.includeGateway,
  });
  return getChannels(`/agents/overview${q}`);
}

export function getAgentDetail(agentIdentity: string, opts: { projectId?: string; channelId?: string; activityLimit?: number; deliveryLimit?: number } = {}): Promise<AgentDetailResponse> {
  const q = buildQuery({
    projectId: opts.projectId,
    channelId: opts.channelId,
    activityLimit: opts.activityLimit,
    deliveryLimit: opts.deliveryLimit,
  });
  return getChannels(`/agents/${encodeURIComponent(agentIdentity)}/overview${q}`);
}

// Worker-pool assignment trace (#1729)
// Fetches a read-only assignment trace projection. If the backend endpoint does not
// exist yet, consumers should handle the rejection gracefully (e.g. by showing
// "core_unavailable" / "gateway_unavailable" states).

export function getAssignmentTrace(assignmentId: string, opts: { projectId?: string; channelId?: string } = {}): Promise<AssignmentTraceResponse> {
  const q = buildQuery({
    projectId: opts.projectId,
    channelId: opts.channelId,
  });
  return getChannels(`/assignments/${encodeURIComponent(assignmentId)}/trace${q}`);
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

// =============================================================================
// Fleet Ops cockpit
// Den Host FleetOps API — bounded Hermes fleet status, actions, runs.
// =============================================================================

export function getFleetOps(): Promise<FleetOpsResponse> {
  return getHost('/fleet-ops');
}

export function postFleetOpsActionRun(request: FleetOpsActionRunRequest): Promise<FleetOpsActionRunResponse> {
  return postHost(`/fleet-ops/actions/${encodeURIComponent(request.actionId)}/runs`, request);
}

export function getFleetOpsRun(runId: string): Promise<FleetOpsRunDetailResponse> {
  return getHost(`/fleet-ops/runs/${encodeURIComponent(runId)}`);
}
