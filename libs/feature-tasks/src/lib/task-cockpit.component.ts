import { Component, computed, effect, inject, signal } from '@angular/core';
import { MarkdownEditorDialogComponent } from '@den-web/components';
import type { TaskStatusFilter } from '@den-web/domain';
import type { DenMessage, DenTaskDetail, DenTaskSummary } from '@den-web/protocol';
import { stateValue, TASKS_STORE, WORKSPACE_STORE } from '@den-web/store';

interface FilterOption {
  readonly value: string;
  readonly filter: TaskStatusFilter;
  readonly label: string;
}

type MobilePane = 'list' | 'detail';

const filterOptions: readonly FilterOption[] = [
  { value: 'active', filter: 'active', label: 'Active' },
  { value: '__all', filter: null, label: 'All' },
  { value: 'planned', filter: 'planned', label: 'Planned' },
  { value: 'in_progress', filter: 'in_progress', label: 'In Progress' },
  { value: 'review', filter: 'review', label: 'Review' },
  { value: 'blocked', filter: 'blocked', label: 'Blocked' },
  { value: 'waiting_on_dependencies', filter: 'waiting_on_dependencies', label: 'Waiting' },
  { value: 'done', filter: 'done', label: 'Done' },
];

const editableStatuses: readonly string[] = ['planned', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];

