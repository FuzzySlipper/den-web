import { TASK_FILTERS } from '@den-web/features/tasks/taskStatuses';
import { WORKSPACE_VIEW_MODES, type WorkspaceViewMode } from './workspaceViewModes';

/** Short labels used in the mobile section switcher. */
export const WORKSPACE_VIEW_LABELS: Record<WorkspaceViewMode, string> = {
  tasks: 'Tasks',
  messages: 'Messages',
  documents: 'Docs',
  git: 'Git',
  librarian: 'Librarian',
  'agent-stream': 'Agent Stream',
  sessions: 'Sessions',
  agents: 'Agents',
  dm: 'DM',
  'fleet-ops': 'Fleet Ops',
  'pi-crew-diagnostics': 'Pi Crew',
  notifications: 'Notifications',
};

/** Long titles rendered in the main panel header. */
export const WORKSPACE_VIEW_TITLES: Record<WorkspaceViewMode, string> = {
  tasks: 'Tasks',
  messages: 'Messages',
  documents: 'Documents',
  git: 'Git',
  librarian: 'Librarian',
  'agent-stream': 'Agent Stream',
  sessions: 'Sessions',
  agents: 'Agents',
  dm: 'Direct Messages',
  'fleet-ops': 'Fleet Ops',
  'pi-crew-diagnostics': 'Pi Crew Diagnostics',
  notifications: 'Notifications',
};

export function mainPanelTitle(viewMode: WorkspaceViewMode): string {
  return WORKSPACE_VIEW_TITLES[viewMode];
}

export interface MainPanelCounts {
  taskCount: number;
  filterLabel: string;
  sortLabel: string;
  docCount: number;
  streamCount: number;
}

/** Count badge shown next to the main panel title, or null when the view has no count. */
export function mainPanelCountLabel(viewMode: WorkspaceViewMode, counts: MainPanelCounts): string | null {
  switch (viewMode) {
    case 'tasks':
      return `(${counts.taskCount}${counts.filterLabel}${counts.sortLabel})`;
    case 'documents':
      return `(${counts.docCount})`;
    case 'agent-stream':
      return `(${counts.streamCount})`;
    default:
      return null;
  }
}

/** Next main-panel view when cycling forward (cycle-main-panel hotkey). */
export function nextViewMode(current: WorkspaceViewMode): WorkspaceViewMode {
  const currentIdx = WORKSPACE_VIEW_MODES.indexOf(current);
  const nextIdx = (currentIdx + 1) % WORKSPACE_VIEW_MODES.length;
  return WORKSPACE_VIEW_MODES[nextIdx];
}

/**
 * Next task status filter when cycling (cycle-task-filter hotkey).
 * The cycle includes an "all" option, represented as null.
 */
export function nextTaskFilter(current: string | null): string | null {
  const cycle = ['', ...TASK_FILTERS];
  const currentIdx = current ? cycle.indexOf(current) : 0;
  const nextIdx = (currentIdx + 1) % cycle.length;
  return cycle[nextIdx] || null;
}
