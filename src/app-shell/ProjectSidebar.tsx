import type { Space } from '../api/types';
import { openNotificationPanelWindow } from '../features/notifications/notificationWindow';

interface Props {
  spaces: Space[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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

export function ProjectSidebar({ spaces, selectedId, onSelect }: Props) {
  const projectCount = spaces.filter(space => space.kind === 'project').length;
  const otherCount = spaces.length - projectCount;

  return (
    <div className="panel panel-projects">
      <div className="panel-header">
        Spaces <span className="count">{spaces.length}</span>
      </div>
      <div className="panel-subheader">
        {projectCount} project{projectCount === 1 ? '' : 's'} · {otherCount} other
      </div>
      <div className="panel-body">
        {spaces.length === 0 ? (
          <div className="empty">No spaces visible.</div>
        ) : spaces.map(space => (
          <button
            key={space.id}
            type="button"
            className={`list-item space-list-item${space.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(space.id)}
            title={[space.name || space.id, space.kind, space.visibility, space.root_path].filter(Boolean).join(' · ')}
          >
            <span className="space-list-title">{space.name || space.id}</span>
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
        ))}
      </div>
      <div className="panel-subheader notification-sidebar-action">
        <button
          type="button"
          className="notification-sidebar-button"
          onClick={openNotificationPanelWindow}
          title="Open notification history panel in a separate window (requires user gesture)"
        >
          🔔 Notification History
        </button>
      </div>
    </div>
  );
}
