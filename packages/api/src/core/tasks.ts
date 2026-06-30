import type { ProjectTask, ReviewPacketResult, TaskDetail, TaskSummary } from './types';
import { coreApiUrl, esc, post } from './http';
import { listSuccessorMessages } from './messagesSuccessor';
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
  const successorMessages = await listSuccessorMessages(projectId, { taskId, limit: 10 }).catch(() => []);
  const coreDetail = await fetchCoreTaskDetail(projectId, taskId).catch(() => null);

  if (coreDetail) {
    return withRecentMessages(mergeTaskDetail(coreDetail, successorDetail), successorMessages);
  }
  return withRecentMessages(successorDetailToTaskDetail(successorDetail), successorMessages);
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

function withRecentMessages(detail: TaskDetail, successorMessages: TaskDetail['recent_messages']): TaskDetail {
  if (successorMessages.length === 0) return detail;

  const seen = new Set<number>();
  const recent_messages = [...successorMessages, ...detail.recent_messages]
    .filter(message => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    })
    .sort((a, b) => {
      const byTime = Date.parse(b.created_at) - Date.parse(a.created_at);
      return byTime !== 0 ? byTime : b.id - a.id;
    })
    .slice(0, 10);

  return { ...detail, recent_messages };
}
