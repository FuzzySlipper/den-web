import { formatTimeAgo, truncate } from '@den-web/shared';
import type { NotificationItem, NotificationSeverity, NotificationSourceKind } from './notificationFeed';

interface NotificationRowProps {
  item: NotificationItem;
  isNew: boolean;
  onClick: (item: NotificationItem) => void;
  onOpenTask?: (taskId: number, projectId?: string | null) => void;
}

function severityClass(severity: NotificationSeverity): string {
  return `notif-severity-${severity}`;
}

function sourceTypeLabel(type: NotificationSourceKind): string {
  switch (type) {
    case 'agent_work_complete': return 'Agent Done';
    case 'user_directed_message': return 'User Message';
    case 'user_notification': return 'Notification';
  }
}

export function NotificationRow({ item, isNew, onClick, onOpenTask }: NotificationRowProps) {
  return (
    <article
      className={`notification-item ${item.read ? 'notification-item-read' : 'notification-item-unread'} ${isNew ? 'notification-item-new' : ''} ${severityClass(item.severity)}`}
      onClick={() => onClick(item)}
    >
      <div className="notification-item-topline">
        <span className="message-time">{formatTimeAgo(item.timestamp)}</span>
        <span className={`notification-item-type-chip ${severityClass(item.severity)}`}>
          {sourceTypeLabel(item.type)}
        </span>
        {item.agentService && (
          <span className="notification-item-agent">{item.agentService}</span>
        )}
        {item.status && (
          <span className="notification-item-status">{item.status}</span>
        )}
        <span className={`notification-item-severity ${severityClass(item.severity)}`}>
          {item.severity}
        </span>
      </div>

      <div className="notification-item-summary">
        {truncate(item.summary, 240)}
      </div>

      <div className="notification-item-meta">
        <span className="notification-item-source">{item.sourceKind}</span>
        {item.projectId && (
          <span className="notification-item-project">{item.projectId}</span>
        )}
        {item.taskId != null && (
          <button
            type="button"
            className="stream-link"
            onClick={event => {
              event.stopPropagation();
              onOpenTask?.(item.taskId!, item.projectId);
            }}
          >
            Task #{item.taskId}
          </button>
        )}
        {item.runId && (
          <span className="notification-item-run" title={item.runId}>
            Run {truncate(item.runId, 12)}
          </span>
        )}
        {item.dispatchId != null && (
          <span className="notification-item-dispatch">
            Dispatch #{item.dispatchId}
          </span>
        )}
      </div>
    </article>
  );
}
