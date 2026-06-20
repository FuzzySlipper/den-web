import type { TaskDetail as TaskDetailType } from '@den-web/api/types';
import type { StartWorkEvidence, StartWorkPhase } from './startWork';
import { TASK_DETAIL_STATUSES } from './taskDetailFormat';

type Task = TaskDetailType['task'];

interface Props {
  task: Task;
  dependencyWaiting: boolean;
  availabilityLabel: string;
  availabilityTitle: string;
  startWorkPhase: StartWorkPhase;
  startWorkEvidence: StartWorkEvidence | null;
  onStartWork: () => void;
  onStatusChange: (newStatus: string) => void;
}

function StartWorkEvidencePanel({ evidence }: { evidence: StartWorkEvidence }) {
  return (
    <div className={`start-work-evidence start-work-evidence-${evidence.phase}`}>
      <span className="start-work-summary">{evidence.summary}</span>
      {evidence.phase === 'sent' && (
        <div className="start-work-details">
          {evidence.deliveryStatus && (
            <span className="start-work-detail-tag">Delivery: {evidence.deliveryStatus}</span>
          )}
          {evidence.claimStatus && (
            <span className="start-work-detail-tag">Claim: {evidence.claimStatus}</span>
          )}
          {evidence.completionStatus && (
            <span className="start-work-detail-tag">Completion: {evidence.completionStatus}</span>
          )}
          {evidence.channelSlug && (
            <span className="start-work-detail-tag">Channel: #{evidence.channelSlug}</span>
          )}
          {evidence.messageId != null && (
            <span className="start-work-detail-tag">Message: #{evidence.messageId}</span>
          )}
          {evidence.requestId && (
            <span className="start-work-detail-tag">Request: {evidence.requestId}</span>
          )}
          {evidence.gatewayMessageUrl && (
            <a
              className="start-work-link"
              href={evidence.gatewayMessageUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Message record →
            </a>
          )}
        </div>
      )}
      {evidence.phase === 'failed' && (
        <div className="start-work-details">
          {evidence.warning && (
            <div className="start-work-warning">⚠ {evidence.warning}</div>
          )}
          {evidence.recoveryHint && (
            <div className="start-work-recovery">💡 {evidence.recoveryHint}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskStatusSection({
  task,
  dependencyWaiting,
  availabilityLabel,
  availabilityTitle,
  startWorkPhase,
  startWorkEvidence,
  onStartWork,
  onStatusChange,
}: Props) {
  return (
    <div className="detail-section">
      <dl className="detail-meta">
        <dt>Status</dt>
        <dd>
          <select
            className="status-select"
            value={task.status}
            onChange={e => onStatusChange(e.target.value)}
          >
            {TASK_DETAIL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </dd>
        <dt>Availability</dt>
        <dd>
          <span className={`task-availability-chip task-availability-${dependencyWaiting ? 'dependency-waiting' : task.status}`} title={availabilityTitle}>
            {availabilityLabel}
          </span>
        </dd>
        <dt>Priority</dt>
        <dd className={`priority-${task.priority}`}>P{task.priority}</dd>
        <dt>Assigned</dt>
        <dd>{task.assigned_to ?? '(none)'}</dd>
        {task.tags && task.tags.length > 0 && (
          <>
            <dt>Tags</dt>
            <dd>{task.tags.join(', ')}</dd>
          </>
        )}
      </dl>
      <div className="start-work-row">
        {dependencyWaiting ? (
          <>
            <button type="button" className="start-work-button start-work-disabled" disabled>
              Waiting on dependencies
            </button>
            <span className="start-work-hint">Automatic wait: this is not a runnable queue item until Core marks its dependencies satisfied.</span>
          </>
        ) : task.assigned_to ? (
          <>
            <button
              type="button"
              className={`start-work-button${startWorkPhase !== 'idle' ? ' start-work-inflight' : ''}`}
              disabled={startWorkPhase !== 'idle'}
              onClick={onStartWork}
            >
              {startWorkPhase === 'preflighting' && 'Preflighting membership…'}
              {startWorkPhase === 'sending' && 'Sending wake…'}
              {(startWorkPhase === 'idle' || startWorkPhase === 'sent' || startWorkPhase === 'failed') && (
                <>Start work → {task.assigned_to}</>
              )}
            </button>
            {startWorkPhase === 'idle' && (
              <span className="start-work-hint">Sends a targeted direct delivery to {task.assigned_to} through Den Channels.</span>
            )}
          </>
        ) : (
          <>
            <button type="button" className="start-work-button start-work-disabled" disabled>
              Start work
            </button>
            <span className="start-work-hint">Assign this task to an agent to enable the start-work wake.</span>
          </>
        )}
      </div>
      {startWorkEvidence && <StartWorkEvidencePanel evidence={startWorkEvidence} />}
    </div>
  );
}
