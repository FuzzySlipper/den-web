/**
 * Shared task status/filter constants used by FilterBar and navigation hotkeys.
 *
 * Extracted from FilterBar.tsx to avoid react-refresh warning about
 * exporting non-component values from a component file.
 */

import type { TaskStatus, TaskSummary } from '../../api/types';
import { isDependencyWaitingTask } from './taskAvailability';

export const STATUSES = ['planned', 'in_progress', 'review', 'blocked', 'done', 'cancelled'] as const;
export const ACTIVE_TASK_FILTER = 'active' as const;
export const TASK_AVAILABILITY_FILTERS = ['waiting_on_dependencies'] as const;
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['done', 'cancelled'];
export const TASK_FILTERS = [ACTIVE_TASK_FILTER, ...STATUSES, ...TASK_AVAILABILITY_FILTERS] as const;
export type TaskFilterStatus = (typeof TASK_FILTERS)[number];

export function taskFilterLabel(filter: string | null): string {
  if (!filter) return 'All';
  if (filter === ACTIVE_TASK_FILTER) return 'active';
  return filter.replace(/_/g, ' ');
}

export function isActiveTaskStatus(status: string): boolean {
  return !TERMINAL_TASK_STATUSES.includes(status as TaskStatus);
}

export function taskMatchesStatusFilter(
  task: Pick<TaskSummary, 'status' | 'availability' | 'unfinished_dependency_count'>,
  filter: string | null,
): boolean {
  if (!filter) return true;
  if (filter === ACTIVE_TASK_FILTER) return isActiveTaskStatus(task.status);
  if (filter === 'waiting_on_dependencies') return isDependencyWaitingTask(task);
  return task.status === filter;
}

export function coreStatusForTaskFilter(filter: string | null): TaskStatus | null {
  if (!filter || filter === ACTIVE_TASK_FILTER || filter === 'waiting_on_dependencies') return null;
  return STATUSES.includes(filter as TaskStatus) ? filter as TaskStatus : null;
}
