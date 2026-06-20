import { useCallback, useMemo, useState } from 'react';
import type { Space } from '@den-web/api/types';
import { openNotificationPanelWindow } from '@den-web/features/notifications/notificationWindow';
import {
  readPinnedProjectIds,
  writePinnedProjectIds,
  togglePinned,
  sortSpacesWithPinned,
  isAggregateEntryId,
} from '@den-web/features/projects/pinnedProjects';

interface Props {
  spaces: Space[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showHiddenSpaces: boolean;
  showArchivedSpaces: boolean;
  hiddenSpaceCount: number;
  archivedSpaceCount: number;
  onToggleHiddenSpaces: () => void;
  onToggleArchivedSpaces: () => void;
  /** Notification history display mode from preferences */
  notificationHistoryMode?: 'window' | 'sidePanel';
  /** Callback to toggle the side panel notification view */
  onToggleNotificationPanel?: () => void;
  /** Unread notification count from the global operator feed. */
  notificationUnreadCount?: number;
  /** Newly arrived unread notifications since the current session baseline. */
  notificationNewCount?: number;
  /** Short text cue for the latest new operator event. */
  notificationCue?: string | null;
  /** True when window-mode focus/open was blocked or not armed. */
  notificationFocusBlocked?: boolean;
  /** Called when the user explicitly opens/acknowledges the notification surface. */
  onAcknowledgeNotificationCue?: () => void;
}

interface SpaceVisibilityToolbarProps {
  showHiddenSpaces: boolean;
  showArchivedSpaces: boolean;
  hiddenSpaceCount: number;
  archivedSpaceCount: number;
  onToggleHiddenSpaces: () => void;
  onToggleArchivedSpaces: () => void;
}

interface SpaceRowProps {
  space: Space;
  selected: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, event: React.MouseEvent) => void;
}

interface NotificationSidebarActionProps {
  notificationHistoryMode?: 'window' | 'sidePanel';
  onToggleNotificationPanel?: () => void;
  notificationUnreadCount: number;
  notificationNewCount: number;
  notificationCue: string | null;
  notificationFocusBlocked: boolean;
  onAcknowledgeNotificationCue?: () => void;
}

function hasRootCapability(space: Space): boolean {
  return Boolean(space.root_path?.trim());
}

function spaceCapabilityLabel(space: Space): string {
  if (space.id === '_all') return 'aggregate view';
  if (space.id === '_global') return 'global scope';
  if (space.kind === 'project') return hasRootCapability(space) ? 'repo-backed' : 'project';
  return hasRootCapability(space) ? 'root-backed' : 'no repo';
}

function SpaceVisibilityToolbar({
  showHiddenSpaces,
  showArchivedSpaces,
  hiddenSpaceCount,
  archivedSpaceCount,
  onToggleHiddenSpaces,
  onToggleArchivedSpaces,
}: SpaceVisibilityToolbarProps) {
  return (
    <div className="space-visibility-toolbar" aria-label="Space visibility filters">
      <button
        type="button"
        className={`space-visibility-toggle${showHiddenSpaces ? ' active' : ''}`}
        onClick={onToggleHiddenSpaces}
        aria-pressed={showHiddenSpaces}
        disabled={hiddenSpaceCount === 0}
        title={showHiddenSpaces ? 'Hide hidden spaces' : 'Show hidden spaces'}
      >
        Hidden <span className="space-visibility-toggle-count">{hiddenSpaceCount}</span>
      </button>
      <button
        type="button"
        className={`space-visibility-toggle${showArchivedSpaces ? ' active' : ''}`}
        onClick={onToggleArchivedSpaces}
        aria-pressed={showArchivedSpaces}
        disabled={archivedSpaceCount === 0}
        title={showArchivedSpaces ? 'Hide archived spaces' : 'Show archived spaces'}
      >
        Archived <span className="space-visibility-toggle-count">{archivedSpaceCount}</span>
      </button>
    </div>
  );
}

function SpaceRow({ space, selected, pinned, onSelect, onTogglePin }: SpaceRowProps) {
  const isAggregate = isAggregateEntryId(space.id);
  return (
    <div className={`space-list-item-wrapper${selected ? ' selected' : ''}`}>
      <button
        type="button"
        className="space-list-toggle-pin"
        onClick={ev => onTogglePin(space.id, ev)}
        aria-label={pinned ? `Unpin ${space.name || space.id}` : `Pin ${space.name || space.id}`}
        title={isAggregate ? 'Aggregate entries cannot be pinned' : (pinned ? 'Unpin from top' : 'Pin to top')}
        disabled={isAggregate}
      >
        {pinned ? '📌' : '○'}
      </button>
      <button
        type="button"
        className="list-item space-list-item"
        onClick={() => onSelect(space.id)}
        title={[space.name || space.id, space.kind, space.visibility, space.root_path].filter(Boolean).join(' · ')}
      >
        <span className="space-list-title">
          {pinned && <span className="space-pin-indicator" title="Pinned">📌</span>}
          {space.name || space.id}
        </span>
        <span className="space-list-id">{space.id}</span>
        <span className="space-list-meta">
          <span className={`space-kind kind-${space.kind}`}>{space.kind}</span>
          {space.visibility !== 'normal' && (
            <span className={`space-visibility visibility-${space.visibility}`}>{space.visibility}</span>
          )}
          <span className={hasRootCapability(space) ? 'space-capability' : 'space-capability space-capability-muted'}>
            {spaceCapabilityLabel(space)}
          </span>
        </span>
      </button>
    </div>
  );
}

