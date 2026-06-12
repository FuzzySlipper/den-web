import type { PiCrewControlRequest, PiCrewDiagnosticsOverview, PiCrewSessionProjection } from '../../api/piCrewDiagnostics';

export const PI_CREW_SAFE_CONTROL_PATHS = {
  drain: '/admin/control/drain',
  resume: '/admin/control/resume',
  configValidate: '/admin/control/config/validate',
  configReload: '/admin/control/config/reload',
} as const;

export type PiCrewGlobalControl = keyof typeof PI_CREW_SAFE_CONTROL_PATHS;

export function piCrewConfigMissing(baseUrl: string, bearerToken: string): string | null {
  if (!baseUrl.trim() && !bearerToken.trim()) return 'Configure the Pi Crew admin endpoint and bearer token to load diagnostics.';
  if (!baseUrl.trim()) return 'Configure the Pi Crew admin endpoint URL.';
  if (!bearerToken.trim()) return 'Configure the Pi Crew admin bearer token.';
  return null;
}

export function classificationTone(kind: string): 'ok' | 'warn' | 'error' | 'unknown' {
  if (kind === 'healthy') return 'ok';
  if (kind === 'unknown') return 'unknown';
  if (kind.includes('unreachable') || kind === 'workflow_disagreement') return 'error';
  return 'warn';
}

export function summarizePiCrewOverview(overview: PiCrewDiagnosticsOverview): string {
  const { counts } = overview;
  return [
    overview.classification.kind,
    `${counts.activeSessions} active sessions`,
    `${counts.workerSessions} worker sessions`,
    `${counts.stuckWorkers} stuck`,
    `${counts.checkpointWaiting} checkpoint waiting`,
    `drain ${overview.service.drainMode}`,
  ].join(' · ');
}

export function workerSessions(overview: PiCrewDiagnosticsOverview): PiCrewSessionProjection[] {
  return overview.sessions.filter(session => session.workerBinding !== null);
}

export function conversationalSessions(overview: PiCrewDiagnosticsOverview): PiCrewSessionProjection[] {
  return overview.sessions.filter(session => session.kind === 'conversational');
}

export function safeSessionControlPath(session: PiCrewSessionProjection): string | null {
  if (session.kind !== 'conversational') return null;
  return `/admin/control/sessions/${encodeURIComponent(session.sessionId)}/recreate-instance`;
}

export function safeWorkerStalePath(session: PiCrewSessionProjection): string | null {
  const assignmentId = session.workerBinding?.assignmentId;
  if (!assignmentId) return null;
  const evidence = [session.localLifecycleState, session.lastGatewayEvent, session.classification, ...session.evidenceRefs]
    .join(' ')
    .toLowerCase();
  const hasStaleEvidence = evidence.includes('stuck') || evidence.includes('stale') || evidence.includes('timeout') || evidence.includes('checkpoint.waiting') || session.classification === 'pi_crew_local';
  if (!hasStaleEvidence) return null;
  return `/admin/control/workers/${encodeURIComponent(assignmentId)}/mark-local-stale`;
}

export function buildControlRequest(input: { operator: string; reason: string; idempotencyKey: string; dryRun: boolean; candidateConfig?: string }): PiCrewControlRequest {
  const request: PiCrewControlRequest = {
    operator: input.operator.trim(),
    reason: input.reason.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    dryRun: input.dryRun,
  };
  const candidateConfig = input.candidateConfig ?? '';
  if (candidateConfig.trim()) {
    try {
      request.candidateConfig = JSON.parse(candidateConfig);
    } catch {
      request.candidateConfig = candidateConfig;
    }
  }
  return request;
}

export function validateControlRequest(request: PiCrewControlRequest): string | null {
  if (!request.operator) return 'Operator identity is required.';
  if (!request.reason) return 'Reason is required.';
  if (!request.idempotencyKey) return 'Idempotency key is required.';
  return null;
}
