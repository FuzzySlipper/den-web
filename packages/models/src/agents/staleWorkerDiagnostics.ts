import type { StaleWorkerCondition, StaleWorkerSweepResponse } from '@den-web/api/types';

export type StaleWorkerDiagnosticKind =
  | 'healthy_quiet'
  | 'source_unavailable'
  | 'worker_pool_stale'
  | 'workflow_resume_gap';

export interface StaleWorkerDiagnosticRow {
  key: string;
  kind: StaleWorkerDiagnosticKind;
  severity: string;
  classification: string;
  projectId: string;
  taskId: number | null;
  assignmentId: number | null;
  runId: string | null;
  role: string | null;
  workerIdentity: string | null;
  lastActivityAt: string | null;
  stalenessDeadline: string | null;
  age: string | null;
  stateReason: string;
  suggestedNextAction: string;
  evidenceIds: string[];
}

export interface StaleWorkerDiagnosticsModel {
  kind: StaleWorkerDiagnosticKind;
  title: string;
  summary: string;
  sweptAt: string | null;
  staleCount: number;
  rows: StaleWorkerDiagnosticRow[];
}

const WORKFLOW_GAP_CLASSIFICATIONS = new Set([
  'missing_reviewer_completion',
  'orphaned_orchestrator_lease',
  'direct_agent_claimed_no_terminal',
]);

export function buildStaleWorkerDiagnosticsModel(
  sweep: StaleWorkerSweepResponse | null,
  error: Error | null = null,
): StaleWorkerDiagnosticsModel {
  if (error) {
    return {
      kind: 'source_unavailable',
      title: 'Stale-worker projection unavailable',
      summary: `Could not load Core /api/worker-pool/stale: ${error.message}. The UI cannot prove worker state; use Core or Den MCP readback before assuming all is quiet.`,
      sweptAt: null,
      staleCount: 0,
      rows: [],
    };
  }

  const rows = (sweep?.conditions ?? []).map(conditionToRow);
  if (rows.length === 0) {
    return {
      kind: 'healthy_quiet',
      title: 'No stale workers reported',
      summary: 'Core stale-worker projection is reachable and reports no stale assignment/run conditions for this scope.',
      sweptAt: sweep?.swept_at ?? null,
      staleCount: sweep?.stale_count ?? 0,
      rows: [],
    };
  }

  const resumeGaps = rows.filter(row => row.kind === 'workflow_resume_gap').length;
  const staleAssignments = rows.length - resumeGaps;
  const parts = [
    staleAssignments > 0 ? `${staleAssignments} worker-pool stale assignment/run` : null,
    resumeGaps > 0 ? `${resumeGaps} workflow resume gap` : null,
  ].filter(Boolean);

  return {
    kind: resumeGaps > 0 && staleAssignments === 0 ? 'workflow_resume_gap' : 'worker_pool_stale',
    title: 'Stale worker attention needed',
    summary: `${sweep?.stale_count ?? rows.length} stale condition${(sweep?.stale_count ?? rows.length) === 1 ? '' : 's'} reported by Core: ${parts.join(' · ') || 'stale workflow evidence'}.`,
    sweptAt: sweep?.swept_at ?? null,
    staleCount: sweep?.stale_count ?? rows.length,
    rows,
  };
}

export function conditionToRow(condition: StaleWorkerCondition): StaleWorkerDiagnosticRow {
  const classification = condition.classification;
  return {
    key: condition.stale_signature,
    kind: WORKFLOW_GAP_CLASSIFICATIONS.has(classification) ? 'workflow_resume_gap' : 'worker_pool_stale',
    severity: condition.severity ?? 'warning',
    classification,
    projectId: condition.project_id,
    taskId: condition.task_id ?? null,
    assignmentId: condition.assignment_id ?? null,
    runId: condition.run_id ?? null,
    role: condition.worker_role ?? null,
    workerIdentity: condition.worker_identity ?? null,
    lastActivityAt: condition.last_activity_at ?? null,
    stalenessDeadline: condition.staleness_deadline ?? null,
    age: condition.age ?? null,
    stateReason: condition.state_reason,
    suggestedNextAction: condition.suggested_next_action,
    evidenceIds: parseEvidenceIds(condition.evidence_ids),
  };
}

export function parseEvidenceIds(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map(item => String(item));
  } catch {
    // Fall through to lenient display parsing for older Core text.
  }
  return value.replace(/^\[|\]$/g, '').split(',').map(part => part.trim()).filter(Boolean);
}
