/**
 * Notification History Panel
 *
 * A separate-window notification history panel for Den Web that renders a
 * scrollable/accruing feed of notifications from multiple source classes:
 *   - User notification records (intent=notification messages)
 *   - User-directed messages (questions, task_blocked, etc.)
 *   - Agent/worker stream events (completions, status changes)
 *   - Worker run completions/failures
 *
 * Window management: The first open requires a user gesture (button click)
 * which calls window.open() with a named target. Subsequent activations
 * reuse/focus the same window. When opened as a standalone popup, the app
 * detects the #/notification-panel URL hash and renders only this panel
 * in a full-window layout.
 */

import { useCallback, useMemo, useState } from 'react';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo, truncate } from '../../utils';
import {
  type NotificationItem,
  type NotificationSourceKind,
  type NotificationSeverity,
  fetchNotificationFeed,
  filterFeed,
  markNotificationRead,
  markAllRead,
  clearLocalReadState,
  countUnread,
} from './notificationFeed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10000;

const SOURCE_KIND_OPTIONS: Array<{ value: NotificationSourceKind | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'user_notification', label: 'Notifications' },
  { value: 'user_message', label: 'Messages' },
  { value: 'agent_event', label: 'Agent Events' },
  { value: 'worker_completion', label: 'Worker Completions' },
];

