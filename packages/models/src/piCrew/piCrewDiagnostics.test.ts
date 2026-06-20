import { describe, expect, it } from 'vitest';
import type { PiCrewDiagnosticsOverview, PiCrewSessionProjection } from '@den-web/api/piCrewDiagnostics';
import {
  buildControlRequest,
  classificationTone,
  conversationalSessions,
  piCrewConfigMissing,
  safeSessionControlPath,
  safeWorkerStalePath,
  summarizePiCrewOverview,
  validateControlRequest,
  workerSessions,
} from './piCrewDiagnostics';

function session(overrides: Partial<PiCrewSessionProjection>): PiCrewSessionProjection {
  return {
    sessionId: 'session-1',
    profileId: 'pi-crew',
    instanceId: 'instance-1',
    kind: 'worker',
    sessionState: 'active',
    workerBinding: {
      assignmentId: 'assignment-1',
      runId: 'run-1',
      taskId: 2120,
      projectId: 'den-web',
      role: 'coder',
    },
    denAssignment: null,
    localLifecycleState: 'worker.stuck',
    lastActivityAt: '2026-06-12T09:00:00Z',
    lastGatewayEvent: 'worker.stuck',
    drainState: 'inactive',
    classification: 'pi_crew_local',
    evidenceRefs: ['worker.stuck:assignment-1'],
    ...overrides,
  };
}

function overview(overrides: Partial<PiCrewDiagnosticsOverview> = {}): PiCrewDiagnosticsOverview {
  return {
    service: { status: 'ok', version: 'test', uptimeSeconds: 42, startedAt: '2026-06-12T09:00:00Z', drainMode: 'inactive' },
    classification: { kind: 'healthy', summary: 'ok' },
    denCore: { status: 'ok', lastOkAt: '2026-06-12T09:00:00Z' },
    denChannels: { status: 'ok', lastOkAt: '2026-06-12T09:00:00Z' },
    mcp: { status: 'ok', lastOkAt: '2026-06-12T09:00:00Z' },
    runtimeDb: { status: 'ok' },
    counts: { activeSessions: 2, workerSessions: 1, conversationalSessions: 1, activeAssignmentsLocal: 1, stuckWorkers: 1, checkpointWaiting: 0 },
    sessions: [session({}), session({ sessionId: 'conversation-1', kind: 'conversational', workerBinding: null, classification: 'healthy' })],
    recentEvents: [{ event: 'worker.stuck', payload: { assignmentId: 'assignment-1' } }],
    ...overrides,
  };
}

describe('Pi Crew diagnostics model', () => {
  it('summarizes read-only diagnostics and classifies tones', () => {
    expect(summarizePiCrewOverview(overview())).toContain('1 worker sessions');
    expect(classificationTone('healthy')).toBe('ok');
    expect(classificationTone('den_core_unreachable')).toBe('error');
    expect(classificationTone('pi_crew_local')).toBe('warn');
    expect(classificationTone('unknown')).toBe('unknown');
  });

  it('detects missing auth/config state before calling the admin API', () => {
    expect(piCrewConfigMissing('', '')).toContain('Configure');
    expect(piCrewConfigMissing('http://127.0.0.1:9237', '')).toContain('bearer token');
    expect(piCrewConfigMissing('http://127.0.0.1:9237', '', 'none')).toBeNull();
    expect(piCrewConfigMissing('', 'token')).toContain('endpoint');
    expect(piCrewConfigMissing('http://127.0.0.1:9237', 'token')).toBeNull();
  });

  it('derives only ADR-approved safe control paths', () => {
    const data = overview();
    expect(workerSessions(data).map(item => item.sessionId)).toEqual(['session-1']);
    expect(conversationalSessions(data).map(item => item.sessionId)).toEqual(['conversation-1']);
    expect(safeWorkerStalePath(workerSessions(data)[0])).toBe('/admin/control/workers/assignment-1/mark-local-stale');
    expect(safeWorkerStalePath(session({ localLifecycleState: 'turn.completed', lastGatewayEvent: 'turn.completed', classification: 'healthy', evidenceRefs: [] }))).toBeNull();
    expect(safeSessionControlPath(conversationalSessions(data)[0])).toBe('/admin/control/sessions/conversation-1/recreate-instance');
    expect(safeSessionControlPath(workerSessions(data)[0])).toBeNull();
  });

  it('requires dry-run/real controls to carry operator, reason, and idempotency key', () => {
    expect(validateControlRequest(buildControlRequest({ operator: '', reason: 'r', idempotencyKey: 'k', dryRun: true }))).toContain('Operator');
    expect(validateControlRequest(buildControlRequest({ operator: 'patch', reason: '', idempotencyKey: 'k', dryRun: true }))).toContain('Reason');
    expect(validateControlRequest(buildControlRequest({ operator: 'patch', reason: 'safe preview', idempotencyKey: '', dryRun: true }))).toContain('Idempotency');
    expect(buildControlRequest({ operator: ' patch ', reason: ' safe preview ', idempotencyKey: ' key ', dryRun: true, candidateConfig: '{"admin":true}' })).toMatchObject({
      operator: 'patch',
      reason: 'safe preview',
      idempotencyKey: 'key',
      dryRun: true,
      candidateConfig: { admin: true },
    });
  });
});
