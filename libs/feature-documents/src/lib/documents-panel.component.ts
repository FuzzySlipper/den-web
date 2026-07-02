import { Component, computed, effect, inject } from '@angular/core';
import { discussionAuthor, discussionBody, discussionThreads, documentMarkdownBody } from '@den-web/domain';
import type { DenDocumentSummary } from '@den-web/protocol';
import { DOCUMENTS_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';

@Component({
  selector: 'den-documents-panel',
  standalone: true,
  styles: [`
    .surface { display: grid; gap: 14px; padding: 20px; }
    h2 { margin: 0; font-size: var(--den-font-size-xl); }
    .grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 14px; }
    .panel, .doc { background: var(--den-panel); border: 1px solid var(--den-border); border-radius: 8px; }
    .panel { padding: 12px; display: grid; gap: 10px; }
    .doc { padding: 10px; text-align: left; }
    button.doc[aria-pressed='true'] { background: var(--den-selected); border-color: var(--den-accent); }
    textarea { min-height: 180px; border: 1px solid var(--den-border); border-radius: 6px; padding: 10px; font: inherit; }
    .muted, .state { color: var(--den-muted); font-size: var(--den-font-size-md); }
    .error { color: var(--den-danger); }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `],
  template: `
    <section class="surface" aria-label="Documents">
      <h2>Documents</h2>
      <div class="grid">
        <aside class="panel">
          <strong>Documents</strong>
          @switch (documents().kind) {
            @case ('loading') { <p class="state">Loading documents</p> }
            @case ('error') { <p class="state error">{{ errorText(documentsError()) }}</p> }
            @case ('data') {
              @if (documentItems().length === 0) { <p class="state">No documents</p> }
              @for (document of documentItems(); track document.slug) {
                <button class="doc" type="button" [attr.aria-pressed]="document.slug === selected()?.slug" (click)="select(document)">
                  <strong>{{ document.title }}</strong>
                  <span class="muted">{{ document.slug }}</span>
                </button>
              }
            }
            @default { <p class="state">Select a project</p> }
          }
        </aside>
        <div class="panel">
          <strong>Detail</strong>
          @if (dirty()) { <p class="state">Unsaved edit guard is active</p> }
          @switch (detail().kind) {
            @case ('loading') { <p class="state">Loading document</p> }
            @case ('error') { <p class="state error">{{ errorText(detailError()) }}</p> }
            @case ('data') {
              <strong>{{ detailValue()?.title }}</strong>
              <textarea aria-label="Document Markdown" [value]="body()" (input)="setDirty()"></textarea>
              <p class="muted">Discussion is separate from canonical Markdown.</p>
            }
            @default { <p class="state">Select a document</p> }
          }
          <strong>Discussion</strong>
          @switch (discussion().kind) {
            @case ('loading') { <p class="state">Loading discussion</p> }
            @case ('error') { <p class="state error">{{ errorText(discussionError()) }}</p> }
            @case ('data') {
              @if (threads().length === 0) { <p class="state">No discussion comments</p> }
              @for (thread of threads(); track thread.comment.id) {
                <article class="doc">
                  <strong>{{ author(thread.comment) }}</strong>
                  <span class="muted">{{ commentBody(thread.comment) }}</span>
                  @for (reply of thread.replies; track reply.id) {
                    <div class="muted">Reply from {{ author(reply) }}: {{ commentBody(reply) }}</div>
                  }
                </article>
              }
            }
            @default { <p class="state">Discussion appears after selecting a document</p> }
          }
          <strong>Publish</strong>
          <p class="state">Publish panel ready for successor document publish route.</p>
        </div>
      </div>
    </section>
  `,
})
export class DocumentsPanelComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly store = inject(DOCUMENTS_STORE);
  private loadedProjectId: string | null = null;
  protected readonly documents = this.store.documents;
  protected readonly detail = this.store.detail;
  protected readonly discussion = this.store.discussion;
  protected readonly selected = this.store.selected;
  protected readonly dirty = this.store.dirty;
  protected readonly documentItems = computed(() => stateValue(this.documents()) ?? []);
  protected readonly detailValue = computed(() => stateValue(this.detail()) ?? null);
  protected readonly body = computed(() => {
    const detail = this.detailValue();
    return detail ? documentMarkdownBody(detail) : '';
  });
  protected readonly threads = computed(() => discussionThreads(stateValue(this.discussion())));
  protected readonly documentsError = computed(() => errorOf(this.documents()));
  protected readonly detailError = computed(() => errorOf(this.detail()));
  protected readonly discussionError = computed(() => errorOf(this.discussion()));

  private readonly refreshEffect = effect(() => {
    const projectId = this.workspace.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    queueMicrotask(() => void this.store.refresh(projectId));
  });

  private readonly autoSelectEffect = effect(() => {
    const first = this.documentItems()[0];
    if (!first || this.selected()) return;
    queueMicrotask(() => void this.store.select(first));
  });

  protected select(document: DenDocumentSummary): void {
    void this.store.select(document);
  }
  protected setDirty(): void { this.store.setDirty(true); }
  protected author = discussionAuthor;
  protected commentBody = discussionBody;
  protected errorText(error: { readonly kind: string; readonly message: string } | null): string { return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load'; }
}

function errorOf<T>(state: { readonly kind: string; readonly error?: T }): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}
