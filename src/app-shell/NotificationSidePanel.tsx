import { NotificationHistoryPanel } from '../features/notifications/NotificationHistoryPanel';

interface Props {
  projectIds: string[];
  onClose: () => void;
  onOpenTask: (taskId: number, projectId?: string | null) => void;
}

/** Docked notification history panel shown when the side-panel mode is toggled open. */
export function NotificationSidePanel({ projectIds, onClose, onOpenTask }: Props) {
  return (
    <div className="notification-side-panel">
      <div className="notification-side-panel-header">
        <button
          type="button"
          className="notification-side-panel-close detail-close"
          onClick={onClose}
          aria-label="Close notification side panel"
        >
          ✕
        </button>
      </div>
      <NotificationHistoryPanel projectIds={projectIds} onOpenTask={onOpenTask} />
    </div>
  );
}
