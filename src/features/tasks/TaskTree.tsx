import { useState, useMemo, useCallback } from 'react';
import type { TaskSummary } from '../../api/types';
import { isDependencyWaitingTask, taskAvailabilityLabel, taskAvailabilityTitle, taskStatusIcon } from './taskAvailability';
import { taskMatchesStatusFilter } from './taskStatuses';

export interface TaskNode {
  task: TaskSummary;
  children: TaskNode[];
}

interface Props {
  tasks: TaskSummary[];
  selectedTaskId: number | null;
  onSelect: (taskId: number, projectId?: string | null) => void;
  statusFilter: string | null;
  sortMode: string;
  showProjectLabels?: boolean;
  projectNames?: Map<string, string>;
}

function buildTree(tasks: TaskSummary[]): TaskNode[] {
  const map = new Map<number, TaskNode>();
  const roots: TaskNode[] = [];

  for (const task of tasks) {
    map.set(task.id, { task, children: [] });
  }

  for (const task of tasks) {
    const node = map.get(task.id)!;
    if (task.parent_id && map.has(task.parent_id)) {
      map.get(task.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function sortNodes(nodes: TaskNode[], mode: string): TaskNode[] {
  const sorted = [...nodes];
  switch (mode) {
    case 'id':
      sorted.sort((a, b) => a.task.id - b.task.id);
      break;
    case 'status':
      sorted.sort((a, b) => statusOrder(a.task) - statusOrder(b.task)
        || a.task.priority - b.task.priority
        || a.task.id - b.task.id);
      break;
    case 'title':
      sorted.sort((a, b) => a.task.title.localeCompare(b.task.title));
      break;
    default: // priority
      sorted.sort((a, b) => a.task.priority - b.task.priority || a.task.id - b.task.id);
  }
  for (const node of sorted) {
    node.children = sortNodes(node.children, mode);
  }
  return sorted;
}

const STATUS_ORDER: Record<string, number> = {
  planned: 0, in_progress: 1, review: 2, blocked: 3, done: 4, cancelled: 5,
};

function statusOrder(task: Pick<TaskSummary, 'status' | 'availability' | 'unfinished_dependency_count'>): number {
  if (isDependencyWaitingTask(task)) return 0.5;
  return STATUS_ORDER[task.status] ?? 99;
}

function priorityLabel(p: number): string {
  if (p === 1) return '!!';
  if (p === 2) return '! ';
  return '  ';
}

export function TaskTree({ tasks, selectedTaskId, onSelect, statusFilter, sortMode, showProjectLabels = false, projectNames }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filtered = useMemo(
    () => tasks.filter(task => taskMatchesStatusFilter(task, statusFilter)),
    [tasks, statusFilter],
  );

  const tree = useMemo(() => sortNodes(buildTree(filtered), sortMode), [filtered, sortMode]);

  const toggleExpand = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderNode = (node: TaskNode, depth: number): React.ReactNode => {
    const { task } = node;
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(task.id);
    const waitingOnDependencies = isDependencyWaitingTask(task);
    const si = taskStatusIcon(task.status, waitingOnDependencies);
    const projectLabel = projectNames?.get(task.project_id) ?? task.project_id;
    const availabilityLabel = taskAvailabilityLabel(task);
    const availabilityTitle = taskAvailabilityTitle(task);

    return (
      <div key={task.id}>
        <div
          className={`tree-node${task.id === selectedTaskId ? ' selected' : ''}`}
          style={{ paddingLeft: `${10 + depth * 16}px` }}
          onClick={() => onSelect(task.id, task.project_id)}
          title={showProjectLabels ? `${projectLabel} · #${task.id} ${task.title} · ${availabilityLabel}` : availabilityTitle}
        >
          {hasChildren ? (
            <span className="tree-toggle" onClick={(e) => toggleExpand(task.id, e)}>
              {isExpanded ? '▾' : '▸'}
            </span>
          ) : (
            <span className="tree-toggle" />
          )}
          <span className={`tree-status-icon ${si.cls}`} title={availabilityTitle}>{si.icon}</span>
          <span className={`priority-${task.priority}`}>{priorityLabel(task.priority)}</span>
          <span className="tree-id">#{task.id}</span>
          {showProjectLabels && (
            <span className="tree-project" title={task.project_id}>{projectLabel}</span>
          )}
          <span className={`tree-title${task.status === 'cancelled' ? ' status-cancelled' : ''}`}>
            {task.title}
          </span>
          {waitingOnDependencies && (
            <span className="tree-availability-pill tree-availability-waiting" title={availabilityTitle}>deps wait</span>
          )}
          {task.status === 'blocked' && (
            <span className="tree-availability-pill tree-availability-blocked" title={availabilityTitle}>manual block</span>
          )}
          {task.subtask_count > 0 && !isExpanded && (
            <span className="tree-subtask-count">(+{task.subtask_count})</span>
          )}
        </div>
        {isExpanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (tree.length === 0) {
    return <div className="empty">No tasks</div>;
  }

  return <>{tree.map(node => renderNode(node, 0))}</>;
}
