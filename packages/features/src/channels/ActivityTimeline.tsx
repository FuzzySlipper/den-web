import type { ChannelActivityEvent } from '@den-web/api/types';
import { formatTimeAgo } from '@den-web/shared';
import { sortActivityEvents, toActivityDisplayModel } from '@den-web/models/channels';

function shortWorkerRunId(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 12) return normalized;
  return normalized.slice(0, 8);
}

function activityStatusClass(status: string): string {
  return status.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function activitySeverityClass(severity: string | null): string {
  switch (severity) {
    case 'success':
    case 'warning':
    case 'error':
      return `channel-chat-activity-severity-${severity}`;
    default:
      return 'channel-chat-activity-severity-info';
  }
}

function activityWorkerChip(event: ReturnType<typeof toActivityDisplayModel>) {
  if (!event.workerRunId && !event.workerRole && !event.parentAgentIdentity && !event.parentHermesSessionKey && !event.childSessionId && !event.toolCallId) return null;
  const role = event.workerRole?.trim() || 'worker';
  const run = event.workerRunId ? shortWorkerRunId(event.workerRunId) : (event.childSessionId ? shortWorkerRunId(event.childSessionId) : 'pending');
  const title = [
    event.displayBlockId ? `display block ${event.displayBlockId}` : null,
    event.parentAgentIdentity ? `parent agent ${event.parentAgentIdentity}` : null,
    event.parentHermesSessionKey ? `parent session ${event.parentHermesSessionKey}` : null,
    event.rootSessionId ? `root session ${event.rootSessionId}` : null,
    event.toolCallId ? `tool call ${event.toolCallId}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <span className="channel-chat-activity-worker-chip" title={title || undefined}>
      {role} · {event.agentIdentity || 'agent'} · {run}
    </span>
  );
}

/** Breadcrumb timeline of agent activity events, optionally compact (inline under a message). */
export function ActivityTimeline({ events, compact = false }: { events: ChannelActivityEvent[]; compact?: boolean }) {
  if (events.length === 0) return null;
  const displayEvents = sortActivityEvents(events).map(toActivityDisplayModel);
  return (
    <div className={`channel-chat-activity-timeline ${compact ? 'channel-chat-activity-timeline-compact' : ''}`} aria-label="Agent activity breadcrumbs">
      {!compact && (
        <div className="channel-chat-activity-heading">
          <span>Agent activity</span>
          <span>{displayEvents.length} breadcrumb{displayEvents.length === 1 ? '' : 's'}</span>
        </div>
      )}
      {displayEvents.map(event => (
        <div key={event.id} className={`channel-chat-activity-row channel-chat-activity-${activityStatusClass(event.status)} ${activitySeverityClass(event.severity)} ${event.terminal ? 'channel-chat-activity-terminal' : ''}`}>
          <span className="message-time">{formatTimeAgo(event.createdAt)}</span>
          <span className="channel-chat-activity-agent">{event.agentIdentity}</span>
          <span className="channel-chat-activity-main">
            {activityWorkerChip(event)}
            <strong>{event.title}{event.count ? ` ×${event.count}` : ''}</strong>
            <span className="channel-chat-activity-status">{event.severity ?? event.status}</span>
            <span className="channel-chat-activity-stage">{event.displayOnly ? 'display-only' : (event.terminal ? 'terminal' : event.deliveryStage)}</span>
            {event.visibility && <span className="channel-chat-activity-task">visibility {event.visibility}</span>}
            {event.toolName && <span className="channel-chat-activity-task">tool {event.toolName}</span>}
            {event.toolCallId && <span className="channel-chat-activity-task" title={event.toolCallId}>call {shortWorkerRunId(event.toolCallId)}</span>}
            {event.durationMs !== null && <span className="channel-chat-activity-task">{event.durationMs}ms</span>}
            {event.outcome && <span className="channel-chat-activity-task">outcome {event.outcome}</span>}
            {event.taskId && <span className="channel-chat-activity-task">task #{event.taskId}</span>}
            {event.finalChannelMessageId && <span className="channel-chat-activity-task">final message #{event.finalChannelMessageId}</span>}
            {event.sourceMessageId && <span className="channel-chat-activity-task">source message #{event.sourceMessageId}</span>}
            {event.refLinks.map(ref => ref.href ? (
              <a key={ref.label} className="channel-chat-activity-task" href={ref.href} target="_blank" rel="noreferrer">{ref.label}</a>
            ) : (
              <span key={ref.label} className="channel-chat-activity-task">{ref.label}</span>
            ))}
            {event.preview && <span className="channel-chat-activity-preview">{event.preview}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
