import type { TaskDetail, TaskStatus } from '../../api/types';

export type TaskAvailability =
  | 'available'
  | 'waiting_on_dependencies'
  | 'blocked'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'cancelled'
  | 'terminal'
  | string;

export const WAITING_ON_DEPENDENCIES = 'waiting_on_dependencies';

interface TaskAvailabilitySource {
  status: TaskStatus;
  availability?: string | null;
  unfinished_dependency_count?: number | null;
  dependency_count?: number | null;
}

export function isDependencyWaitingTask(task: TaskAvailabilitySource): boolean {
  return task.availability === WAITING_ON_DEPENDENCIES
    || (task.status === 'planned' && (task.unfinished_dependency_count ?? 0) > 0);
}

export function isDependencyWaitingDetail(detail: TaskDetail): boolean {
  const task = detail.task;
  if (task.availability === WAITING_ON_DEPENDENCIES) return true;
  const unfinished = task.unfinished_dependency_count;
  if (task.status === 'planned' && unfinished != null) return unfinished > 0;
  return task.status === 'planned' && detail.dependencies.some(dep => !dependencyStatusSatisfied(dep.status));
}

export function dependencyStatusSatisfied(status: TaskStatus): boolean {
  return status === 'done' || status === 'cancelled';
}

export function taskAvailabilityLabel(task: TaskAvailabilitySource): string {
  if (isDependencyWaitingTask(task)) return 'waiting on dependencies';
  if (task.status === 'blocked' || task.availability === 'blocked') return 'blocked — needs attention';
  if (task.availability && task.availability !== task.status) return task.availability.replace(/_/g, ' ');
  return task.status.replace(/_/g, ' ');
}

export function taskAvailabilityClass(task: TaskAvailabilitySource): string {
  if (isDependencyWaitingTask(task)) return 'dependency-waiting';
  if (task.status === 'blocked' || task.availability === 'blocked') return 'blocked';
  return task.status;
}

export function taskAvailabilityTitle(task: TaskAvailabilitySource): string {
  if (isDependencyWaitingTask(task)) {
    const remaining = task.unfinished_dependency_count ?? 0;
    return `${remaining} unfinished dependenc${remaining === 1 ? 'y' : 'ies'}; this task will become available automatically when dependencies resolve.`;
  }
  if (task.status === 'blocked' || task.availability === 'blocked') {
    return 'Manually blocked; this needs attention and an explicit unblock/status change.';
  }
  if ((task.dependency_count ?? 0) > 0) {
    return 'Dependencies satisfied; this task is available according to Core.';
  }
  return task.status.replace(/_/g, ' ');
}

export function taskStatusIcon(status: TaskStatus, waitingOnDependencies: boolean): { icon: string; cls: string } {
  if (waitingOnDependencies) return { icon: '[⏸]', cls: 'status-dependency-waiting' };
  switch (status) {
    case 'planned':     return { icon: '[ ]', cls: 'status-planned' };
    case 'in_progress': return { icon: '[>]', cls: 'status-in_progress' };
    case 'review':      return { icon: '[?]', cls: 'status-review' };
    case 'blocked':     return { icon: '[!]', cls: 'status-blocked' };
    case 'done':        return { icon: '[x]', cls: 'status-done' };
    case 'cancelled':   return { icon: '[-]', cls: 'status-cancelled' };
  }
}