const SEVERITY_OPTIONS: Array<{ value: NotificationSeverity | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'error', label: 'Errors' },
  { value: 'warning', label: 'Warnings' },
  { value: 'success', label: 'Success' },
  { value: 'info', label: 'Info' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityClass(severity: NotificationSeverity): string {
  return `notif-severity-${severity}`;
}

function sourceTypeLabel(type: NotificationSourceKind): string {
  switch (type) {
    case 'user_notification': return 'Notification';
    case 'user_message': return 'Message';
    case 'agent_event': return 'Agent';
    case 'worker_completion': return 'Worker';
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Project IDs to fetch notifications for. */
  projectIds: string[];
  /** Optional class name for the root element. */
  className?: string;
  /** Callback to open a task detail. */
  onOpenTask?: (taskId: number, projectId?: string | null) => void;
  /** If true, render in standalone popup mode with extra chrome sizing. */
  standalone?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationHistoryPanel({
  projectIds,
  className = '',
  onOpenTask,
  standalone = false,
}: Props) {
  // Feed filters
  const [typeFilter, setTypeFilter] = useState<NotificationSourceKind | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | 'all'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showRead, setShowRead] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');

  // Fetch feed
  const fetchFeed = useCallback(
    () => fetchNotificationFeed(projectIds),
    [projectIds],
  );
  const { data: feed, loading, error, refresh } = usePolling(fetchFeed, POLL_INTERVAL_MS);

  // Derive error display from feed.result.error (API-caught errors as string)
  // falling back to usePolling's thrown-error state as a safety net.
  const errorMessage = useMemo<string | null>(() => {
    if (feed?.error) return feed.error;
    if (error) return error.message ?? String(error);
    return null;
  }, [feed?.error, error]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return filterFeed(feed?.items ?? [], {
      type: typeFilter,
      severity: severityFilter,
      search: searchFilter || undefined,
      projectId: projectFilter || undefined,
      showRead,
    });
  }, [feed, typeFilter, severityFilter, searchFilter, projectFilter, showRead]);

  const unreadCount = useMemo(() => feed ? countUnread(feed.items) : 0, [feed]);

  // Derived project options from feed
  const projectOptions = useMemo(() => {
    if (!feed) return [];
    const ids = new Set(feed.items.map(item => item.projectId).filter((id): id is string => id !== null));
    return Array.from(ids).sort();
  }, [feed]);

  // Handlers
  const handleMarkAllRead = useCallback(() => {
    if (feed) markAllRead(feed.items.map(item => item.id));
    refresh();
  }, [feed, refresh]);

  const handleClearLocal = useCallback(() => {
    clearLocalReadState();
    refresh();
  }, [refresh]);

  // Direct mark-read on scroll/visibility of each item
  const handleItemClick = useCallback((item: NotificationItem) => {
    if (!item.read) {
      markNotificationRead(item.id);
      refresh();
    }
  }, [refresh]);

  const emptyLabel = useMemo(() => {
    if (loading) return 'Loading notifications…';
    if (errorMessage) return `Error: ${errorMessage}`;
    return 'No notifications yet.';
  }, [loading, errorMessage]);

  return (
    <div className={`notification-panel ${standalone ? 'notification-panel-standalone' : ''} ${className}`}>
      {/* Header */}
      <div className="notification-panel-header">
        <h2 className="notification-panel-title">
          Notification History
          {unreadCount > 0 && (
            <span className="notification-panel-unread-badge">{unreadCount} unread</span>
          )}
        </h2>
        <div className="notification-panel-header-actions">
          <button
            type="button"
            className="notification-panel-action"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            title="Mark all displayed as read (local only)"
          >
            Mark all read
          </button>
          <button
            type="button"
            className="notification-panel-action"
            onClick={handleClearLocal}
            title="Clear local read tracking (does not delete backend records)"
          >
            Reset local reads
          </button>
          <button
            type="button"
            className="notification-panel-action"
            onClick={refresh}
            title="Refresh notification feed"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="notification-panel-filters feed-toolbar">
        <label className="panel-filter-label" htmlFor="notif-type-filter">Type</label>
        <select
          id="notif-type-filter"
          className="panel-filter-select"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as NotificationSourceKind | 'all')}
        >
          {SOURCE_KIND_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <label className="panel-filter-label" htmlFor="notif-severity-filter">Severity</label>
        <select
          id="notif-severity-filter"
          className="panel-filter-select"
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value as NotificationSeverity | 'all')}
        >
          {SEVERITY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <input
          className="feed-text-filter"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Search…"
        />

        {projectOptions.length > 1 && (
          <>
            <label className="panel-filter-label" htmlFor="notif-project-filter">Space</label>
            <select
              id="notif-project-filter"
              className="panel-filter-select"
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
            >
              <option value="">All spaces</option>
              {projectOptions.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </>
        )}

        <label className="thought-raw-toggle" title="Show or hide already-read notifications">
          <input
            type="checkbox"
            checked={showRead}
            onChange={e => setShowRead(e.target.checked)}
          />
          Show read
        </label>
      </div>

      {/* Backend gap notice (shown when standalone in popup) */}
      {standalone && (
        <div className="notification-panel-notice detail-info">
          This panel composes notifications from existing Den APIs. A dedicated
          notification feed API does not yet exist — see the backend gap doc in
          <code> notificationFeed.ts</code>.
        </div>
      )}

      {/* Feed list */}
      <div className="notification-panel-body panel-body">
        {errorMessage && !loading ? (
          <div className="notification-panel-error detail-error">
            <strong>Failed to load notifications.</strong>
            <p>{errorMessage}</p>
            <button type="button" className="detail-action" onClick={refresh}>
              Retry
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="notification-panel-empty">
            {loading ? (
              <div className="loading">{emptyLabel}</div>
            ) : (
              <div className="empty">{emptyLabel}</div>
            )}
          </div>
        ) : (
          <div className="notification-panel-list">
            {filteredItems.map(item => (
              <NotificationRow
                key={item.id}
                item={item}
                onClick={handleItemClick}
                onOpenTask={onOpenTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="notification-panel-footer">
        {feed && (
          <span className="notification-panel-stats">
            {filteredItems.length} of {feed.items.length} notifications
            {unreadCount > 0 && ` (${unreadCount} unread)`}
          </span>
        )}
        <span className="notification-panel-backend-notice">
          Local read state only
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification Row
// ---------------------------------------------------------------------------

interface NotificationRowProps {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
  onOpenTask?: (taskId: number, projectId?: string | null) => void;
}

function NotificationRow({ item, onClick, onOpenTask }: NotificationRowProps) {
  return (
    <article
      className={`notification-item ${item.read ? 'notification-item-read' : 'notification-item-unread'} ${severityClass(item.severity)}`}
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