function NotificationSidebarAction({
  notificationHistoryMode,
  onToggleNotificationPanel,
  notificationUnreadCount,
  notificationNewCount,
  notificationCue,
  notificationFocusBlocked,
  onAcknowledgeNotificationCue,
}: NotificationSidebarActionProps) {
  return (
    <div className="panel-subheader notification-sidebar-action">
      <button
        type="button"
        className={`notification-sidebar-button ${notificationNewCount > 0 ? 'notification-sidebar-button-attention' : ''}`}
        onClick={() => {
          if (notificationHistoryMode === 'sidePanel') {
            onToggleNotificationPanel?.();
          } else {
            openNotificationPanelWindow();
          }
          onAcknowledgeNotificationCue?.();
        }}
        title={
          notificationHistoryMode === 'sidePanel'
            ? 'Open notification history in side panel (toggle on/off)'
            : 'Open notification history panel in a separate window (requires user gesture)'
        }
      >
        <span className="notification-sidebar-button-main">
          🔔 Notification History
          {notificationUnreadCount > 0 && (
            <span className="notification-sidebar-badge">{notificationUnreadCount}</span>
          )}
        </span>
        {notificationCue && (
          <span className="notification-sidebar-cue">
            {notificationCue}
            {notificationFocusBlocked && ' — open the panel once to arm pop-out focus'}
          </span>
        )}
      </button>
    </div>
  );
}

export function ProjectSidebar({
  spaces: rawSpaces,
  selectedId,
  onSelect,
  showHiddenSpaces,
  showArchivedSpaces,
  hiddenSpaceCount,
  archivedSpaceCount,
  onToggleHiddenSpaces,
  onToggleArchivedSpaces,
  notificationHistoryMode,
  onToggleNotificationPanel,
  notificationUnreadCount = 0,
  notificationNewCount = 0,
  notificationCue = null,
  notificationFocusBlocked = false,
  onAcknowledgeNotificationCue,
}: Props) {
  // In-memory pin state (read once; UI toggles are optimistically applied)
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedProjectIds());

  const spaces = useMemo(
    () => sortSpacesWithPinned(rawSpaces, pinnedIds),
    [rawSpaces, pinnedIds],
  );

  const projectCount = spaces.filter(space => space.kind === 'project').length;
  const otherCount = spaces.length - projectCount;

  const handleTogglePin = useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const next = togglePinned(pinnedIds, id);
    setPinnedIds(next);
    writePinnedProjectIds(next);
  }, [pinnedIds]);

  return (
    <div className="panel panel-projects">
      <div className="panel-header">
        Spaces <span className="count">{spaces.length}</span>
      </div>
      <div className="panel-subheader">
        {projectCount} project{projectCount === 1 ? '' : 's'} · {otherCount} other
        {pinnedIds.length > 0 && (
          <span className="space-pinned-count"> · {pinnedIds.length} pinned</span>
        )}
      </div>
      <SpaceVisibilityToolbar
        showHiddenSpaces={showHiddenSpaces}
        showArchivedSpaces={showArchivedSpaces}
        hiddenSpaceCount={hiddenSpaceCount}
        archivedSpaceCount={archivedSpaceCount}
        onToggleHiddenSpaces={onToggleHiddenSpaces}
        onToggleArchivedSpaces={onToggleArchivedSpaces}
      />
      <div className="panel-body">
        {spaces.length === 0 ? (
          <div className="empty">No spaces visible.</div>
        ) : spaces.map(space => {
          return (
            <SpaceRow
              key={space.id}
              space={space}
              selected={space.id === selectedId}
              pinned={pinnedIds.includes(space.id)}
              onSelect={onSelect}
              onTogglePin={handleTogglePin}
            />
          );
        })}
      </div>
      <NotificationSidebarAction
        notificationHistoryMode={notificationHistoryMode}
        onToggleNotificationPanel={onToggleNotificationPanel}
        notificationUnreadCount={notificationUnreadCount}
        notificationNewCount={notificationNewCount}
        notificationCue={notificationCue}
        notificationFocusBlocked={notificationFocusBlocked}
        onAcknowledgeNotificationCue={onAcknowledgeNotificationCue}
      />
    </div>
  );
}
