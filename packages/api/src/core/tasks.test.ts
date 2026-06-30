import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTask, listTasks, updateTask } from './tasks';
import { resetClient } from './client';

afterEach(() => {
  resetClient();
  vi.unstubAllGlobals();
});

function successorDetail(status = 'review') {
  return {
    task: {
      id: 3862,
      project_id: 'den-services',
      title: 'Successor task',
      status,
      priority: 1,
      assigned_to: 'den-services',
      tags: ['tasks'],
      created_at: '2026-06-30T00:00:00Z',
      updated_at: '2026-06-30T00:01:00Z',
    },
    dependencies: [],
    subtasks: [],
    history: [],
  };
}

function successorMessages() {
  return [
    {
      id: 17369,
      project_id: 'den-services',
      task_id: 3862,
      thread_id: null,
      sender: 'den-mcp-planner',
      content: 'looks good',
      intent: 'review_feedback',
      metadata: { verdict: 'looks_good' },
      created_at: '2026-06-30T13:00:44Z',
    },
  ];
}

function coreDetailWithMessage() {
  return {
    task: {
      id: 3862,
      project_id: 'den-services',
      title: 'Core task',
      description: null,
      status: 'planned',
      priority: 3,
      assigned_to: null,
      parent_id: null,
      tags: null,
      created_at: '2026-06-29T00:00:00Z',
      updated_at: '2026-06-29T00:00:00Z',
    },
    dependencies: [],
    subtasks: [],
    recent_messages: [
      {
        id: 17360,
        project_id: 'den-services',
        task_id: 3862,
        thread_id: null,
        sender: 'core',
        content: 'core context',
        intent: 'note',
        metadata: null,
        created_at: '2026-06-30T12:00:00Z',
      },
    ],
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
  };
}

describe('task successor cutover client', () => {
  it('does not fall back to Core listTasks when the successor read fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'unavailable' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTasks('den-services')).rejects.toThrow('GET /api/v1/projects/den-services/tasks: 503');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects/den-services/tasks', { cache: 'no-store' });
  });

  it('does not fall back to Core updateTask when the successor write fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'unavailable' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateTask('den-services', 3862, 'web-ui', { status: 'done' })).rejects.toThrow(
      'PATCH /api/v1/projects/den-services/tasks/3862: 503',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects/den-services/tasks/3862', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'web-ui', status: 'done' }),
    });
  });

  it('requires successor detail before optionally composing Core context', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'unavailable' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTask('den-services', 3862)).rejects.toThrow(
      'GET /api/v1/projects/den-services/tasks/3862: 503',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses successor detail when Core composition does not have the task', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successorDetail('review')),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successorMessages()),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'not found' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const detail = await getTask('den-services', 3862);

    expect(detail.task.status).toBe('review');
    expect(detail.recent_messages.map(message => message.id)).toEqual([17369]);
    expect(detail.review_workflow.review_round_count).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/projects/den-services/tasks/3862');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/projects/den-services/messages?task_id=3862&limit=10');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/den-core-api/api/projects/den-services/tasks/3862');
  });

  it('merges successor task-thread messages with Core-composed task context', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successorDetail('review')),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successorMessages()),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(coreDetailWithMessage()),
      });
    vi.stubGlobal('fetch', fetchMock);

    const detail = await getTask('den-services', 3862);

    expect(detail.task.status).toBe('review');
    expect(detail.recent_messages.map(message => message.id)).toEqual([17369, 17360]);
  });
});
