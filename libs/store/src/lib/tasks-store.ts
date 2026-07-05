import { computed, signal, type Signal } from '@angular/core';
import { visibleTaskRows, type FlatTaskRow, type TaskSortMode, type TaskStatusFilter } from '@den-web/domain';
import type { DenMessage, DenResult, DenTaskDetail, DenTaskSummary, DenTaskUpdateRequest } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

const taskUpdateAgent = 'web-ui';

export interface TasksTransportPort {
  readonly listTasks: (projectId: string, options?: { readonly limit?: number; readonly status?: string; readonly tree?: boolean }) => Promise<DenResult<readonly DenTaskSummary[]>>;
  readonly getTask: (projectId: string, taskId: number) => Promise<DenResult<DenTaskDetail>>;
  readonly updateTask: (projectId: string, taskId: number, patch: DenTaskUpdateRequest) => Promise<DenResult<DenTaskDetail | DenTaskSummary | undefined>>;
}

export interface TaskMessagesTransportPort {
  readonly listMessages: (projectId: string, options?: { readonly taskId?: number; readonly limit?: number }) => Promise<DenResult<readonly DenMessage[]>>;
}

export interface TasksStore {
  readonly tasks: Signal<AsyncState<readonly DenTaskSummary[]>>;
  readonly selectedTask: Signal<AsyncState<DenTaskDetail>>;
  readonly filter: Signal<TaskStatusFilter>;
  readonly sortMode: Signal<TaskSortMode>;
  readonly query: Signal<string>;
  readonly flat: Signal<boolean>;
  readonly rows: Signal<readonly FlatTaskRow[]>;
  readonly refresh: (projectId: string, options?: { readonly quiet?: boolean }) => Promise<void>;
  readonly selectTask: (projectId: string, taskId: number) => Promise<void>;
  readonly updateTaskStatus: (projectId: string, taskId: number, status: string) => Promise<DenResult<DenTaskDetail>>;
  readonly updateTaskDescription: (projectId: string, taskId: number, description: string) => Promise<DenResult<DenTaskDetail>>;
  readonly setFilter: (filter: TaskStatusFilter) => void;
  readonly setSortMode: (mode: TaskSortMode) => void;
  readonly setQuery: (query: string) => void;
  readonly setFlat: (flat: boolean) => void;
}

export function createTasksStore(transport: TasksTransportPort, messagesTransport: TaskMessagesTransportPort): TasksStore {
  const tasks = signal<AsyncState<readonly DenTaskSummary[]>>(idleState());
  const selectedTask = signal<AsyncState<DenTaskDetail>>(idleState());
  const filter = signal<TaskStatusFilter>('active');
  const sortMode = signal<TaskSortMode>('priority');
  const query = signal('');
  const flat = signal(false);

  return {
    tasks: tasks.asReadonly(),
    selectedTask: selectedTask.asReadonly(),
    filter: filter.asReadonly(),
    sortMode: sortMode.asReadonly(),
    query: query.asReadonly(),
    flat: flat.asReadonly(),
    rows: computed(() => visibleTaskRows(stateValue(tasks()) ?? [], { filter: filter(), query: query(), flat: flat(), sort: sortMode() })),
    refresh: async (projectId, options = {}) => {
      const previous = stateValue(tasks());
      if (!options.quiet || previous === undefined) tasks.set(loadingState(previous));
      try {
        const result = await transport.listTasks(projectId, { tree: true });
        if (options.quiet && !result.ok && previous !== undefined) return;
        tasks.set(resultState(result, previous));
        if (result.ok) reconcileSelectedTaskFromList(result.value);
      } catch (error) {
        if (options.quiet && previous !== undefined) return;
        tasks.set(errorState(unknownStoreError(error), previous));
      }
    },
    selectTask: async (projectId, taskId) => {
      const previous = stateValue(selectedTask());
      selectedTask.set(loadingState(previous));
      try {
        const [taskResult, messagesResult] = await Promise.all([
          transport.getTask(projectId, taskId),
          messagesTransport.listMessages(projectId, { taskId, limit: 20 }),
        ]);
        selectedTask.set(resultState(withTaskMessages(taskResult, messagesResult), previous));
      } catch (error) {
        selectedTask.set(errorState(unknownStoreError(error), previous));
      }
    },
    updateTaskStatus: (projectId, taskId, status) => updateTask(projectId, taskId, { status }),
    updateTaskDescription: (projectId, taskId, description) => updateTask(projectId, taskId, { description }),
    setFilter: (nextFilter) => filter.set(nextFilter),
    setSortMode: (nextMode) => sortMode.set(nextMode),
    setQuery: (nextQuery) => query.set(nextQuery),
    setFlat: (nextFlat) => flat.set(nextFlat),
  };

  async function updateTask(projectId: string, taskId: number, patch: DenTaskUpdateRequest): Promise<DenResult<DenTaskDetail>> {
    const previous = stateValue(selectedTask());
    try {
      const result = await transport.updateTask(projectId, taskId, { agent: taskUpdateAgent, ...patch });
      if (!result.ok) {
        selectedTask.set(errorState(result.error, previous));
        return result;
      }
      const detail = reconcileTaskDetail(taskId, result.value, previous, patch);
      selectedTask.set(resultState({ ok: true, value: detail }, previous));
      tasks.set(reconcileTaskList(tasks(), detail.task));
      return { ok: true, value: detail };
    } catch (error) {
      const classified = unknownStoreError(error);
      selectedTask.set(errorState(classified, previous));
      return { ok: false, error: classified };
    }
  }

  function reconcileSelectedTaskFromList(nextTasks: readonly DenTaskSummary[]): void {
    const previous = stateValue(selectedTask());
    if (!previous) return;
    const nextTask = nextTasks.find((task) => task.id === previous.task.id);
    if (!nextTask) return;
    selectedTask.set(resultState({ ok: true, value: { ...previous, task: { ...previous.task, ...nextTask } } }, previous));
  }
}

