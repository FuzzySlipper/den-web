import { computed, signal, type Signal } from '@angular/core';
import { visibleTaskRows, type FlatTaskRow, type TaskSortMode, type TaskStatusFilter } from '@den-web/domain';
import type {
  DenMessage,
  DenManualReviewCapability,
  DenManualReviewReceipt,
  DenRecordHumanAcceptanceRequest,
  DenRecordHumanAcceptanceResponse,
  DenResult,
  DenTaskDetail,
  DenTaskSummary,
  DenTaskUpdateRequest,
} from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

const taskUpdateAgent = 'web-ui';

interface TaskSelection {
  readonly projectId: string;
  readonly taskId: number;
  readonly generation: number;
}

/** The messages service caps task message lists at 100 per request. */
export const taskMessagesFetchLimit = 100;

export interface TasksTransportPort {
  readonly listTasks: (projectId: string, options?: { readonly limit?: number; readonly status?: string; readonly tree?: boolean }) => Promise<DenResult<readonly DenTaskSummary[]>>;
  readonly getTask: (projectId: string, taskId: number) => Promise<DenResult<DenTaskDetail>>;
  readonly updateTask: (projectId: string, taskId: number, patch: DenTaskUpdateRequest) => Promise<DenResult<DenTaskDetail | DenTaskSummary | undefined>>;
  readonly recordHumanAcceptance: (projectId: string, taskId: number, request: DenRecordHumanAcceptanceRequest) => Promise<DenResult<DenRecordHumanAcceptanceResponse>>;
  readonly getManualReviewCapability?: (projectId: string, taskId: number) => Promise<DenResult<DenManualReviewCapability>>;
  readonly submitManualReview?: (projectId: string, taskId: number, idempotencyKey: string) => Promise<DenResult<DenManualReviewReceipt>>;
}

export interface TaskMessagesTransportPort {
  readonly listMessages: (projectId: string, options?: { readonly taskId?: number; readonly limit?: number }) => Promise<DenResult<readonly DenMessage[]>>;
}

export interface TasksStore {
  readonly tasks: Signal<AsyncState<readonly DenTaskSummary[]>>;
  readonly selectedTask: Signal<AsyncState<DenTaskDetail>>;
  readonly humanAcceptanceResult: Signal<AsyncState<DenRecordHumanAcceptanceResponse>>;
  readonly manualReviewCapability: Signal<AsyncState<DenManualReviewCapability>>;
  readonly manualReviewResult: Signal<AsyncState<DenManualReviewReceipt>>;
  readonly filter: Signal<TaskStatusFilter>;
  readonly sortMode: Signal<TaskSortMode>;
  readonly query: Signal<string>;
  readonly flat: Signal<boolean>;
  readonly rows: Signal<readonly FlatTaskRow[]>;
  readonly refresh: (projectId: string, options?: { readonly quiet?: boolean }) => Promise<void>;
  readonly selectTask: (projectId: string, taskId: number) => Promise<void>;
  readonly updateTaskStatus: (projectId: string, taskId: number, status: string) => Promise<DenResult<DenTaskDetail>>;
  readonly updateTaskDescription: (projectId: string, taskId: number, description: string) => Promise<DenResult<DenTaskDetail>>;
  readonly recordHumanAcceptance: (projectId: string, taskId: number, request: DenRecordHumanAcceptanceRequest) => Promise<DenResult<DenRecordHumanAcceptanceResponse>>;
  readonly submitManualReview: (projectId: string, taskId: number, idempotencyKey: string) => Promise<DenResult<DenManualReviewReceipt>>;
  readonly refreshManualReviewCapability: (projectId: string, taskId: number) => Promise<void>;
  readonly clearHumanAcceptanceResult: () => void;
  readonly clearManualReviewResult: () => void;
  readonly setFilter: (filter: TaskStatusFilter) => void;
  readonly setSortMode: (mode: TaskSortMode) => void;
  readonly setQuery: (query: string) => void;
  readonly setFlat: (flat: boolean) => void;
}

