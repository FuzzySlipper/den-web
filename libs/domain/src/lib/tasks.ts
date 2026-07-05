import type { DenTaskDetail, DenTaskSummary } from '@den-web/protocol';

export const ACTIVE_TASK_FILTER = 'active';

export type TaskStatusFilter = string | typeof ACTIVE_TASK_FILTER | 'waiting_on_dependencies' | null;

export interface TaskNode {
  readonly task: DenTaskSummary;
  readonly children: readonly TaskNode[];
}

export interface FlatTaskRow {
  readonly task: DenTaskSummary;
  readonly parent: DenTaskSummary | null;
  readonly depth: number;
}

export type TaskSortMode = 'priority' | 'id';

const terminalStatuses = new Set(['done', 'cancelled']);

export function taskMatchesStatusFilter(task: DenTaskSummary, filter: TaskStatusFilter): boolean {
  if (filter === null) return true;
  if (filter === ACTIVE_TASK_FILTER) return !terminalStatuses.has(task.status ?? '');
  if (filter === 'waiting_on_dependencies') return isDependencyWaitingTask(task);
  return task.status === filter;
}

export function taskStatusQuery(filter: TaskStatusFilter): string | null {
  if (filter === null || filter === ACTIVE_TASK_FILTER || filter === 'waiting_on_dependencies') return null;
  return filter;
}

export function taskFilterLabel(filter: TaskStatusFilter): string {
  if (filter === null) return 'All';
  if (filter === ACTIVE_TASK_FILTER) return 'active';
  if (filter === 'waiting_on_dependencies') return 'waiting on dependencies';
  return filter.replace(/_/g, ' ');
}

export function isDependencyWaitingTask(task: DenTaskSummary): boolean {
  if (task.availability === 'waiting_on_dependencies') return true;
  if (task.status === 'blocked') return false;
  return (task.unfinished_dependency_count ?? 0) > 0;
}

export function isDependencyWaitingDetail(detail: DenTaskDetail): boolean {
  if (isDependencyWaitingTask(detail.task)) return true;
  return (detail.dependencies ?? []).some((dependency) => !dependencyStatusSatisfied(dependency.status));
}

export function dependencyStatusSatisfied(status: string | null | undefined): boolean {
  return status === 'done' || status === 'cancelled';
}

export function taskAvailabilityLabel(task: DenTaskSummary): string {
  if (isDependencyWaitingTask(task)) return 'waiting on dependencies';
  if (task.status === 'blocked') return 'blocked - needs attention';
  return task.availability?.replace(/_/g, ' ') ?? task.status?.replace(/_/g, ' ') ?? 'unknown';
}

export function buildTaskTree(tasks: readonly DenTaskSummary[]): readonly TaskNode[] {
  const childrenByParent = new Map<number | null, DenTaskSummary[]>();
  for (const task of tasks) {
    const parentId = task.parent_id ?? null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), task]);
  }

  const build = (parentId: number | null): readonly TaskNode[] => {
    const children = childrenByParent.get(parentId) ?? [];
    return children.map((task) => ({ task, children: build(task.id) }));
  };

  return build(null);
}

export function sortTaskRows(tasks: readonly DenTaskSummary[], mode: TaskSortMode): readonly DenTaskSummary[] {
  return [...tasks].sort((left, right) => compareTasks(left, right, mode));
}

export function sortTaskTree(nodes: readonly TaskNode[], mode: TaskSortMode): readonly TaskNode[] {
  return [...nodes]
    .sort((left, right) => compareTasks(left.task, right.task, mode))
    .map((node) => ({ ...node, children: sortTaskTree(node.children, mode) }));
}

export function flattenTaskTree(nodes: readonly TaskNode[]): readonly FlatTaskRow[] {
  const rows: FlatTaskRow[] = [];
  const visit = (node: TaskNode, parent: DenTaskSummary | null, depth: number): void => {
    rows.push({ task: node.task, parent, depth });
    for (const child of node.children) visit(child, node.task, depth + 1);
  };

  for (const node of nodes) visit(node, null, 0);
  return rows;
}

export function taskSearchMatches(task: DenTaskSummary, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return taskSearchText(task).includes(normalizedQuery);
}

export function taskSearchText(task: DenTaskSummary): string {
  return [
    String(task.id),
    task.project_id,
    task.title,
    task.status,
    task.assigned_to,
    task.description,
    ...(task.tags ?? []),
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .toLowerCase();
}

export function visibleTaskRows(
  tasks: readonly DenTaskSummary[],
  options: { readonly filter?: TaskStatusFilter; readonly query?: string; readonly flat?: boolean; readonly sort?: TaskSortMode } = {},
): readonly FlatTaskRow[] {
  const matches = (task: DenTaskSummary): boolean => taskMatchesStatusFilter(task, options.filter ?? null) && taskSearchMatches(task, options.query ?? '');
  const sort = options.sort ?? 'priority';
  if (options.flat) {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    return sortTaskRows(tasks, sort)
      .filter(matches)
      .map((task) => ({ task, parent: task.parent_id ? taskById.get(task.parent_id) ?? null : null, depth: 0 }));
  }

  return flattenTaskTree(sortTaskTree(filterTaskTree(buildTaskTree(tasks), matches), sort));
}

function filterTaskTree(nodes: readonly TaskNode[], matches: (task: DenTaskSummary) => boolean): readonly TaskNode[] {
  const filtered: TaskNode[] = [];
  for (const node of nodes) {
    const children = filterTaskTree(node.children, matches);
    if (matches(node.task) || children.length > 0) filtered.push({ task: node.task, children });
  }
  return filtered;
}

function compareTasks(left: DenTaskSummary, right: DenTaskSummary, mode: TaskSortMode): number {
  if (mode === 'id') return left.id - right.id;
  return taskPriority(left) - taskPriority(right) || left.id - right.id;
}

function taskPriority(task: DenTaskSummary): number {
  return task.priority ?? Number.MAX_SAFE_INTEGER;
}