@Component({
  selector: 'den-task-cockpit',
  standalone: true,
  imports: [MarkdownEditorDialogComponent],
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .task-cockpit {
        display: grid;
        grid-template-columns: minmax(320px, 0.9fr) minmax(380px, 1.2fr);
        min-height: 100%;
      }

      .task-list,
      .task-detail {
        min-width: 0;
      }

      .task-list {
        border-right: 1px solid var(--den-border);
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
      }

      header {
        border-bottom: 1px solid var(--den-border);
        padding: 18px 20px;
      }

      h2,
      h3 {
        margin: 0;
      }

      h2 {
        font-size: var(--den-font-size-xl);
        line-height: var(--den-line-height-tight);
      }

      h3 {
        font-size: var(--den-font-size-lg);
        line-height: var(--den-line-height-snug);
      }

      .subtle,
      .meta,
      .state {
        color: var(--den-muted);
        font-size: var(--den-font-size-md);
      }

      .toolbar {
        align-items: center;
        border-bottom: 1px solid var(--den-border);
        display: grid;
        gap: 10px;
        grid-template-columns: 1fr auto auto;
        padding: 12px;
      }

      input,
      select {
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        box-sizing: border-box;
        color: var(--den-text);
        font: inherit;
        min-height: 36px;
        min-width: 0;
        padding: 0 10px;
      }

      label {
        align-items: center;
        color: var(--den-muted);
        display: inline-flex;
        font-size: var(--den-font-size-md);
        gap: 7px;
        white-space: nowrap;
      }

      .rows {
        overflow: auto;
        padding: 8px;
      }

      .row {
        appearance: none;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        color: var(--den-text);
        cursor: pointer;
        display: grid;
        margin: 0;
        min-height: 42px;
        padding: 7px 10px;
        text-align: left;
        width: 100%;
      }

      .row:hover,
      .row:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      .row[aria-pressed='true'] {
        background: var(--den-selected);
        border-color: var(--den-accent);
      }

      .row-title {
        align-items: center;
        display: flex;
        gap: 8px;
        min-width: 0;
      }

      .row-title strong {
        font-size: var(--den-font-size-sm);
        line-height: var(--den-line-height-snug);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .badge {
        border: 1px solid var(--den-border);
        border-radius: 999px;
        color: var(--den-muted);
        flex: 0 0 auto;
        font-size: var(--den-font-size-xs);
        padding: 2px 7px;
      }

      .waiting {
        border-color: var(--den-warning-border);
        color: var(--den-warning);
      }

      .detail-body {
        display: grid;
        gap: 18px;
        overflow: auto;
        padding: 20px;
      }

      .detail-head {
        display: grid;
        gap: 8px;
      }

      .detail-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }

      .metric,
      .section {
        border: 1px solid var(--den-border);
        border-radius: 8px;
        padding: 12px;
      }

      .metric span,
      .section-title {
        color: var(--den-muted);
        display: block;
        font-size: var(--den-font-size-xs);
        font-weight: 700;
        margin-bottom: 6px;
        text-transform: uppercase;
      }

      .metric strong {
        display: block;
        font-size: var(--den-font-size-base);
      }

      .status-control { width: 100%; }

      .section-head {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .section-head .section-title {
        margin: 0;
      }

      .edit-button {
        appearance: none;
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        color: var(--den-text);
        cursor: pointer;
        font: inherit;
        min-height: 30px;
        padding: 0 10px;
      }

      .edit-button:hover,
      .edit-button:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      .description-body { margin: 0; white-space: pre-wrap; }

      .section ul {
        display: grid;
        gap: 8px;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .section li {
        color: var(--den-text);
        font-size: var(--den-font-size-md);
      }

      .error {
        color: var(--den-danger);
      }

      .mobile-back {
        display: none;
      }

      @media (max-width: 920px) {
        .task-cockpit {
          grid-template-columns: 1fr;
          min-height: calc(100vh - 250px);
        }

        .task-list {
          border-right: 0;
          min-height: calc(100vh - 250px);
        }

        .task-detail {
          display: none;
          min-height: calc(100vh - 250px);
        }

        .task-cockpit.show-detail .task-list {
          display: none;
        }

        .task-cockpit.show-detail .task-detail {
          display: block;
        }

        .toolbar {
          grid-template-columns: 1fr;
        }

        header {
          padding: 14px;
        }

        .detail-body {
          padding: 14px;
        }

        .mobile-back {
          appearance: none;
          background: var(--den-input);
          border: 1px solid var(--den-border);
          border-radius: 6px;
          color: var(--den-text);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
          width: max-content;
        }

        .mobile-back:hover,
        .mobile-back:focus-visible {
          background: var(--den-hover);
          border-color: var(--den-border-strong);
          outline: none;
        }
      }
    `,
  ],
  template: `
    <section class="task-cockpit" aria-label="Tasks" [class.show-detail]="mobilePane() === 'detail'">
      <div class="task-list">
        <header>
          <h2>Tasks</h2>
          <div class="subtle">{{ selectedProjectId() || 'Select a project' }}</div>
        </header>

        <div class="toolbar" aria-label="Task controls">
          <input
            type="search"
            aria-label="Search tasks"
            placeholder="Search tasks"
            [value]="query()"
            (input)="setQuery($event)"
          />
          <select aria-label="Task status filter" [value]="filterValue()" (change)="setFilter($event)">
            @for (option of filters; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
          <label>
            <input type="checkbox" [checked]="flat()" (change)="setFlat($event)" />
            Flat
          </label>
        </div>

        <div class="rows">
          @if (!selectedProjectId()) {
            <p class="state">No project selected</p>
          } @else {
            @switch (tasks().kind) {
              @case ('idle') {
                <p class="state">Ready</p>
              }
              @case ('loading') {
                <p class="state">Loading tasks</p>
              }
              @case ('error') {
                <p class="state error">{{ errorText(tasksError()) }}</p>
              }
              @case ('data') {
                @if (rows().length === 0) {
                  <p class="state">No matching tasks</p>
                } @else {
                  @for (row of rows(); track row.task.id) {
                    <button
                      type="button"
                      class="row"
                      [style.padding-left.px]="12 + row.depth * 18"
                      [attr.aria-pressed]="row.task.id === selectedTaskId()"
                      (click)="selectTask(row.task)"
                    >
                      <span class="row-title">
                        <span class="badge">#{{ row.task.id }}</span>
                        <strong>{{ row.task.title || 'Untitled task' }}</strong>
                      </span>
                    </button>
                  }
                }
              }
            }
          }
        </div>
      </div>

      <article class="task-detail" aria-label="Task detail">
        @switch (selectedTask().kind) {
          @case ('idle') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showTaskList()">Back to tasks</button>
              <p class="state">Select a task</p>
            </div>
          }
          @case ('loading') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showTaskList()">Back to tasks</button>
              <p class="state">Loading task detail</p>
            </div>
          }
          @case ('error') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showTaskList()">Back to tasks</button>
              <p class="state error">{{ errorText(selectedTaskError()) }}</p>
            </div>
          }
          @case ('data') {
            @let detail = selectedTaskDetail();
            @if (detail) {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showTaskList()">Back to tasks</button>
              <div class="detail-head">
                <h3>#{{ detail.task.id }} {{ detail.task.title || 'Untitled task' }}</h3>
                <div class="meta">{{ detail.task.project_id || selectedProjectId() }}</div>
              </div>

              <div class="detail-grid">
                <div class="metric">
                  <span>Status</span>
                  <select
                    class="status-control"
                    aria-label="Task status"
                    [value]="detail.task.status || ''"
                    (change)="changeStatus($event, detail)"
                  >
                    @if (!detail.task.status) {
                      <option value="">unknown</option>
                    }
                    @for (status of statuses; track status) {
                      <option [value]="status">{{ statusLabel(status) }}</option>
                    }
                  </select>
                </div>
                <div class="metric">
                  <span>Assignee</span>
                  <strong>{{ detail.task.assigned_to || 'unassigned' }}</strong>
                </div>
                <div class="metric">
                  <span>Priority</span>
                  <strong>{{ detail.task.priority ?? 'none' }}</strong>
                </div>
              </div>

              @if (editError()) {
                <p class="state error">{{ editError() }}</p>
              }

              <section class="section" aria-label="Description">
                <div class="section-head">
                  <span class="section-title">Description</span>
                  <button type="button" class="edit-button" (click)="openDescriptionEditor(detail)">Edit</button>
                </div>
                @if (detail.task.description) {
                  <p class="meta description-body">{{ detail.task.description }}</p>
                } @else {
                  <p class="state">No description</p>
                }
              </section>

              <section class="section" aria-label="Dependencies">
                <span class="section-title">Dependencies</span>
                @if ((detail.dependencies ?? []).length === 0) {
                  <p class="state">No dependencies</p>
                } @else {
                  <ul>
                    @for (dependency of detail.dependencies; track dependency.id) {
                      <li>#{{ dependency.id }} {{ dependency.title || 'Untitled task' }} · {{ dependency.status || 'unknown' }}</li>
                    }
                  </ul>
                }
              </section>

              <section class="section" aria-label="Subtasks">
                <span class="section-title">Subtasks</span>
                @if ((detail.subtasks ?? []).length === 0) {
                  <p class="state">No subtasks</p>
                } @else {
                  <ul>
                    @for (subtask of detail.subtasks; track subtask.id) {
                      <li>#{{ subtask.id }} {{ subtask.title || 'Untitled task' }} · {{ subtask.status || 'unknown' }}</li>
                    }
                  </ul>
                }
              </section>

              <section class="section" aria-label="Recent messages">
                <span class="section-title">Recent messages</span>
                @if ((detail.recent_messages ?? []).length === 0) {
                  <p class="state">No recent messages</p>
                } @else {
                  <ul>
                    @for (message of detail.recent_messages; track message.id) {
                      <li>{{ messageLine(message) }}</li>
                    }
                  </ul>
                }
              </section>
            </div>
            }
          }
        }
      </article>

      <den-markdown-editor-dialog
        title="Edit Description"
        [open]="descriptionEditorOpen()"
        [value]="descriptionDraft()"
        (cancel)="closeDescriptionEditor()"
        (done)="saveDescription($event)"
      />
    </section>
  `,
})
export class TaskCockpitComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly taskStore = inject(TASKS_STORE);
  private loadedProjectId: string | null = null;

  protected readonly filters = filterOptions;
  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly tasks = this.taskStore.tasks;
  protected readonly selectedTask = this.taskStore.selectedTask;
  protected readonly rows = this.taskStore.rows;
  protected readonly query = this.taskStore.query;
  protected readonly flat = this.taskStore.flat;
  protected readonly statuses = editableStatuses;
  protected readonly descriptionEditorOpen = signal(false);
  protected readonly descriptionDraft = signal('');
  protected readonly editError = signal<string | null>(null);
  protected readonly mobilePane = signal<MobilePane>('list');
  protected readonly tasksError = computed(() => {
    const state = this.tasks();
    return state.kind === 'error' ? state.error : null;
  });
  protected readonly selectedTaskError = computed(() => {
    const state = this.selectedTask();
    return state.kind === 'error' ? state.error : null;
  });
  protected readonly selectedTaskDetail = computed(() => stateValue(this.selectedTask()) ?? null);
  protected readonly selectedTaskId = computed(() => stateValue(this.selectedTask())?.task.id ?? null);
  protected readonly filterValue = computed(() => this.filters.find((option) => option.filter === this.taskStore.filter())?.value ?? 'active');

  private readonly projectRefreshEffect = effect(() => {
    const projectId = this.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    this.mobilePane.set('list');
    queueMicrotask(() => void this.taskStore.refresh(projectId));
  });

  private readonly autoSelectEffect = effect(() => {
    const projectId = this.selectedProjectId();
    const firstTaskId = this.rows()[0]?.task.id;
    if (!projectId || firstTaskId === undefined || this.selectedTaskId() !== null) return;
    queueMicrotask(() => void this.taskStore.selectTask(projectId, firstTaskId));
  });

  protected setQuery(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.taskStore.setQuery(target.value);
  }

  protected setFilter(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.taskStore.setFilter(this.filters.find((option) => option.value === target.value)?.filter ?? 'active');
  }

  protected setFlat(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.taskStore.setFlat(target.checked);
  }

  protected selectTask(task: DenTaskSummary): void {
    const projectId = task.project_id ?? this.selectedProjectId();
    if (projectId) void this.taskStore.selectTask(projectId, task.id);
    this.mobilePane.set('detail');
  }

  protected showTaskList(): void {
    this.mobilePane.set('list');
  }

  protected changeStatus(event: Event, detail: DenTaskDetail): void {
    const target = event.target;
    const projectId = detail.task.project_id ?? this.selectedProjectId();
    if (!(target instanceof HTMLSelectElement) || !projectId || !target.value || target.value === detail.task.status) return;
    void this.taskStore.updateTaskStatus(projectId, detail.task.id, target.value).then((result) => {
      this.editError.set(result.ok ? null : this.errorText(result.error));
    });
  }

  protected openDescriptionEditor(detail: DenTaskDetail): void {
    this.descriptionDraft.set(detail.task.description ?? '');
    this.descriptionEditorOpen.set(true);
  }

  protected closeDescriptionEditor(): void {
    this.descriptionEditorOpen.set(false);
  }

  protected saveDescription(description: string): void {
    const detail = this.selectedTaskDetail();
    const projectId = detail?.task.project_id ?? this.selectedProjectId();
    if (!detail || !projectId) return;
    void this.taskStore.updateTaskDescription(projectId, detail.task.id, description).then((result) => {
      this.editError.set(result.ok ? null : this.errorText(result.error));
      if (result.ok) this.descriptionEditorOpen.set(false);
    });
  }

  protected statusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }

  protected messageLine(message: DenMessage): string {
    const sender = message.sender ?? 'unknown';
    return `${sender}: ${message.content ?? message.summary ?? ''}`;
  }

  protected errorText(error: { readonly kind: string; readonly message: string } | null): string {
    if (!error) return 'unknown: Unable to load';
    return `${error.kind}: ${error.message}`;
  }

}
