import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDetail } from './types';
import { getSuccessorTask, listSuccessorTasks, mergeTaskDetail, resetTasksSuccessorClient, updateSuccessorTask } from './tasksSuccessor';

afterEach(() => {
  resetTasksSuccessorClient();
  vi.unstubAllGlobals();
});

function coreDetail(): TaskDetail {
  return {
    task: {
      id: 3862,
      project_id: 'den-services',
      title: 'Core stale title',
      description: 'Core stale description',
      status: 'in_progress',
      priority: 3,
      assigned_to: 'old-agent',
      parent_id: null,
      tags: ['core'],
      created_at: '2026-06-29T00:00:00Z',
      updated_at: '2026-06-29T00:00:00Z',
    },
    dependencies: [{ task_id: 1, title: 'Core dep', status: 'planned' }],
    subtasks: [],
    recent_messages: [{
      id: 99,
      project_id: 'den-services',
      task_id: 3862,
      thread_id: null,
      sender: 'reviewer',
      intent: 'general',
      metadata: null,
      content: 'keep me',
      created_at: '2026-06-29T00:00:00Z',
    }],
    review_rounds: [],
    open_review_findings: [],
    resolved_review_findings: [],
    review_workflow: {
      current_round: null,
      current_verdict: null,
      review_round_count: 1,
      unresolved_finding_count: 0,
      resolved_finding_count: 0,
      addressed_finding_count: 0,
      timeline: [],
    },
  };
}

describe('mergeTaskDetail', () => {
  it('overlays successor-owned task fields while preserving Core composition fields', () => {
    const merged = mergeTaskDetail(coreDetail(), {
      task: {
        id: 3862,
        project_id: 'den-services',
        title: 'Successor title',
        description: 'Successor description',
        status: 'done',
        priority: 1,
        assigned_to: 'den-services',
        tags: ['tasks'],
        created_at: '2026-06-30T00:00:00Z',
        updated_at: '2026-06-30T01:00:00Z',
      },
      dependencies: [{ task_id: 2, title: 'Successor dep', status: 'done' }],
      subtasks: [{
        id: 3863,
        project_id: 'den-services',
        title: 'Subtask',
        status: 'planned',
        priority: 2,
        assigned_to: null,
        tags: null,
        created_at: '2026-06-30T00:00:00Z',
        updated_at: '2026-06-30T00:00:00Z',
        dependency_count: 0,
        unfinished_dependency_count: 0,
        subtask_count: 0,
        availability: 'available',
      }],
    });

    expect(merged.task.status).toBe('done');
    expect(merged.task.title).toBe('Successor title');
    expect(merged.dependencies).toEqual([{ task_id: 2, title: 'Successor dep', status: 'done' }]);
    expect(merged.subtasks).toHaveLength(1);
    expect(merged.recent_messages[0]?.content).toBe('keep me');
    expect(merged.review_workflow.review_round_count).toBe(1);
  });
});

describe('tasks successor API', () => {
  it('maps task list query keys to the successor contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await listSuccessorTasks('den-services', {
      status: 'planned,review',
      assignedTo: 'codex',
      parentId: 3726,
      tree: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/projects/den-services/tasks?status=planned%2Creview&assigned_to=codex&parent_id=3726&tree=true',
      { cache: 'no-store' },
    );
  });

  it('synthesizes a minimal detail for successor-only tasks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        task: {
          id: 3862,
          project_id: 'den-services',
          title: 'Successor-only',
          status: 'in_progress',
          priority: 1,
          assigned_to: 'den-services',
          tags: ['tasks'],
          created_at: '2026-06-30T00:00:00Z',
          updated_at: '2026-06-30T00:00:00Z',
        },
        dependencies: [],
        subtasks: [],
        history: [],
      }),
    }));

    const detail = await getSuccessorTask('den-services', 3862);

    expect(detail.task.title).toBe('Successor-only');
    expect(detail.recent_messages).toEqual([]);
    expect(detail.review_workflow.review_round_count).toBe(0);
  });

  it('updates through PATCH and returns the successor task shape as ProjectTask', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 3862,
        project_id: 'den-services',
        title: 'Updated',
        status: 'review',
        priority: 1,
        created_at: '2026-06-30T00:00:00Z',
        updated_at: '2026-06-30T00:01:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await updateSuccessorTask('den-services', 3862, 'web-ui', { status: 'review' });

    expect(updated.status).toBe('review');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects/den-services/tasks/3862', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'web-ui', status: 'review' }),
    });
  });
});
