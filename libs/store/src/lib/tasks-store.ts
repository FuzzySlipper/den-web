import { computed, signal, type Signal } from '@angular/core';
import { visibleTaskRows, type FlatTaskRow, type TaskStatusFilter } from '@den-web/domain';
import type { DenResult, DenTaskDetail, DenTaskSummary } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface TasksTransportPort {
  readonly listTasks: (projectId: string, options?: { readonly limit?: number; readonly status?: string; readonly tree?: boolean }) => Promise<DenResult<readonly DenTaskSummary[]>>;
  readonly getTask: (projectId: string, taskId: number) => Promise<DenResult<DenTaskDetail>>;
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
    setFilter: (nextFilter) => filter.set(nextFilter),
    setQuery: (nextQuery) => query.set(nextQuery),
    setFlat: (nextFlat) => flat.set(nextFlat),
  };
}
