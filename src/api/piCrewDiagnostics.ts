import type { AgentWorkLifecycleEvent } from './types';

export interface PiCrewDiagnosticsConfig {
  baseUrl: string;
  bearerToken: string;
  authMode: 'bearer' | 'none';
}

export interface PiCrewStatusReader {
  status: string;
  lastOkAt: string | null;
}

export interface PiCrewClassification {
  kind: string;
  summary: string;
}

export interface PiCrewWorkerBinding {
  assignmentId: string;
  runId: string;
  taskId: number;
  projectId: string;
  role: string;
}

export interface PiCrewSessionProjection {
  sessionId: string;
  profileId: string;
  instanceId: string | null;
  kind: string;
  sessionState: string;
  workerBinding: PiCrewWorkerBinding | null;
  denAssignment: unknown | null;
  localLifecycleState: string;
  lastActivityAt: string | null;
  lastGatewayEvent: string | null;
  drainState: string;
  classification: string;
  evidenceRefs: string[];
  recentErrorCount?: number;
  presenceStatus?: string;
}

export interface PiCrewDiagnosticsOverview {
  service: {
    status: string;
    version: string;
    uptimeSeconds: number;
    startedAt: string;
    drainMode: string;
  };
  classification: PiCrewClassification;
  denCore: PiCrewStatusReader;
  denChannels: PiCrewStatusReader;
  mcp: PiCrewStatusReader;
  runtimeDb: Record<string, unknown> & { status: string };
  counts: {
    activeSessions: number;
    workerSessions: number;
    conversationalSessions: number;
    activeAssignmentsLocal: number;
    stuckWorkers: number;
    checkpointWaiting: number;
    degradedConversationalSessions?: number;
  };
  sessions: PiCrewSessionProjection[];
  recentEvents: Array<Record<string, unknown>>;
}

export interface PiCrewControlRequest {
  operator: string;
  reason: string;
  idempotencyKey: string;
  dryRun: boolean;
  candidateConfig?: unknown;
}

export interface PiCrewControlResponse {
  controlId: string;
  dryRun: boolean;
  accepted: boolean;
  action: string;
  operator: string;
  reason: string;
  idempotencyKey: string;
  before: unknown;
  after: unknown;
  denEvidence?: unknown;
  localAuditId: number | string | null;
  warnings: string[];
  error?: string;
}

export interface PiCrewAgentWorkEventsResponse {
  events?: AgentWorkLifecycleEvent[];
  items?: AgentWorkLifecycleEvent[];
  count?: number;
}

function normalizedBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function piCrewFetch<T>(config: PiCrewDiagnosticsConfig, path: string, init?: RequestInit): Promise<T> {
  const base = normalizedBase(config.baseUrl);
  if (!base) throw new Error('Pi Crew admin base URL is required.');
  const bearerToken = config.bearerToken.trim();
  if (config.authMode !== 'none' && !bearerToken) throw new Error('Pi Crew admin bearer token is required.');
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(config.authMode === 'none' ? {} : { Authorization: `Bearer ${bearerToken}` }),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const text = await response.text();
  const body = parseJsonResponse(text);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String((body as Record<string, unknown>).error) : response.statusText;
    throw new Error(`Pi Crew admin ${response.status}: ${message}`);
  }
  return body as T;
}

function parseJsonResponse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

export function getPiCrewDiagnosticsOverview(config: PiCrewDiagnosticsConfig): Promise<PiCrewDiagnosticsOverview> {
  return piCrewFetch(config, '/admin/diagnostics/overview');
}

export function postPiCrewControl(config: PiCrewDiagnosticsConfig, path: string, request: PiCrewControlRequest): Promise<PiCrewControlResponse> {
  return piCrewFetch(config, path, { method: 'POST', body: JSON.stringify(request) });
}

export async function getPiCrewAgentWorkEvents(config: Pick<PiCrewDiagnosticsConfig, 'baseUrl'>, opts: { channelId?: number; projectId?: string | null; limit?: number } = {}): Promise<AgentWorkLifecycleEvent[]> {
  const params = new URLSearchParams();
  if (opts.channelId !== undefined) params.set('channelId', String(opts.channelId));
  if (opts.projectId) params.set('projectId', opts.projectId);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  const response = await piCrewFetch<PiCrewAgentWorkEventsResponse>(
    { baseUrl: config.baseUrl, bearerToken: '', authMode: 'none' },
    `/admin/agent-work/events${params.size ? `?${params.toString()}` : ''}`,
  );
  return response.events ?? response.items ?? [];
}
