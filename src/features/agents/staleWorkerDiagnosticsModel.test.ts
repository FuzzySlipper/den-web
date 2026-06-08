import { describe, expect, it } from 'vitest';
import type { StaleWorkerCondition, StaleWorkerSweepResponse } from '../../api/types';
import { buildStaleWorkerDiagnosticsModel, parseEvidenceIds } from './staleWorkerDiagnosticsModel';

function condition(overrides: Partial<StaleWorkerCondition>): StaleWorkerCondition {
  return {
    stale_signature: 'stale_ack:den-web:run-2038',
    classification: 'stale_ack',
    project_id: 'den-web',
    task_id: 2038,
    run_id: 'run-2038',
    assignment_id: 394,
    worker_role: 'reviewer',
    worker_identity: 'pool-reviewer-01',
    current_state: 'ack',
    last_activity_at: '2026-06-06 09:00:00',
    staleness_deadline: '2026-06-06T09:10:00.0000000',
    age: '40 minutes',
    state_reason: 'Assignment #394 was leased but never started.',
    suggested_next_action: 'Release or expire assignment #394.',
    evidence_ids: '[394]',
    severity: 'warning',
    detected_at: '2026-06-06T09:50:00Z',
    ...overrides,
  };
}

function sweep(conditions: StaleWorkerCondition[]): StaleWorkerSweepResponse {
  return { stale_count: conditions.length, conditions, swept_at: '2026-06-06T10:00:00Z' };
}

describe('buildStaleWorkerDiagnosticsModel', () => {
  it('distinguishes healthy quiet from missing source data', () => {
    const healthy = buildStaleWorkerDiagnosticsModel(sweep([]));
    expect(healthy.kind).toBe('healthy_quiet');
    expect(healthy.summary).toContain('reachable');

    const unavailable = buildStaleWorkerDiagnosticsModel(null, new Error('GET /api/worker-pool/stale: 503'));
    expect(unavailable.kind).toBe('source_unavailable');
    expect(unavailable.summary).toContain('cannot prove worker state');
  });

  it('surfaces stale assignment evidence identifiers and next action', () => {
    const model = buildStaleWorkerDiagnosticsModel(sweep([condition({})]));

    expect(model.kind).toBe('worker_pool_stale');
    expect(model.summary).toContain('worker-pool stale assignment/run');
    expect(model.rows[0]).toMatchObject({
      projectId: 'den-web',
      taskId: 2038,
      assignmentId: 394,
      runId: 'run-2038',
      role: 'reviewer',
      age: '40 minutes',
      suggestedNextAction: 'Release or expire assignment #394.',
      evidenceIds: ['394'],
    });
  });

  it('classifies missing reviewer and orphaned orchestrator states as workflow resume gaps', () => {
    const model = buildStaleWorkerDiagnosticsModel(sweep([
      condition({ classification: 'missing_reviewer_completion', review_round_id: 1177, assignment_id: null, run_id: null }),
      condition({ stale_signature: 'orphaned_orchestrator:den-web:lease-1', classification: 'orphaned_orchestrator_lease', orchestrator_lease_id: 9, worker_role: 'project_orchestrator' }),
    ]));

    expect(model.kind).toBe('workflow_resume_gap');
    expect(model.summary).toContain('2 workflow resume gap');
    expect(model.rows.every(row => row.kind === 'workflow_resume_gap')).toBe(true);
  });

  it('parses evidence IDs from JSON and legacy comma text', () => {
    expect(parseEvidenceIds('[394,396]')).toEqual(['394', '396']);
    expect(parseEvidenceIds('[394, 396]')).toEqual(['394', '396']);
  });
});
