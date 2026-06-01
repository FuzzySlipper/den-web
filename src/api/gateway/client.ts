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
  FleetOpsResponse,
  FleetOpsActionRunRequest,
  FleetOpsActionRunResponse,
  FleetOpsRunDetailResponse,
} from './types';
import { normalizeApiBase } from '../config';

const denChannelsApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE, '/api');
let denGatewayApiBase = normalizeApiBase(import.meta.env.VITE_DEN_GATEWAY_API_BASE, '/den-gateway-api');

/** Reinitialize Gateway-specific base URL from runtime config. */
export function reinitGatewayBase(base: string): void {
  denGatewayApiBase = normalizeApiBase(base, '/den-gateway-api');
}

function channelsApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denChannelsApiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

function gatewayApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${denGatewayApiBase}${url.startsWith('/') ? url : `/${url}`}`;
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

async function getGateway<T>(url: string): Promise<T> {
  const requestUrl = gatewayApiUrl(url);
  const res = await fetch(requestUrl);
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
}

async function postGateway<T>(url: string, body: unknown): Promise<T> {
  const requestUrl = gatewayApiUrl(url);
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

export function listGatewayMemberships(opts: { channelId?: number; projectId?: string }): Promise<GatewayMemberships> {
  const q = buildQuery({ channelId: opts.channelId, projectId: opts.projectId });
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

export function getWorkerPoolLobbyPresence(): Promise<WorkerPoolLobbyPresence> {
  return getChannels('/worker-pool/lobby/presence');
}

// =============================================================================
// Fleet Ops cockpit (task #1797)
// Gateway FleetOps API — fleet status, actions, runs.
// =============================================================================

export function getFleetOps(): Promise<FleetOpsResponse> {
  return getGateway('/fleet-ops');
}

export function postFleetOpsActionRun(request: FleetOpsActionRunRequest): Promise<FleetOpsActionRunResponse> {
  return postGateway(`/fleet-ops/actions/${encodeURIComponent(request.actionId)}/runs`, request);
}

export function getFleetOpsRun(runId: string): Promise<FleetOpsRunDetailResponse> {
  return getGateway(`/fleet-ops/runs/${encodeURIComponent(runId)}`);
}
