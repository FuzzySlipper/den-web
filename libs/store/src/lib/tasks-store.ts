import { computed, signal, type Signal } from '@angular/core';
import { visibleTaskRows, type FlatTaskRow, type TaskStatusFilter } from '@den-web/domain';
import type { DenResult, DenTaskDetail, DenTaskSummary, DenTaskUpdateRequest } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

const taskUpdateAgent = 'web-ui';

export interface TasksTransportPort {
  readonly listTasks: (projectId: string, options?: { readonly limit?: number; readonly status?: string; readonly tree?: boolean }) => Promise<DenResult<readonly DenTaskSummary[]>>;
  readonly getTask: (projectId: string, taskId: number) => Promise<DenResult<DenTaskDetail>>;
  readonly updateTask: (projectId: string, taskId: number, patch: DenTaskUpdateRequest) => Promise<DenResult<DenTaskDetail | DenTaskSummary | undefined>>;
}

export interface TasksStore {
  readonly tasks: Signal<AsyncState<readonly DenTaskSummary[]>>;
  readonly selectedTask: Signal<AsyncState<DenTaskDetail>>;
  readonly filter: Signal<TaskStatusFilter>;
  readonly query: Signal<string>;
  readonly flat: Signal<boolean>;
  readonly rows: Signal<readonly FlatTaskRow[]>;
  readonly refresh: (projectId: string) => Promise<void>;
  readonly selectTask: (projectId: string, taskId: number) => Promise<void>;
  readonly updateTaskStatus: (projectId: string, taskId: number, status: string) => Promise<DenResult<DenTaskDetail>>;
  readonly updateTaskDescription: (projectId: string, taskId: number, description: string) => Promise<DenResult<DenTaskDetail>>;
  readonly setFilter: (filter: TaskStatusFilter) => void;
  readonly setQuery: (query: string) => void;
  readonly setFlat: (flat: boolean) => void;
}

export function createTasksStore(transport: TasksTransportPort): TasksStore {
  const tasks = signal<AsyncState<readonly DenTaskSummary[]>>(idleState());
  const selectedTask = signal<AsyncState<DenTaskDetail>>(idleState());
  const filter = signal<TaskStatusFilter>('active');
  const query = signal('');
  const flat = signal(false);

  return {
    tasks: tasks.asReadonly(),
    selectedTask: selectedTask.asReadonly(),
    filter: filter.asReadonly(),
    query: query.asReadonly(),
    flat: flat.asReadonly(),
    rows: computed(() => visibleTaskRows(stateValue(tasks()) ?? [], { filter: filter(), query: query(), flat: flat() })),
    refresh: async (projectId) => {
      const previous = stateValue(tasks());
      tasks.set(loadingState(previous));
      try {
        const result = await transport.listTasks(projectId, { tree: true });
        tasks.set(resultState(result, previous));
      } catch (error) {
        tasks.set(errorState(unknownStoreError(error), previous));
      }
    },
    selectTask: async (projectId, taskId) => {
      const previous = stateValue(selectedTask());
      selectedTask.set(loadingState(previous));
      try {
        selectedTask.set(resultState(await transport.getTask(projectId, taskId), previous));
      } catch (error) {
        selectedTask.set(errorState(unknownStoreError(error), previous));
      }
    },
    updateTaskStatus: (projectId, taskId, status) => updateTask(projectId, taskId, { status }),
    updateTaskDescription: (projectId, taskId, description) => updateTask(projectId, taskId, { description }),
    setFilter: (nextFilter) => filter.set(nextFilter),
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
