import { formatTimeAgo } from '@den-web/shared';
import type { TaskDetail as TaskDetailType } from '@den-web/api/types';
import { renderFindingMeta } from './reviewFindings';
import { formatDelta, formatLabel, formatTimeline, formatVerdict } from './taskDetailFormat';

interface Props {
  detail: TaskDetailType;
}

export function TaskReviewSections({ detail }: Props) {
  const currentRound = detail.review_workflow.current_round;

  return (
    <>
      {detail.review_workflow.review_round_count > 0 && currentRound && (
        <div className="detail-section">
          <h3>Review Workflow</h3>
          <dl className="detail-meta">
            <dt>Current Round</dt>
            <dd>R{currentRound.round_number} on <code>{currentRound.branch}</code></dd>
            <dt>Verdict</dt>
            <dd>
              <span className={`review-pill review-pill-${detail.review_workflow.current_verdict ?? 'pending'}`}>
                {formatVerdict(detail.review_workflow.current_verdict)}
              </span>
            </dd>
            <dt>Reviewed Diff</dt>
            <dd><code>{currentRound.preferred_diff.base_ref}...{currentRound.preferred_diff.head_ref}</code></dd>
            <dt>Delta</dt>
            <dd><code>{formatDelta(detail)}</code></dd>
            <dt>Open Findings</dt>
            <dd>{detail.review_workflow.unresolved_finding_count}</dd>
          </dl>
        </div>
      )}

      {detail.open_review_findings.length > 0 && (
        <div className="detail-section">
          <h3>Open Review Findings</h3>
          {detail.open_review_findings.map(finding => (
            <div key={finding.id} className="review-card">
              <div className="review-card-head">
                <strong>{finding.finding_key}</strong>
                <div className="review-pill-row">
                  <span className={`review-pill review-pill-${finding.category}`}>{formatLabel(finding.category)}</span>
                  <span className={`review-pill review-pill-${finding.status}`}>{formatLabel(finding.status)}</span>
                </div>
              </div>
              <div className="review-summary">{finding.summary}</div>
              {renderFindingMeta(finding).map(line => (
                <div key={line} className="review-subtle">{line}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {detail.review_workflow.timeline.length > 0 && (
        <div className="detail-section">
          <h3>Review Timeline</h3>
          {detail.review_workflow.timeline.map(entry => (
            <div key={entry.review_round_id} className="review-card">
              <div className="review-card-head">
                <strong>R{entry.review_round_number}</strong>
                <span className={`review-pill review-pill-${entry.verdict ?? 'pending'}`}>
                  {formatVerdict(entry.verdict)}
                </span>
              </div>
              <div className="review-summary">
                <code>{entry.branch}</code> · {formatTimeline(entry)}
              </div>
              <div className="review-subtle">
                Requested by {entry.requested_by} {formatTimeAgo(entry.requested_at)}
                {entry.verdict_at ? ` · verdict ${formatTimeAgo(entry.verdict_at)}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
