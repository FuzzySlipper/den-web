import { describe, expect, it } from 'vitest';
import type { TaskDetail, TaskSummary } from '../../api/types';
import {
  dependencyStatusSatisfied,
  isDependencyWaitingDetail,
  isDependencyWaitingTask,
  taskAvailabilityLabel,
  taskAvailabilityTitle,
  taskStatusIcon,
} from './taskAvailability';

function summary(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    id: 1,
    project_id: 'den-web',
    title: 'Example task',
    status: 'planned',
    priority: 3,
    assigned_to: 'den-mcp-runner',
    parent_id: null,
    tags: null,
    dependency_count: 1,
    unfinished_dependency_count: 1,
    availability: 'waiting_on_dependencies',
    subtask_count: 0,
    ...overrides,
  };
}

function detail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    task: {
      id: 1,
      project_id: 'den-web',
      title: 'Example task',
      description: null,
      status: 'planned',
      priority: 3,
      assigned_to: 'den-mcp-runner',
      parent_id: null,
      tags: null,
      availability: 'waiting_on_dependencies',
      dependency_count: 1,
      unfinished_dependency_count: 1,
      subtask_count: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    dependencies: [{ task_id: 2, title: 'Parent', status: 'in_progress' }],
    subtasks: [],
    recent_messages: [],
    review_rounds: [],
    open_review_findings: [],
    resolved_review_findings: [],
    review_workflow: {
      current_round: null,
      current_verdict: null,
      review_round_count: 0,
      unresolved_finding_count: 0,
      resolved_finding_count: 0,
      addressed_finding_count: 0,
      timeline: [],
    },
    ...overrides,
  };
}

describe('task availability helpers', () => {
  it('uses Core availability to classify dependency waits', () => {
    const task = summary({ availability: 'waiting_on_dependencies', unfinished_dependency_count: 1 });

    expect(isDependencyWaitingTask(task)).toBe(true);
    expect(taskAvailabilityLabel(task)).toBe('waiting on dependencies');
    expect(taskAvailabilityTitle(task)).toContain('will become available automatically');
    expect(taskStatusIcon(task.status, isDependencyWaitingTask(task))).toEqual({ icon: '[⏸]', cls: 'status-dependency-waiting' });
  });

  it('falls back to unfinished dependency count for legacy payloads', () => {
    const task = summary({ availability: 'available', unfinished_dependency_count: 2 });

    expect(isDependencyWaitingTask(task)).toBe(true);
  });

  it('keeps manual blocked distinct from dependency waiting', () => {
    const task = summary({ status: 'blocked', availability: 'blocked', unfinished_dependency_count: 0 });

    expect(isDependencyWaitingTask(task)).toBe(false);
    expect(taskAvailabilityLabel(task)).toBe('blocked — needs attention');
    expect(taskAvailabilityTitle(task)).toContain('explicit unblock');
  });

  it('classifies detail payload dependency waits from dependency rows when summary fields are absent', () => {
    const d = detail({
      task: {
        ...detail().task,
        availability: undefined,
        unfinished_dependency_count: undefined,
      },
    });

    expect(isDependencyWaitingDetail(d)).toBe(true);
  });

  it('treats done and cancelled dependencies as satisfied', () => {
    expect(dependencyStatusSatisfied('done')).toBe(true);
    expect(dependencyStatusSatisfied('cancelled')).toBe(true);
    expect(dependencyStatusSatisfied('blocked')).toBe(false);
  });
});