function withTaskMessages(taskResult: DenResult<DenTaskDetail>, messagesResult: DenResult<readonly DenMessage[]>): DenResult<DenTaskDetail> {
  if (!taskResult.ok) return taskResult;
  if (!messagesResult.ok) return taskResult;

  return {
    ok: true,
    value: {
      ...taskResult.value,
      recent_messages: mergeRecentMessages(taskResult.value.recent_messages ?? [], messagesResult.value),
    },
  };
}

function mergeRecentMessages(left: readonly DenMessage[], right: readonly DenMessage[]): readonly DenMessage[] {
  const byId = new Map<number, DenMessage>();
  for (const message of left) byId.set(message.id, message);
  for (const message of right) byId.set(message.id, message);
  return [...byId.values()].sort(compareRecentMessages);
}

function compareRecentMessages(left: DenMessage, right: DenMessage): number {
  const leftTime = timestamp(left.created_at);
  const rightTime = timestamp(right.created_at);
  if (leftTime !== rightTime) return rightTime - leftTime;
  return right.id - left.id;
}

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function reconcileTaskDetail(
  taskId: number,
  value: DenTaskDetail | DenTaskSummary | undefined,
  previous: DenTaskDetail | undefined,
  patch: DenTaskUpdateRequest,
): DenTaskDetail {
  if (isTaskDetail(value)) return value;

  const baseTask = previous?.task.id === taskId ? previous.task : { id: taskId };
  const task = {
    ...baseTask,
    ...(isTaskSummary(value) ? value : {}),
    ...patch,
  };
  return {
    dependencies: previous?.dependencies ?? [],
    recent_messages: previous?.recent_messages ?? [],
    subtasks: previous?.subtasks ?? [],
    task,
  };
}

function reconcileTaskList(state: AsyncState<readonly DenTaskSummary[]>, updatedTask: DenTaskSummary): AsyncState<readonly DenTaskSummary[]> {
  const previous = stateValue(state);
  if (!previous) return state;
  return resultState({
    ok: true,
    value: previous.map((task) => task.id === updatedTask.id ? { ...task, ...updatedTask } : task),
  }, previous);
}

function isTaskDetail(value: DenTaskDetail | DenTaskSummary | undefined): value is DenTaskDetail {
  return typeof value === 'object' && value !== null && 'task' in value;
}

function isTaskSummary(value: DenTaskDetail | DenTaskSummary | undefined): value is DenTaskSummary {
  return typeof value === 'object' && value !== null && 'id' in value;
}
