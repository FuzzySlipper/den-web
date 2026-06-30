import type { ProjectTask, ReviewPacketResult, TaskDetail, TaskSummary } from './types';
import { coreApiUrl, esc, post } from './http';
import {
  getSuccessorNextTask,
  getSuccessorTaskForMerge,
  listSuccessorTasks,
  mergeTaskDetail,
  successorDetailToTaskDetail,
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
  return listSuccessorTasks(projectId, opts);
}

export async function getTask(projectId: string, taskId: number): Promise<TaskDetail> {
  const successorDetail = await getSuccessorTaskForMerge(projectId, taskId);
  const coreDetail = await fetchCoreTaskDetail(projectId, taskId).catch(() => null);

  if (coreDetail) {
    return mergeTaskDetail(coreDetail, successorDetail);
  }
  return successorDetailToTaskDetail(successorDetail);
}

export function updateTask(
  projectId: string,
  taskId: number,
  agent: string,
  changes: Record<string, unknown>,
): Promise<ProjectTask> {
  return updateSuccessorTask(projectId, taskId, agent, changes);
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
  return getSuccessorNextTask(projectId, assignedTo);
}

async function fetchCoreTaskDetail(projectId: string, taskId: number): Promise<TaskDetail> {
  const requestUrl = coreApiUrl(`/api/projects/${esc(projectId)}/tasks/${taskId}`);
  const res = await fetch(requestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
}
