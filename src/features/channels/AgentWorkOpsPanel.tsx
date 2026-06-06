import type { AgentWorkCurrentResponse, AgentWorkEventsResponse, ChannelActivityEvent, DirectAgentEvent } from '../../api/types';
import { formatTimeAgo, truncate } from '../../utils';
import { buildAgentWorkOpsModel } from './agentWorkOpsModel';

interface AgentWorkOpsPanelProps {
  current: AgentWorkCurrentResponse | null;
  lifecycle: AgentWorkEventsResponse | null;
  activityEvents: ChannelActivityEvent[];
  directAgentEvents: DirectAgentEvent[];
  loading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

export function AgentWorkOpsPanel({ current, lifecycle, activityEvents, directAgentEvents, loading, error, onRefresh }: AgentWorkOpsPanelProps) {
  const model = buildAgentWorkOpsModel(current, lifecycle, activityEvents, directAgentEvents);

  return (
    <section className={`channel-agent-work-panel channel-agent-work-mode-${model.mode}`} aria-label="Current agent work and evidence">
      <div className="channel-chat-members-header channel-agent-work-header">
        <strong>Agent work</strong>
        <span>{loading ? 'loading…' : model.headingDetail}</span>
        <button type="button" onClick={onRefresh} disabled={loading} title="Refresh agent-work evidence">↻</button>
      </div>
      {error ? (
        <div className="channel-chat-state channel-chat-state-error">{error.message}</div>
      ) : (
        <>
          <div className="channel-agent-work-diagnostic">
            <span className={`channel-agent-work-mode-pill mode-${model.mode}`}>{modeLabel(model.mode)}</span>
            <span>{model.diagnostic}</span>
            {current?.generatedAt && <span>Generated {formatTimeAgo(current.generatedAt)}</span>}
          </div>
          {model.currentRows.length > 0 ? (
            <div className="channel-agent-work-current-list">
              {model.currentRows.slice(0, 8).map(row => (
                <article key={row.key} className={`channel-agent-work-row state-${stateClass(row.state)} ${row.stalenessDiagnostic ? 'is-stale' : ''}`}>
                  <div className="channel-agent-work-row-top">
                    <strong>{row.agentIdentity}</strong>
                    <span>{row.state}</span>
                    {row.lastActivityAt && <time>{formatTimeAgo(row.lastActivityAt)}</time>}
                  </div>
                  <div className="channel-agent-work-reason">{row.stateReason}</div>
                  <div className="channel-agent-work-ids">
                    {row.projectId && <span>project {row.projectId}</span>}
                    {row.taskId && <span>task #{row.taskId}</span>}
                    {row.workerRole && <span>{row.workerRole}</span>}
                    {row.workerRunId && <span title={row.workerRunId}>run {shortId(row.workerRunId)}</span>}
                    {row.assignmentId && <span title={row.assignmentId}>assignment {shortId(row.assignmentId)}</span>}
                    {row.deliveryRequestId && <span title={row.deliveryRequestId}>delivery {shortId(row.deliveryRequestId)}</span>}
                    {row.sessionId && <span title={row.sessionId}>session {shortId(row.sessionId)}</span>}
                  </div>
                  {row.stalenessDiagnostic && <div className="channel-agent-work-stale">{row.stalenessDiagnostic}</div>}
                  <EvidenceLinks links={row.evidenceLinks} provenance={row.evidenceProvenance} />
                </article>
              ))}
            </div>
          ) : (
            <div className="channel-chat-state channel-chat-state-muted">{model.diagnostic}</div>
          )}
          {model.timelineItems.length > 0 && (
            <details className="channel-agent-work-timeline" open={model.currentRows.length === 0}>
              <summary>Recent evidence ({model.timelineItems.length})</summary>
              <div className="channel-agent-work-timeline-list">
                {model.timelineItems.map(item => (
                  <div key={item.key} className={`channel-agent-work-timeline-row source-${item.source}`}>
                    <span className="message-time">{formatTimeAgo(item.createdAt)}</span>
                    <span className="channel-agent-work-source">{sourceLabel(item.source)}</span>
                    <strong>{item.agentIdentity}</strong>
                    <span>{item.title}</span>
                    <span>{item.status}</span>
                    {item.taskId && <span>task #{item.taskId}</span>}
                    {item.workerRunId && <span title={item.workerRunId}>run {shortId(item.workerRunId)}</span>}
                    {item.evidenceLink && <a href={item.evidenceLink} target="_blank" rel="noreferrer">evidence</a>}
                    {item.detail && <span className="channel-agent-work-detail">{truncate(item.detail, 140)}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function EvidenceLinks({ links, provenance }: { links: string[]; provenance: string[] }) {
  if (links.length === 0 && provenance.length === 0) return null;
  return (
    <div className="channel-agent-work-evidence-links">
      {provenance.map(source => <span key={source}>{source.replaceAll('_', ' ')}</span>)}
      {links.slice(0, 3).map((link, index) => (
        <a key={`${link}:${index}`} href={link} target="_blank" rel="noreferrer">evidence {index + 1}</a>
      ))}
    </div>
  );
}

function shortId(value: string): string {
  return value.length <= 14 ? value : value.slice(0, 12);
}

function stateClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'lifecycle': return 'lifecycle';
    case 'composed': return 'composed evidence';
    case 'activity_fallback': return 'activity fallback';
    case 'direct_agent_fallback': return 'direct-agent fallback';
    default: return 'no evidence';
  }
}

function sourceLabel(source: string): string {
  return source === 'direct_agent' ? 'direct' : source;
}
