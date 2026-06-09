import { useCallback } from 'react';
import type { StaleWorkerSweepResponse } from '../../api/types';
import { listStaleWorkerConditions } from '../../api/client';
import { useLiveData } from '../../hooks/useLiveData';
import { formatTimeAgo } from '../../utils';
import { buildStaleWorkerDiagnosticsModel, type StaleWorkerDiagnosticRow } from './staleWorkerDiagnosticsModel';

interface Props {
  projectId?: string | null;
  compact?: boolean;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
}

export function StaleWorkerDiagnosticsPanel({ projectId, compact = false, onOpenAssignmentTrace }: Props) {
  const fetchStaleWorkers = useCallback(() => listStaleWorkerConditions({ projectId: projectId ?? undefined, limit: compact ? 5 : 20 }), [projectId, compact]);
  const { data, loading, error, refresh } = useLiveData<StaleWorkerSweepResponse>(fetchStaleWorkers, { interval: 10000 });
  const model = buildStaleWorkerDiagnosticsModel(data ?? null, error);

  return (
    <section className={`stale-worker-panel stale-worker-panel-${model.kind} ${compact ? 'stale-worker-panel-compact' : ''}`} aria-label="Stale worker diagnostics">
      <div className="stale-worker-header">
        <div>
          <strong>{model.title}</strong>
          <span>{projectId ? `Scope: ${projectId}` : 'Scope: all projects'}</span>
        </div>
        <div className="stale-worker-actions">
          {model.sweptAt && <span title={model.sweptAt}>Swept {formatTimeAgo(model.sweptAt)}</span>}
          <button type="button" onClick={refresh} disabled={loading} title="Refresh Core stale-worker projection">
            Refresh
          </button>
        </div>
      </div>
      <div className="stale-worker-summary">
        {loading && !data && !error ? 'Loading Core stale-worker projection…' : model.summary}
      </div>
      {model.rows.length > 0 && (
        <div className="stale-worker-list">
          {model.rows.slice(0, compact ? 3 : 8).map(row => (
            <StaleWorkerRow key={row.key} row={row} onOpenAssignmentTrace={onOpenAssignmentTrace} />
          ))}
        </div>
      )}
    </section>
  );
}

function StaleWorkerRow({ row, onOpenAssignmentTrace }: { row: StaleWorkerDiagnosticRow; onOpenAssignmentTrace?: (assignmentId: string) => void }) {
  const assignmentId = row.assignmentId == null ? null : String(row.assignmentId);
  return (
    <article className={`stale-worker-row stale-worker-row-${row.kind} severity-${row.severity}`}>
      <div className="stale-worker-row-top">
        <strong>{row.classification.replaceAll('_', ' ')}</strong>
        <span>{row.severity}</span>
        {row.age && <span>{row.age}</span>}
      </div>
      <div className="stale-worker-evidence-ids">
        <span>project {row.projectId}</span>
        {row.taskId != null && <span>task #{row.taskId}</span>}
        {row.role && <span>role {row.role}</span>}
        {row.workerIdentity && <span>worker {row.workerIdentity}</span>}
        {row.runId && <span title={row.runId}>run {shortId(row.runId)}</span>}
        {assignmentId && (
          <span>
            assignment{' '}
            {onOpenAssignmentTrace ? (
              <button type="button" className="stale-worker-inline-link" onClick={() => onOpenAssignmentTrace(assignmentId)}>
                {assignmentId}
              </button>
            ) : assignmentId}
          </span>
        )}
      </div>
      <p>{row.stateReason}</p>
      <div className="stale-worker-timestamps">
        {row.lastActivityAt && <span>Last activity: {formatTimeAgo(row.lastActivityAt)}</span>}
        {row.stalenessDeadline && <span>Deadline: {formatTimeAgo(row.stalenessDeadline)}</span>}
      </div>
      <div className="stale-worker-next-action">Next: {row.suggestedNextAction}</div>
    </article>
  );
}

function shortId(value: string): string {
  return value.length <= 14 ? value : value.slice(0, 12);
}
