import { useCallback, useMemo, useState } from 'react';
import type { Space } from '../api/types';
import { openNotificationPanelWindow } from '../features/notifications/notificationWindow';
import {
  readPinnedProjectIds,
  writePinnedProjectIds,
  togglePinned,
  sortSpacesWithPinned,
  isAggregateEntryId,
} from '../features/projects/pinnedProjects';

interface Props {
  spaces: Space[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Notification history display mode from preferences */
  notificationHistoryMode?: 'window' | 'sidePanel';
  /** Callback to toggle the side panel notification view */
  onToggleNotificationPanel?: () => void;
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

export function ProjectSidebar({ spaces: rawSpaces, selectedId, onSelect, notificationHistoryMode, onToggleNotificationPanel }: Props) {
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
      <div className="panel-body">
        {spaces.length === 0 ? (
          <div className="empty">No spaces visible.</div>
        ) : spaces.map(space => {
          const isPinned = pinnedIds.includes(space.id);
          const isAggregate = isAggregateEntryId(space.id);
          return (
            <div
              key={space.id}
              className={`space-list-item-wrapper${space.id === selectedId ? ' selected' : ''}`}
            >
              <button
                type="button"
                className="space-list-toggle-pin"
                onClick={ev => handleTogglePin(space.id, ev)}
                aria-label={isPinned ? `Unpin ${space.name || space.id}` : `Pin ${space.name || space.id}`}
                title={isAggregate ? 'Aggregate entries cannot be pinned' : (isPinned ? 'Unpin from top' : 'Pin to top')}
                disabled={isAggregate}
              >
                {isPinned ? '📌' : '○'}
              </button>
              <button
                type="button"
                className="list-item space-list-item"
                onClick={() => onSelect(space.id)}
                title={[space.name || space.id, space.kind, space.visibility, space.root_path].filter(Boolean).join(' · ')}
              >
                <span className="space-list-title">
                  {isPinned && <span className="space-pin-indicator" title="Pinned">📌</span>}
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
        })}
      </div>
      <div className="panel-subheader notification-sidebar-action">
        <button
          type="button"
          className="notification-sidebar-button"
          onClick={() => {
            if (notificationHistoryMode === 'sidePanel') {
              onToggleNotificationPanel?.();
            } else {
              openNotificationPanelWindow();
            }
          }}
          title={
            notificationHistoryMode === 'sidePanel'
              ? 'Open notification history in side panel (toggle on/off)'
              : 'Open notification history panel in a separate window (requires user gesture)'
          }
        >
          🔔 Notification History
        </button>
      </div>
    </div>
  );
}
