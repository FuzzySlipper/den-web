import { Component, computed, effect, inject, signal } from '@angular/core';
import { MarkdownEditorDialogComponent, MarkdownViewComponent } from '@den-web/components';
import { documentMarkdownBody } from '@den-web/domain';
import type { ClassifiedError, DenDocumentDetail, DenGuidanceEntry, DenGuidanceSource } from '@den-web/protocol';
import { GUIDANCE_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';

const importanceOptions = ['required', 'important'] as const;

@Component({
  selector: 'den-guidance-panel',
  standalone: true,
  imports: [MarkdownEditorDialogComponent, MarkdownViewComponent],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      .guidance {
        display: grid;
        grid-template-columns: minmax(330px, 0.82fr) minmax(460px, 1.18fr);
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      .list,
      .detail {
        min-height: 0;
        min-width: 0;
      }

      .list {
        border-right: 1px solid var(--den-border);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
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

      .state,
      .meta,
      label {
        color: var(--den-muted);
        font-size: var(--den-font-size-md);
      }

      .rows,
      .detail-body {
        min-height: 0;
        overflow: auto;
      }

      .rows {
        display: grid;
        gap: 8px;
        padding: 10px;
      }

      .entry {
        appearance: none;
        background: transparent;
        border: 1px solid var(--den-border);
        border-radius: 8px;
        color: var(--den-text);
        cursor: pointer;
        display: grid;
        gap: 5px;
        padding: 10px;
        text-align: left;
        width: 100%;
      }

      .entry:hover,
      .entry:focus-visible,
      .entry[aria-pressed='true'] {
        background: var(--den-selected);
        border-color: var(--den-accent);
        outline: none;
      }

      .entry strong {
        font-size: var(--den-font-size-md);
        line-height: var(--den-line-height-snug);
        overflow-wrap: anywhere;
      }

      .chips {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .chip {
        border: 1px solid var(--den-border);
        border-radius: 999px;
        color: var(--den-muted);
        display: inline-flex;
        font-size: var(--den-font-size-xs);
        line-height: var(--den-line-height-snug);
        padding: 2px 7px;
      }

      .chip.required {
        border-color: var(--den-warning-border);
        color: var(--den-warning);
      }

      .chip.inherited {
        border-color: var(--den-border-strong);
      }

      .add-form,
      .entry-form,
      .section {
        border-top: 1px solid var(--den-border);
        display: grid;
        gap: 10px;
        padding: 12px;
      }

      .detail-body {
        display: grid;
        gap: 16px;
        padding: 20px;
      }

      .section {
        border: 1px solid var(--den-border);
        border-radius: 8px;
      }

      .section-head {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }

      .section-title {
        color: var(--den-muted);
        display: block;
        font-size: var(--den-font-size-xs);
        font-weight: 700;
        text-transform: uppercase;
      }

      input,
      select,
      textarea {
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        box-sizing: border-box;
        color: var(--den-text);
        font: inherit;
        min-height: 36px;
        min-width: 0;
        padding: 0 10px;
        width: 100%;
      }

      textarea {
        min-height: 72px;
        padding: 8px 10px;
        resize: vertical;
      }

      label {
        display: grid;
        gap: 5px;
      }

      .form-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      button {
        appearance: none;
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        color: var(--den-text);
        cursor: pointer;
        font: inherit;
        min-height: 34px;
        padding: 0 10px;
      }

      button:hover,
      button:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      button.primary {
        background: var(--den-accent);
        border-color: var(--den-accent);
        color: var(--den-accent-contrast);
      }

      button.danger {
        color: var(--den-danger);
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .error {
        color: var(--den-danger);
      }

      @media (max-width: 920px) {
        :host {
          overflow: visible;
        }

        .guidance {
          grid-template-columns: 1fr;
          height: auto;
          overflow: visible;
        }

        .list {
          border-right: 0;
          min-height: 340px;
        }

        .detail-body {
          padding: 14px;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    <section class="guidance" aria-label="Guidance">
      <div class="list">
        <header>
          <h2>Guidance</h2>
          <div class="meta">{{ selectedProjectId() || 'Select a project' }}</div>
        </header>

        <div class="rows" aria-label="Guidance entries">
          @if (!selectedProjectId()) {
            <p class="state">No project selected</p>
          } @else {
            @switch (entries().kind) {
              @case ('idle') { <p class="state">Ready</p> }
              @case ('loading') { <p class="state">Loading guidance</p> }
              @case ('error') { <p class="state error">{{ errorText(entriesError()) }}</p> }
              @case ('data') {
                @if (entryItems().length === 0) {
                  <p class="state">No guidance entries</p>
                } @else {
                  @for (entry of entryItems(); track entry.id) {
                    <button
                      type="button"
                      class="entry"
                      [attr.aria-pressed]="selectedEntry()?.id === entry.id"
                      (click)="selectEntry(entry)"
                    >
                      <strong>{{ sourceTitle(entry) }}</strong>
                      <span class="meta">{{ entry.document_project_id }}/{{ entry.document_slug }}</span>
                      <span class="chips">
                        <span class="chip" [class.required]="entry.importance === 'required'">{{ entry.importance }}</span>
                        <span class="chip" [class.inherited]="isInherited(entry)">{{ isInherited(entry) ? 'inherited' : 'local' }}</span>
                        @if ((entry.audience ?? []).length > 0) {
                          <span class="chip">{{ audienceLabel(entry.audience) }}</span>
                        }
                      </span>
                    </button>
                  }
                }
              }
            }
          }
        </div>

        <form class="add-form" aria-label="Add guidance entry" (submit)="addEntry($event)">
          <strong>Add document</strong>
          <div class="form-grid">
            <label>
              Document project
              <input aria-label="Guidance document project" [value]="addProjectId()" (input)="setAddProjectId($event)" />
            </label>
            <label>
              Document slug
              <input aria-label="Guidance document slug" [value]="addSlug()" (input)="setAddSlug($event)" />
            </label>
            <label>
              Importance
              <select aria-label="New guidance importance" [value]="addImportance()" (change)="setAddImportance($event)">
                @for (importance of importanceValues; track importance) {
                  <option [value]="importance">{{ importance }}</option>
                }
              </select>
            </label>
            <label>
              Sort
              <input type="number" aria-label="New guidance sort order" [value]="addSortOrder()" (input)="setAddSortOrder($event)" />
            </label>
          </div>
          <label>
            Audience
            <input aria-label="New guidance audience" placeholder="all, planner, runner" [value]="addAudience()" (input)="setAddAudience($event)" />
          </label>
          <label>
            Notes
            <textarea aria-label="New guidance notes" [value]="addNotes()" (input)="setAddNotes($event)"></textarea>
          </label>
          <div class="actions">
            <button type="submit" class="primary" [disabled]="!canAdd()">Add to guidance</button>
          </div>
        </form>
      </div>

      <article class="detail" aria-label="Guidance detail">
        <div class="detail-body">
          @if (operationError()) {
            <p class="state error">{{ operationError() }}</p>
          }

          @if (selectedEntry(); as entry) {
            <section class="section" aria-label="Guidance entry metadata">
              <div class="section-head">
                <div>
                  <span class="section-title">Entry</span>
                  <h3>{{ sourceTitle(entry) }}</h3>
                  <div class="meta">{{ entry.project_id }} -> {{ entry.document_project_id }}/{{ entry.document_slug }}</div>
                </div>
              </div>

              @if (canEditEntry(entry)) {
                <div class="entry-form">
                  <div class="form-grid">
                    <label>
                      Importance
                      <select aria-label="Guidance importance" [value]="editImportance()" (change)="setEditImportance($event)">
                        @for (importance of importanceValues; track importance) {
                          <option [value]="importance">{{ importance }}</option>
                        }
                      </select>
                    </label>
                    <label>
                      Sort
                      <input type="number" aria-label="Guidance sort order" [value]="editSortOrder()" (input)="setEditSortOrder($event)" />
                    </label>
                  </div>
                  <label>
                    Audience
                    <input aria-label="Guidance audience" [value]="editAudience()" (input)="setEditAudience($event)" />
                  </label>
                  <label>
                    Notes
                    <textarea aria-label="Guidance notes" [value]="editNotes()" (input)="setEditNotes($event)"></textarea>
                  </label>
                  <div class="actions">
                    <button type="button" class="primary" (click)="saveEntry(entry)">Save entry</button>
                    <button type="button" class="danger" (click)="deleteEntry(entry)">Remove from guidance</button>
                  </div>
                </div>
              } @else {
                <p class="state">Inherited from Global. Select Global in the workspace list to edit this entry.</p>
              }
            </section>

            <section class="section" aria-label="Guidance document">
              <div class="section-head">
                <span class="section-title">Document</span>
                <button type="button" (click)="openEditor()" [disabled]="!selectedDocumentValue()">Edit</button>
              </div>
              @switch (selectedDocument().kind) {
                @case ('idle') { <p class="state">Select a guidance entry</p> }
                @case ('loading') { <p class="state">Loading document</p> }
                @case ('error') { <p class="state error">{{ errorText(documentError()) }}</p> }
                @case ('data') {
                  @if (selectedDocumentValue(); as document) {
                    <den-markdown-view aria-label="Guidance document content" [content]="documentBody(document)" />
                  }
                }
              }
            </section>

            @if (skippedSources().length > 0) {
              <section class="section" aria-label="Skipped guidance sources">
                <span class="section-title">Skipped</span>
                @for (source of skippedSources(); track source.entry_id) {
                  <p class="state">{{ source.document_project_id }}/{{ source.document_slug }} - {{ source.reason }}</p>
                }
              </section>
            }
          } @else {
            <p class="state">Select a guidance entry</p>
          }
        </div>
      </article>

      <den-markdown-editor-dialog
        title="Edit Guidance Document"
        [open]="editorOpen()"
        [value]="editorDraft()"
        (cancel)="closeEditor()"
        (done)="saveDocument($event)"
      />
    </section>
  `,
})
export class GuidancePanelComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly store = inject(GUIDANCE_STORE);
  private loadedProjectId: string | null = null;

  protected readonly importanceValues = importanceOptions;
  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly entries = this.store.entries;
  protected readonly selectedEntry = this.store.selectedEntry;
  protected readonly selectedDocument = this.store.selectedDocument;
  protected readonly entryItems = computed(() => stateValue(this.entries()) ?? []);
  protected readonly selectedDocumentValue = computed(() => stateValue(this.selectedDocument()) ?? null);
  protected readonly entriesError = computed(() => errorOf(this.entries()));
  protected readonly documentError = computed(() => errorOf(this.selectedDocument()));
  protected readonly skippedSources = computed(() => stateValue(this.store.packet())?.skipped_sources ?? []);
  protected readonly operationError = signal<string | null>(null);
  protected readonly editorOpen = signal(false);
  protected readonly editorDraft = signal('');

  protected readonly addProjectId = signal('');
  protected readonly addSlug = signal('');
  protected readonly addImportance = signal<(typeof importanceOptions)[number]>('important');
  protected readonly addAudience = signal('');
  protected readonly addSortOrder = signal(100);
  protected readonly addNotes = signal('');

  protected readonly editImportance = signal<(typeof importanceOptions)[number]>('important');
  protected readonly editAudience = signal('');
  protected readonly editSortOrder = signal(0);
  protected readonly editNotes = signal('');

  private readonly projectRefreshEffect = effect(() => {
    const projectId = this.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    this.addProjectId.set(projectId);
    queueMicrotask(() => void this.store.refresh(projectId));
  });

  private readonly autoSelectEffect = effect(() => {
    if (this.selectedEntry()) return;
    const first = this.entryItems()[0];
    if (!first) return;
    queueMicrotask(() => void this.selectEntry(first));
  });

  protected selectEntry(entry: DenGuidanceEntry): void {
    this.editImportance.set(entry.importance === 'required' ? 'required' : 'important');
    this.editAudience.set(this.audienceLabel(entry.audience));
    this.editSortOrder.set(entry.sort_order);
    this.editNotes.set(entry.notes ?? '');
    this.operationError.set(null);
    void this.store.selectEntry(entry);
  }

  protected sourceTitle(entry: DenGuidanceEntry): string {
    const source = this.sourceFor(entry);
    return source?.document_title || entry.document_slug;
  }

  protected sourceFor(entry: DenGuidanceEntry): DenGuidanceSource | null {
    return stateValue(this.store.packet())?.sources?.find((source) => source.entry_id === entry.id) ?? null;
  }

  protected isInherited(entry: DenGuidanceEntry): boolean {
    return entry.project_id !== this.selectedProjectId();
  }

  protected canEditEntry(entry: DenGuidanceEntry): boolean {
    return entry.project_id === this.selectedProjectId();
  }

  protected audienceLabel(audience: readonly string[] | null | undefined): string {
    return normalizeAudience(audience ?? []).join(', ');
  }

  protected canAdd(): boolean {
    return Boolean(this.selectedProjectId() && this.addProjectId().trim() && this.addSlug().trim());
  }

  protected addEntry(event: Event): void {
    event.preventDefault();
    const projectId = this.selectedProjectId();
    if (!projectId || !this.canAdd()) return;
    void this.store.addEntry(projectId, {
      document_project_id: this.addProjectId().trim(),
      document_slug: this.addSlug().trim(),
      importance: this.addImportance(),
      audience: splitAudience(this.addAudience()),
      sort_order: this.addSortOrder(),
      notes: this.addNotes().trim(),
    }).then((result) => {
      this.operationError.set(result.ok ? null : this.errorText(result.error));
      if (result.ok) {
        this.addSlug.set('');
        this.addNotes.set('');
      }
    });
  }

  protected saveEntry(entry: DenGuidanceEntry): void {
    const projectId = this.selectedProjectId();
    if (!projectId || !this.canEditEntry(entry)) return;
    void this.store.saveEntry(projectId, entry, {
      importance: this.editImportance(),
      audience: splitAudience(this.editAudience()),
      sortOrder: this.editSortOrder(),
      notes: this.editNotes().trim(),
    }).then((result) => {
      this.operationError.set(result.ok ? null : this.errorText(result.error));
    });
  }

  protected deleteEntry(entry: DenGuidanceEntry): void {
    const projectId = this.selectedProjectId();
    if (!projectId || !this.canEditEntry(entry)) return;
    void this.store.deleteEntry(projectId, entry).then((result) => {
      this.operationError.set(result.ok ? null : this.errorText(result.error));
    });
  }

  protected openEditor(): void {
    const document = this.selectedDocumentValue();
    if (!document) return;
    this.editorDraft.set(this.documentBody(document));
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
  }

  protected saveDocument(contentMarkdown: string): void {
    void this.store.updateSelectedDocumentContent(contentMarkdown).then((result) => {
      this.operationError.set(result.ok ? null : this.errorText(result.error));
      if (result.ok) this.editorOpen.set(false);
    });
  }

  protected documentBody(document: DenDocumentDetail): string {
    return documentMarkdownBody(document);
  }

  protected setAddProjectId(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.addProjectId.set(target.value);
  }

  protected setAddSlug(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.addSlug.set(target.value);
  }

  protected setAddImportance(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.addImportance.set(toImportance(target.value));
  }

  protected setAddAudience(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.addAudience.set(target.value);
  }

  protected setAddSortOrder(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.addSortOrder.set(Number.parseInt(target.value, 10) || 0);
  }

  protected setAddNotes(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) this.addNotes.set(target.value);
  }

  protected setEditImportance(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.editImportance.set(toImportance(target.value));
  }

  protected setEditAudience(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.editAudience.set(target.value);
  }

  protected setEditSortOrder(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.editSortOrder.set(Number.parseInt(target.value, 10) || 0);
  }

  protected setEditNotes(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) this.editNotes.set(target.value);
  }

  protected errorText(error: ClassifiedError | null): string {
    if (!error) return 'unknown: Unable to load';
    return `${error.kind}: ${error.message}`;
  }
}

function splitAudience(value: string): readonly string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function normalizeAudience(audience: readonly string[]): readonly string[] {
  if (audience.length !== 1) return audience;
  const first = audience[0];
  if (first === undefined) return audience;
  const raw = first.trim();
  if (!raw.startsWith('[')) return audience;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStringArray(parsed) ? parsed : audience;
  } catch {
    return audience;
  }
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

function toImportance(value: string): (typeof importanceOptions)[number] {
  return value === 'required' ? 'required' : 'important';
}

function errorOf(state: { readonly kind: string; readonly error?: ClassifiedError }): ClassifiedError | null {
  return state.kind === 'error' ? state.error ?? null : null;
}
