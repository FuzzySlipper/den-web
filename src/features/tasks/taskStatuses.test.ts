import { describe, expect, it } from 'vitest';
import type { TaskSummary } from '../../api/types';
import {
  ACTIVE_TASK_FILTER,
  coreStatusForTaskFilter,
  taskFilterLabel,
  taskMatchesStatusFilter,
} from './taskStatuses';

function task(status: TaskSummary['status'], overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: 1,
    project_id: 'den-web',
    title: `${status} task`,
    status,
    priority: 3,
    assigned_to: null,
    parent_id: null,
    tags: null,
    dependency_count: 0,
    unfinished_dependency_count: 0,
    availability: 'available',
    subtask_count: 0,
    ...overrides,
  };
}

describe('task status filters', () => {
  it('matches active tasks by excluding terminal done/cancelled statuses', () => {
    expect(taskMatchesStatusFilter(task('planned'), ACTIVE_TASK_FILTER)).toBe(true);
    expect(taskMatchesStatusFilter(task('in_progress'), ACTIVE_TASK_FILTER)).toBe(true);
    expect(taskMatchesStatusFilter(task('review'), ACTIVE_TASK_FILTER)).toBe(true);
    expect(taskMatchesStatusFilter(task('blocked'), ACTIVE_TASK_FILTER)).toBe(true);
    expect(taskMatchesStatusFilter(task('done'), ACTIVE_TASK_FILTER)).toBe(false);
    expect(taskMatchesStatusFilter(task('cancelled'), ACTIVE_TASK_FILTER)).toBe(false);
  });

  it('does not send the active-only filter as a Core status query', () => {
    expect(coreStatusForTaskFilter(ACTIVE_TASK_FILTER)).toBeNull();
    expect(coreStatusForTaskFilter('waiting_on_dependencies')).toBeNull();
    expect(coreStatusForTaskFilter(null)).toBeNull();
    expect(coreStatusForTaskFilter('blocked')).toBe('blocked');
  });

  it('keeps the dependency-waiting filter distinct from blocked/manual status filters', () => {
    const waitingTask = task('planned', { availability: 'waiting_on_dependencies', unfinished_dependency_count: 2 });
    const manualBlocked = task('blocked');

    expect(taskMatchesStatusFilter(waitingTask, 'waiting_on_dependencies')).toBe(true);
    expect(taskMatchesStatusFilter(manualBlocked, 'waiting_on_dependencies')).toBe(false);
    expect(taskMatchesStatusFilter(manualBlocked, 'blocked')).toBe(true);
  });

  it('renders stable human labels for special filters', () => {
    expect(taskFilterLabel(null)).toBe('All');
    expect(taskFilterLabel(ACTIVE_TASK_FILTER)).toBe('active');
    expect(taskFilterLabel('waiting_on_dependencies')).toBe('waiting on dependencies');
  });
});
