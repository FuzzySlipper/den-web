import type { WorkspaceViewMode } from './workspaceViewModes';
import { TASK_FILTERS, taskFilterLabel } from '../features/tasks/taskStatuses';

export type { WorkspaceViewMode } from './workspaceViewModes';

interface Props {
  statusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  sortMode: string;
  onSortChange: (sort: string) => void;
  viewMode: WorkspaceViewMode;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
}

const SORTS = ['priority', 'id', 'status', 'title'];

export function FilterBar({
  statusFilter, onStatusFilterChange,
  sortMode, onSortChange,
  viewMode, onViewModeChange,
}: Props) {
  return (
    <div className="filter-bar">
      {viewMode === 'tasks' && (
        <>
          <label>Filter:</label>
          <select
            value={statusFilter ?? ''}
            onChange={e => onStatusFilterChange(e.target.value || null)}
          >
            <option value="">All</option>
            {TASK_FILTERS.map(s => (
              <option key={s} value={s}>{taskFilterLabel(s)}</option>
            ))}
          </select>

          <label>Sort:</label>
          <select value={sortMode} onChange={e => onSortChange(e.target.value)}>
            {SORTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </>
      )}

      <div className="view-toggle">
        <button
          className={viewMode === 'tasks' ? 'active' : ''}
          onClick={() => onViewModeChange('tasks')}
        >
          Tasks
        </button>
        <button
          className={viewMode === 'messages' ? 'active' : ''}
          onClick={() => onViewModeChange('messages')}
        >
          Messages
        </button>
        <button
          className={viewMode === 'documents' ? 'active' : ''}
          onClick={() => onViewModeChange('documents')}
        >
          Docs
        </button>
        <button
          className={viewMode === 'git' ? 'active' : ''}
          onClick={() => onViewModeChange('git')}
        >
          Git
        </button>
        <button
          className={viewMode === 'librarian' ? 'active' : ''}
          onClick={() => onViewModeChange('librarian')}
        >
          Librarian
        </button>
        <button
          className={viewMode === 'agent-stream' ? 'active' : ''}
          onClick={() => onViewModeChange('agent-stream')}
        >
          Agent Stream
        </button>
        <button
          className={viewMode === 'sessions' ? 'active' : ''}
          onClick={() => onViewModeChange('sessions')}
        >
          Sessions
        </button>
        <button
          className={viewMode === 'agents' ? 'active' : ''}
          onClick={() => onViewModeChange('agents')}
        >
          Agents
        </button>
        <button
          className={viewMode === 'fleet-ops' ? 'active' : ''}
          onClick={() => onViewModeChange('fleet-ops')}
        >
          Fleet Ops
        </button>
        <button
          className={viewMode === 'notifications' ? 'active' : ''}
          onClick={() => onViewModeChange('notifications')}
        >
          Notifications
        </button>
      </div>
    </div>
  );
}
