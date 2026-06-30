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
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'not found' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const detail = await getTask('den-services', 3862);

    expect(detail.task.status).toBe('review');
    expect(detail.review_workflow.review_round_count).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/projects/den-services/tasks/3862');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/den-core-api/api/projects/den-services/tasks/3862');
  });
});
