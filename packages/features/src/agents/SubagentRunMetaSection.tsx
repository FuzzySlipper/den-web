import type { SubagentRunSummary } from '@den-web/api/types';
import {
  formatInfrastructureFailureReason,
  formatSubagentDuration,
  formatSubagentUsageSummary,
} from '@den-web/models/agents/subagentRunsDisplay';

export function SubagentRunMetaSection({ summary }: { summary: SubagentRunSummary }) {
  return (
    <div className="detail-section">
      <dl className="detail-meta">
        <dt>Run</dt>
        <dd className="mono-value">{summary.run_id}</dd>
        <dt>State</dt>
        <dd><span className={`subagent-state subagent-state-${summary.state}`}>{summary.state}</span></dd>
        {summary.role && <><dt>Role</dt><dd>{summary.role}</dd></>}
        {summary.backend && <><dt>Backend</dt><dd>{summary.backend}</dd></>}
        {summary.schema && (
          <>
            <dt>Schema</dt>
            <dd>{summary.schema}{summary.schema_version != null ? ` v${summary.schema_version}` : ''}</dd>
          </>
        )}
        {summary.model && <><dt>Model</dt><dd>{summary.model}</dd></>}
        {summary.purpose && <><dt>Purpose</dt><dd>{summary.purpose}</dd></>}
        {summary.review_round_id != null && <><dt>Review round</dt><dd>{summary.review_round_id}</dd></>}
        {summary.workspace_id && <><dt>Workspace</dt><dd>{summary.workspace_id}</dd></>}
        {summary.branch && <><dt>Branch</dt><dd>{summary.branch}</dd></>}
        {summary.final_head_commit && (
          <>
            <dt>Final head</dt>
            <dd className="mono-value">
              {summary.final_head_commit}{summary.final_head_status ? ` (${summary.final_head_status})` : ''}
            </dd>
          </>
        )}
        {summary.pid != null && <><dt>PID</dt><dd>{summary.pid}</dd></>}
        {summary.exit_code != null && (
          <>
            <dt>Exit</dt>
            <dd>{summary.exit_code}{summary.signal ? ` (${summary.signal})` : ''}</dd>
          </>
        )}
        {summary.output_status && <><dt>Output</dt><dd>{summary.output_status}</dd></>}
        {summary.timeout_kind && <><dt>Timeout</dt><dd>{summary.timeout_kind}</dd></>}
        {summary.infrastructure_failure_reason && (
          <>
            <dt>Infrastructure</dt>
            <dd>{formatInfrastructureFailureReason(summary.infrastructure_failure_reason)}</dd>
          </>
        )}
        {summary.infrastructure_warning_reason && (
          <>
            <dt>Warning</dt>
            <dd>{formatInfrastructureFailureReason(summary.infrastructure_warning_reason)}</dd>
          </>
        )}
        {summary.fallback_from_model && (
          <>
            <dt>Fallback</dt>
            <dd>
              {summary.fallback_from_model} → {summary.fallback_model ?? 'configured fallback'}
              {summary.fallback_from_exit_code != null ? ` (exit ${summary.fallback_from_exit_code})` : ''}
            </dd>
          </>
        )}
        {(summary.heartbeat_count > 0 || summary.assistant_output_count > 0) && (
          <>
            <dt>Progress</dt>
            <dd>{summary.heartbeat_count} heartbeats, {summary.assistant_output_count} outputs</dd>
          </>
        )}
        {summary.duration_ms != null && <><dt>Duration</dt><dd>{formatSubagentDuration(summary.duration_ms)}</dd></>}
        {formatSubagentUsageSummary(summary) && <><dt>Usage</dt><dd>{formatSubagentUsageSummary(summary)}</dd></>}
        {summary.project_id && <><dt>Project</dt><dd>{summary.project_id}</dd></>}
        <dt>Events</dt>
        <dd>{summary.event_count} total, {summary.event_counts.raw_work} raw work/debug</dd>
      </dl>
    </div>
  );
}
