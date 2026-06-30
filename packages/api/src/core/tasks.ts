import type { ProjectTask, ReviewPacketResult, TaskDetail, TaskSummary } from './types';
import { buildQuery, esc, get, post, put } from './http';
import {
  getSuccessorNextTask,
  getSuccessorTask,
  getSuccessorTaskForMerge,
  listSuccessorTasks,
  mergeTaskDetail,
  updateSuccessorTask,
} from './tasksSuccessor';

export interface ListTasksOpts {
  status?: string;
  assignedTo?: string;
  tags?: string;
  priority?: number;
  parentId?: number;
  tree?: boolean;
}

export function listTasks(projectId: string, opts: ListTasksOpts = {}): Promise<TaskSummary[]> {
  return listSuccessorTasks(projectId, opts).catch(() => {
    const q = buildQuery({
      status: opts.status,
      assignedTo: opts.assignedTo,
      tags: opts.tags,
      priority: opts.priority,
      parentId: opts.parentId,
      tree: opts.tree,
    });
    return get(`/api/projects/${esc(projectId)}/tasks${q}`);
  });
}

export async function getTask(projectId: string, taskId: number): Promise<TaskDetail> {
  const coreDetail = await get<TaskDetail>(`/api/projects/${esc(projectId)}/tasks/${taskId}`).catch(() => null);
  const successorDetail = await getSuccessorTaskForMerge(projectId, taskId).catch(() => null);

  if (coreDetail && successorDetail) {
    return mergeTaskDetail(coreDetail, successorDetail);
  }
  if (coreDetail) {
    return coreDetail;
  }
  return getSuccessorTask(projectId, taskId);
}

export function updateTask(
  projectId: string,
  taskId: number,
  agent: string,
  changes: Record<string, unknown>,
): Promise<ProjectTask> {
  return updateSuccessorTask(projectId, taskId, agent, changes)
    .catch(() => put(`/api/projects/${esc(projectId)}/tasks/${taskId}`, { agent, ...changes }));
}

export function requestReview(
  projectId: string,
  taskId: number,
  body: Record<string, unknown>,
): Promise<ReviewPacketResult> {
  return post(`/api/projects/${esc(projectId)}/tasks/${taskId}/review/request`, body);
}

export function postReviewFindings(
  projectId: string,
  taskId: number,
  body: Record<string, unknown>,
): Promise<ReviewPacketResult> {
  return post(`/api/projects/${esc(projectId)}/tasks/${taskId}/review/findings/post`, body);
}

export function getNextTask(projectId: string, assignedTo?: string): Promise<ProjectTask | null> {
  return getSuccessorNextTask(projectId, assignedTo).catch(() => {
    const q = buildQuery({ assignedTo });
    return get<ProjectTask | { message: string }>(`/api/projects/${esc(projectId)}/tasks/next${q}`)
      .then(res => ('message' in res ? null : res));
  });
}
