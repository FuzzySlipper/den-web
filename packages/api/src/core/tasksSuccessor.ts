import { getConfig, normalizeApiBase } from '../config';
import type { ProjectTask, ReviewWorkflowSummary, TaskDetail, TaskSummary } from './types';
import { buildQuery, esc } from './http';

interface SuccessorTask {
  id: number;
  project_id: string;
  parent_id?: number | null;
  title: string;
  description?: string | null;
  status: ProjectTask['status'];
  priority: number;
  assigned_to?: string | null;
  tags?: string[] | null;
  blocker_summary?: string | null;
  blocker_reason?: string | null;
  blocker_attempted_remedies?: string | null;
  blocker_suggested_next_step?: string | null;
  blocker_requires_human_input?: boolean;
  created_at: string;
  updated_at: string;
}

interface SuccessorTaskSummary extends SuccessorTask {
  dependency_count: number;
  unfinished_dependency_count: number;
  subtask_count: number;
  availability: string;
}

interface SuccessorTaskDetail {
  task: SuccessorTask;
  dependencies: Array<{ task_id: number; title: string; status: ProjectTask['status'] }>;
  subtasks: SuccessorTaskSummary[];
}

interface SuccessorMessage {
  message: string;
}

export interface ListSuccessorTasksOpts {
  status?: string;
  assignedTo?: string;
  tags?: string;
  priority?: number;
  parentId?: number;
  tree?: boolean;
}

const DEFAULT_TASKS_SUCCESSOR_API_BASE = '/api/v1';

let tasksSuccessorApiBase = normalizeApiBase(import.meta.env.VITE_TASKS_SUCCESSOR_API_BASE, DEFAULT_TASKS_SUCCESSOR_API_BASE);

export async function initTasksSuccessorClient(): Promise<void> {
  const config = await getConfig();
  tasksSuccessorApiBase = config.tasksSuccessorApiBase;
}

export function resetTasksSuccessorClient(): void {
  tasksSuccessorApiBase = normalizeApiBase(import.meta.env.VITE_TASKS_SUCCESSOR_API_BASE, DEFAULT_TASKS_SUCCESSOR_API_BASE);
}

function successorUrl(path: string): string {
  return `${tasksSuccessorApiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

async function successorGet<T>(path: string): Promise<T> {
  const requestUrl = successorUrl(path);
  const res = await fetch(requestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
}

async function successorPatch<T>(path: string, body: unknown): Promise<T> {
  const requestUrl = successorUrl(path);
  const res = await fetch(requestUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${requestUrl}: ${res.status}`);
  return res.json();
}

function toProjectTask(task: SuccessorTask): ProjectTask {
  return {
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    assigned_to: task.assigned_to ?? null,
    parent_id: task.parent_id ?? null,
    tags: task.tags ?? null,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

function toTaskSummary(task: SuccessorTaskSummary): TaskSummary {
  return {
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assigned_to: task.assigned_to ?? null,
    parent_id: task.parent_id ?? null,
    tags: task.tags ?? null,
    dependency_count: task.dependency_count,
    unfinished_dependency_count: task.unfinished_dependency_count,
    availability: task.availability,
    subtask_count: task.subtask_count,
  };
}

function emptyReviewWorkflow(): ReviewWorkflowSummary {
  return {
    current_round: null,
    current_verdict: null,
    review_round_count: 0,
    unresolved_finding_count: 0,
    resolved_finding_count: 0,
    addressed_finding_count: 0,
    timeline: [],
  };
}

export function successorDetailToTaskDetail(detail: SuccessorTaskDetail): TaskDetail {
  return {
    task: toProjectTask(detail.task),
    dependencies: detail.dependencies,
    subtasks: detail.subtasks.map(toTaskSummary),
    recent_messages: [],
    review_rounds: [],
    open_review_findings: [],
    resolved_review_findings: [],
    review_workflow: emptyReviewWorkflow(),
  };
}

function mergeProjectTask(coreTask: ProjectTask, successorTask: SuccessorTask): ProjectTask {
  return {
    ...coreTask,
    ...toProjectTask(successorTask),
    availability: coreTask.availability,
    dependency_count: coreTask.dependency_count,
    unfinished_dependency_count: coreTask.unfinished_dependency_count,
    subtask_count: coreTask.subtask_count,
  };
}

export function mergeTaskDetail(coreDetail: TaskDetail, successorDetail: SuccessorTaskDetail): TaskDetail {
  return {
    ...coreDetail,
    task: mergeProjectTask(coreDetail.task, successorDetail.task),
    dependencies: successorDetail.dependencies,
    subtasks: successorDetail.subtasks.map(toTaskSummary),
  };
}

export async function listSuccessorTasks(projectId: string, opts: ListSuccessorTasksOpts = {}): Promise<TaskSummary[]> {
  const q = buildQuery({
    status: opts.status,
    assigned_to: opts.assignedTo,
    tags: opts.tags,
    priority: opts.priority,
    parent_id: opts.parentId,
    tree: opts.tree,
  });
  const tasks = await successorGet<SuccessorTaskSummary[]>(`/projects/${esc(projectId)}/tasks${q}`);
  return tasks.map(toTaskSummary);
}

export async function getSuccessorTask(projectId: string, taskId: number): Promise<TaskDetail> {
  const detail = await successorGet<SuccessorTaskDetail>(`/projects/${esc(projectId)}/tasks/${taskId}`);
  return successorDetailToTaskDetail(detail);
}

export async function getSuccessorTaskForMerge(projectId: string, taskId: number): Promise<SuccessorTaskDetail> {
  return successorGet<SuccessorTaskDetail>(`/projects/${esc(projectId)}/tasks/${taskId}`);
}

export async function updateSuccessorTask(projectId: string, taskId: number, agent: string, changes: Record<string, unknown>): Promise<ProjectTask> {
  const updated = await successorPatch<SuccessorTask>(`/projects/${esc(projectId)}/tasks/${taskId}`, { agent, ...changes });
  return toProjectTask(updated);
}

export async function getSuccessorNextTask(projectId: string, assignedTo?: string): Promise<ProjectTask | null> {
  const q = buildQuery({ assigned_to: assignedTo });
  const task = await successorGet<SuccessorTask | SuccessorMessage>(`/projects/${esc(projectId)}/tasks/next${q}`);
  return 'message' in task ? null : toProjectTask(task);
}