export function createTasksStore(transport: TasksTransportPort, messagesTransport: TaskMessagesTransportPort): TasksStore {
  const tasks = signal<AsyncState<readonly DenTaskSummary[]>>(idleState());
  const selectedTask = signal<AsyncState<DenTaskDetail>>(idleState());
  const humanAcceptanceResult = signal<AsyncState<DenRecordHumanAcceptanceResponse>>(idleState());
  const manualReviewCapability = signal<AsyncState<DenManualReviewCapability>>(idleState());
  const manualReviewResult = signal<AsyncState<DenManualReviewReceipt>>(idleState());
  const manualReviewRequests = new Map<string, Promise<DenResult<DenManualReviewReceipt>>>();
  let selectionGeneration = 0;
  let manualReviewGeneration = 0;
  let currentSelection: TaskSelection | null = null;
  let taskListGeneration = 0;
  let currentTaskListProjectId: string | null = null;
  const filter = signal<TaskStatusFilter>('active');
  const sortMode = signal<TaskSortMode>('id');
  const query = signal('');
  const flat = signal(false);

  return {
    tasks: tasks.asReadonly(),
    selectedTask: selectedTask.asReadonly(),
    humanAcceptanceResult: humanAcceptanceResult.asReadonly(),
    manualReviewCapability: manualReviewCapability.asReadonly(),
    manualReviewResult: manualReviewResult.asReadonly(),
    filter: filter.asReadonly(),
    sortMode: sortMode.asReadonly(),
    query: query.asReadonly(),
    flat: flat.asReadonly(),
    rows: computed(() => visibleTaskRows(stateValue(tasks()) ?? [], { filter: filter(), query: query(), flat: flat(), sort: sortMode() })),
    refresh: async (projectId, options = {}) => {
      const refreshGeneration = ++taskListGeneration;
      currentTaskListProjectId = projectId;
      const previous = stateValue(tasks());
      if (!options.quiet || previous === undefined) tasks.set(loadingState(previous));
      try {
        const result = await transport.listTasks(projectId, { tree: true });
        if (!isCurrentTaskList(projectId, refreshGeneration)) return;
        if (options.quiet && !result.ok && previous !== undefined) return;
        tasks.set(resultState(result, previous));
        if (result.ok) reconcileSelectedTaskFromList(result.value, projectId);
      } catch (error) {
        if (!isCurrentTaskList(projectId, refreshGeneration)) return;
        if (options.quiet && previous !== undefined) return;
        tasks.set(errorState(unknownStoreError(error), previous));
      }
    },
    selectTask: async (projectId, taskId) => {
      const generation = ++selectionGeneration;
      const reviewGeneration = ++manualReviewGeneration;
      currentSelection = { projectId, taskId, generation };
      const previous = stateValue(selectedTask());
      selectedTask.set(loadingState(previous));
      manualReviewCapability.set(idleState());
      manualReviewResult.set(idleState());
      try {
        const [taskResult, messagesResult] = await Promise.all([
          transport.getTask(projectId, taskId),
          messagesTransport.listMessages(projectId, { taskId, limit: taskMessagesFetchLimit }),
        ]);
        const detailResult = withTaskMessages(taskResult, messagesResult);
        if (!isCurrentSelection(projectId, taskId, generation)) return;
        selectedTask.set(resultState(detailResult, previous));
        await loadManualReviewCapability(projectId, taskId, detailResult, generation, reviewGeneration);
      } catch (error) {
        if (!isCurrentSelection(projectId, taskId, generation)) return;
        selectedTask.set(errorState(unknownStoreError(error), previous));
        manualReviewCapability.set(idleState());
      }
    },
    updateTaskStatus: (projectId, taskId, status) => updateTask(projectId, taskId, { status }),
    updateTaskDescription: (projectId, taskId, description) => updateTask(projectId, taskId, { description }),
    recordHumanAcceptance: async (projectId, taskId, request) => {
      const generation = selectionGeneration;
      const previous = stateValue(humanAcceptanceResult());
      humanAcceptanceResult.set(loadingState(previous));
      try {
        const result = await transport.recordHumanAcceptance(projectId, taskId, request);
        if (!isCurrentSelection(projectId, taskId, generation)) return result;
        humanAcceptanceResult.set(resultState(result, previous));
        if (!result.ok) return result;
        tasks.set(reconcileTaskList(tasks(), result.value.task));
        await refreshSelectedTask(projectId, taskId, generation);
        return result;
      } catch (error) {
        const classified = unknownStoreError(error);
        if (!isCurrentSelection(projectId, taskId, generation)) return { ok: false, error: classified };
        humanAcceptanceResult.set(errorState(classified, previous));
        return { ok: false, error: classified };
      }
    },
    submitManualReview: (projectId, taskId, idempotencyKey) => submitManualReview(projectId, taskId, idempotencyKey),
    refreshManualReviewCapability: (projectId, taskId) => refreshManualReviewCapability(projectId, taskId),
    clearHumanAcceptanceResult: () => humanAcceptanceResult.set(idleState()),
    clearManualReviewResult: () => manualReviewResult.set(idleState()),
    setFilter: (nextFilter) => filter.set(nextFilter),
    setSortMode: (nextMode) => sortMode.set(nextMode),
    setQuery: (nextQuery) => query.set(nextQuery),
    setFlat: (nextFlat) => flat.set(nextFlat),
  };

  async function updateTask(projectId: string, taskId: number, patch: DenTaskUpdateRequest): Promise<DenResult<DenTaskDetail>> {
    const generation = selectionGeneration;
    const previous = stateValue(selectedTask());
    try {
      const result = await transport.updateTask(projectId, taskId, { agent: taskUpdateAgent, ...patch });
      if (!isCurrentSelection(projectId, taskId, generation)) return result.ok
        ? { ok: true, value: reconcileTaskDetail(taskId, result.value, previous, patch) }
        : result;
      if (!result.ok) {
        selectedTask.set(errorState(result.error, previous));
        return result;
      }
      const detail = reconcileTaskDetail(taskId, result.value, previous, patch);
      const previousTask = previous?.task.id === taskId ? previous.task : undefined;
      const reviewGeneration = previousTask && manualReviewTaskStateChanged(previousTask, detail.task)
        ? invalidateManualReviewState()
        : manualReviewGeneration;
      selectedTask.set(resultState({ ok: true, value: detail }, previous));
      tasks.set(reconcileTaskList(tasks(), detail.task));
      await loadManualReviewCapability(projectId, taskId, { ok: true, value: detail }, generation, reviewGeneration);
      return { ok: true, value: detail };
    } catch (error) {
      const classified = unknownStoreError(error);
      if (!isCurrentSelection(projectId, taskId, generation)) return { ok: false, error: classified };
      selectedTask.set(errorState(classified, previous));
      return { ok: false, error: classified };
    }
  }

  function submitManualReview(
    projectId: string,
    taskId: number,
    idempotencyKey: string,
  ): Promise<DenResult<DenManualReviewReceipt>> {
    const requestKey = `${projectId}:${taskId}:${idempotencyKey}`;
    const inFlightRequest = manualReviewRequests.get(requestKey);
    if (inFlightRequest) return inFlightRequest;

    const generation = selectionGeneration;
    const reviewGeneration = manualReviewGeneration;
    const request = submitManualReviewRequest(projectId, taskId, idempotencyKey, generation, reviewGeneration);
    manualReviewRequests.set(requestKey, request);
    void request.finally(() => {
      if (manualReviewRequests.get(requestKey) === request) manualReviewRequests.delete(requestKey);
    });
    return request;
  }

  async function submitManualReviewRequest(
    projectId: string,
    taskId: number,
    idempotencyKey: string,
    generation: number,
    reviewGeneration: number,
  ): Promise<DenResult<DenManualReviewReceipt>> {
    const previous = stateValue(manualReviewResult());
    if (isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) manualReviewResult.set(loadingState(previous));
    try {
      if (!transport.submitManualReview) {
        const unavailable = unknownStoreError(new Error('Manual review submission transport is unavailable.'));
        if (isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) manualReviewResult.set(errorState(unavailable, previous));
        return { ok: false, error: unavailable };
      }
      const result = await transport.submitManualReview(projectId, taskId, idempotencyKey);
      if (!isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) return result;
      manualReviewResult.set(resultState(result, previous));
      if (result.ok) await refreshSelectedTask(projectId, taskId, generation);
      return result;
    } catch (error) {
      const classified = unknownStoreError(error);
      if (isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) manualReviewResult.set(errorState(classified, previous));
      return { ok: false, error: classified };
    }
  }

  function reconcileSelectedTaskFromList(nextTasks: readonly DenTaskSummary[], projectId: string): void {
    if (currentSelection?.projectId !== projectId) return;
    const previous = stateValue(selectedTask());
    if (!previous) return;
    if (currentSelection.taskId !== previous.task.id) return;
    const nextTask = nextTasks.find((task) => task.id === previous.task.id);
    if (!nextTask) return;
    const task = { ...previous.task, ...nextTask };
    const detail = { ...previous, task };
    const relevantSummaryChanged = manualReviewTaskStateChanged(previous.task, task);
    if (relevantSummaryChanged) {
      const reviewGeneration = invalidateManualReviewState();
      selectedTask.set(resultState({ ok: true, value: detail }, previous));
      if (task.status === 'review') {
        void loadManualReviewCapability(projectId, task.id, { ok: true, value: detail }, currentSelection.generation, reviewGeneration);
      }
      return;
    }
    selectedTask.set(resultState({ ok: true, value: detail }, previous));
  }

  async function refreshSelectedTask(projectId: string, taskId: number, generation: number): Promise<void> {
    if (!isCurrentSelection(projectId, taskId, generation)) return;
    const previous = stateValue(selectedTask());
    try {
      const [taskResult, messagesResult] = await Promise.all([
        transport.getTask(projectId, taskId),
        messagesTransport.listMessages(projectId, { taskId, limit: taskMessagesFetchLimit }),
      ]);
      const detailResult = withTaskMessages(taskResult, messagesResult);
      if (!isCurrentSelection(projectId, taskId, generation)) return;
      selectedTask.set(resultState(detailResult, previous));
      await loadManualReviewCapability(projectId, taskId, detailResult, generation, manualReviewGeneration);
    } catch (error) {
      if (isCurrentSelection(projectId, taskId, generation)) selectedTask.set(errorState(unknownStoreError(error), previous));
    }
  }

  function refreshManualReviewCapability(projectId: string, taskId: number): Promise<void> {
    const selection = currentSelection;
    if (!selection || selection.projectId !== projectId || selection.taskId !== taskId) return Promise.resolve();
    const detail = stateValue(selectedTask());
    if (!detail) return Promise.resolve();
    return loadManualReviewCapability(projectId, taskId, { ok: true, value: detail }, selection.generation, manualReviewGeneration);
  }

  async function loadManualReviewCapability(
    projectId: string,
    taskId: number,
    detailResult: DenResult<DenTaskDetail>,
    generation: number,
    reviewGeneration: number,
  ): Promise<void> {
    if (!isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) return;
    if (!detailResult.ok || detailResult.value.task.status !== 'review') {
      manualReviewCapability.set(idleState());
      return;
    }

    const previous = stateValue(manualReviewCapability());
    manualReviewCapability.set(loadingState(previous));
    try {
      if (!transport.getManualReviewCapability) {
        if (isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) {
          manualReviewCapability.set(errorState(
            unknownStoreError(new Error('Manual review capability transport is unavailable.')),
            previous,
          ));
        }
        return;
      }
      const result = await transport.getManualReviewCapability(projectId, taskId);
      if (!isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) return;
      manualReviewCapability.set(resultState(result, previous));
    } catch (error) {
      if (isCurrentManualReview(projectId, taskId, generation, reviewGeneration)) manualReviewCapability.set(errorState(unknownStoreError(error), previous));
    }
  }

  function isCurrentManualReview(projectId: string, taskId: number, generation: number, reviewGeneration: number): boolean {
    return isCurrentSelection(projectId, taskId, generation) && manualReviewGeneration === reviewGeneration;
  }

  function invalidateManualReviewState(): number {
    const reviewGeneration = ++manualReviewGeneration;
    manualReviewCapability.set(idleState());
    manualReviewResult.set(idleState());
    return reviewGeneration;
  }

  function isCurrentSelection(projectId: string, taskId: number, generation: number): boolean {
    return currentSelection?.projectId === projectId
      && currentSelection.taskId === taskId
      && currentSelection.generation === generation;
  }

  function isCurrentTaskList(projectId: string, generation: number): boolean {
    return currentTaskListProjectId === projectId && taskListGeneration === generation;
  }
}

function manualReviewTaskStateChanged(previous: DenTaskSummary, next: DenTaskSummary): boolean {
  return previous.status !== next.status
    || previous.description !== next.description
    || previous.updated_at !== next.updated_at;
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
    human_acceptance_reviews: previous?.human_acceptance_reviews ?? [],
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
