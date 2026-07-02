import { Component, computed, effect, inject } from '@angular/core';
import { MarkdownViewComponent } from '@den-web/components';
import { discussionAuthor, discussionBody, discussionThreads, documentMarkdownBody } from '@den-web/domain';
import type { DenDocumentSummary } from '@den-web/protocol';
import { DOCUMENTS_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';

@Component({
  selector: 'den-documents-panel',
  standalone: true,
  imports: [MarkdownViewComponent],
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .documents {
        display: grid;
        grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
        min-height: 100%;
      }

      .list,
      .detail {
        min-width: 0;
      }

      .list {
        border-right: 1px solid var(--den-border);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
      }

      header {
        border-bottom: 1px solid var(--den-border);
        display: grid;
        gap: 6px;
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

      .muted,
      .state,
      .summary,
      .meta {
        color: var(--den-muted);
        font-size: var(--den-font-size-md);
      }

      .items {
        display: grid;
        gap: 8px;
        overflow: auto;
        padding: 10px;
      }

      .doc-button,
      .section,
      .comment {
        background: var(--den-panel);
        border: 1px solid var(--den-border);
        border-radius: 8px;
      }

      .doc-button {
        appearance: none;
        color: var(--den-text);
        cursor: pointer;
        display: grid;
        gap: 6px;
        min-height: 74px;
        padding: 10px 12px;
        text-align: left;
        width: 100%;
      }

      .doc-button:hover,
      .doc-button:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      .doc-button[aria-pressed='true'] {
        background: var(--den-selected);
        border-color: var(--den-accent);
      }

      .doc-title {
        font-size: var(--den-font-size-md);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
        font-size: var(--den-font-size-xs);
        padding: 2px 7px;
      }

      .detail {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
      }

      .detail-body {
        align-content: start;
        display: grid;
        gap: 14px;
        grid-auto-rows: max-content;
        overflow: auto;
        padding: 18px;
      }

      .section {
        align-content: start;
        display: grid;
        gap: 12px;
        padding: 14px;
      }

      .metadata-section {
        gap: 10px;
      }

      .section-head {
        align-items: start;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }

      .meta-grid {
        align-items: start;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .meta-item {
        border: 1px solid var(--den-border);
        border-radius: 6px;
        box-sizing: border-box;
        display: grid;
        gap: 2px;
        min-width: 118px;
        padding: 7px 9px;
      }

      .label {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
        font-weight: 700;
        text-transform: uppercase;
      }

      .value {
        color: var(--den-text);
        font-size: var(--den-font-size-md);
        overflow-wrap: anywhere;
      }

      .tags-item {
        max-width: 360px;
      }

      .comment {
        display: grid;
        gap: 8px;
        padding: 10px;
      }

      .reply {
        border-left: 2px solid var(--den-border-strong);
        color: var(--den-muted);
        display: grid;
        gap: 4px;
        padding-left: 10px;
      }

      .comment-body {
        white-space: pre-wrap;
      }

      .error {
        color: var(--den-danger);
      }

      @media (max-width: 920px) {
        .documents {
          grid-template-columns: 1fr;
        }

        .list {
          border-bottom: 1px solid var(--den-border);
          border-right: 0;
          min-height: 360px;
        }
      }
    `,
  ],
  template: `
    <section class="documents" aria-label="Documents">
      <aside class="list" aria-label="Document list">
        <header>
          <h2>Documents</h2>
          <div class="muted">{{ selectedProjectId() || 'Select a project' }}</div>
        </header>

        <div class="items">
          @switch (documents().kind) {
            @case ('loading') { <p class="state">Loading documents</p> }
            @case ('error') { <p class="state error">{{ errorText(documentsError()) }}</p> }
            @case ('data') {
              @if (documentItems().length === 0) {
                <p class="state">No documents</p>
              } @else {
                @for (document of documentItems(); track documentIdentity(document)) {
                  <button
                    class="doc-button"
                    type="button"
                    [attr.aria-pressed]="documentIdentity(document) === selectedIdentity()"
                    (click)="select(document)"
                  >
                    <strong class="doc-title">{{ document.title }}</strong>
                    <span class="meta">{{ document.slug }}</span>
                    <span class="chips">
                      @if (document.doc_type) { <span class="chip">{{ document.doc_type }}</span> }
                      @if (document.updated_at) { <span class="chip">{{ shortDate(document.updated_at) }}</span> }
                    </span>
                  </button>
                }
              }
            }
            @default { <p class="state">Select a project</p> }
          }
        </div>
      </aside>

      <article class="detail" aria-label="Document detail">
        @switch (detail().kind) {
          @case ('loading') {
            <div class="detail-body"><p class="state">Loading document</p></div>
          }
          @case ('error') {
            <div class="detail-body"><p class="state error">{{ errorText(detailError()) }}</p></div>
          }
          @case ('data') {
            @let doc = detailValue();
            @if (doc) {
              <header>
                <h3>{{ doc.title }}</h3>
                <div class="meta">{{ doc.project_id }} / {{ doc.slug }}</div>
              </header>

              <div class="detail-body">
                <section class="section metadata-section" aria-label="Document metadata">
                  <div class="meta-grid">
                    <div class="meta-item tags-item">
                      <span class="label">Type</span>
                      <span class="value">{{ doc.doc_type || 'document' }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">Visibility</span>
                      <span class="value">{{ doc.visibility || 'normal' }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">Updated</span>
                      <span class="value">{{ doc.updated_at ? displayDate(doc.updated_at) : 'unknown' }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">Tags</span>
                      <span class="value">{{ tagList(doc.tags) }}</span>
                    </div>
                  </div>
                  @if (doc.summary) {
                    <p class="summary">{{ doc.summary }}</p>
                  }
                </section>

                <section class="section" aria-label="Document content">
                  <div class="section-head">
                    <h3>Content</h3>
                    <span class="muted">{{ body().length }} chars</span>
                  </div>
                  <den-markdown-view [content]="body()" />
                </section>

                <section class="section" aria-label="Discussion">
                  <div class="section-head">
                    <h3>Discussion</h3>
                    <span class="muted">{{ commentCount() }} comments</span>
                  </div>
                  @switch (discussion().kind) {
                    @case ('loading') { <p class="state">Loading discussion</p> }
                    @case ('error') { <p class="state error">{{ errorText(discussionError()) }}</p> }
                    @case ('data') {
                      @if (threads().length === 0) {
                        <p class="state">No discussion comments</p>
                      } @else {
                        @for (thread of threads(); track thread.comment.id) {
                          <article class="comment">
                            <strong>{{ author(thread.comment) }}</strong>
                            <span class="comment-body">{{ commentBody(thread.comment) }}</span>
                            @for (reply of thread.replies; track reply.id) {
                              <div class="reply">
                                <strong>{{ author(reply) }}</strong>
                                <span class="comment-body">{{ commentBody(reply) }}</span>
                              </div>
                            }
                          </article>
                        }
                      }
                    }
                    @default { <p class="state">No document selected</p> }
                  }
                </section>
              </div>
            }
          }
          @default {
            <div class="detail-body"><p class="state">Select a document</p></div>
          }
        }
      </article>
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
  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly documentItems = computed(() => stateValue(this.documents()) ?? []);
  protected readonly detailValue = computed(() => stateValue(this.detail()) ?? null);
  protected readonly body = computed(() => {
    const detail = this.detailValue();
    return detail ? documentMarkdownBody(detail) : '';
  });
  protected readonly threads = computed(() => discussionThreads(stateValue(this.discussion())));
  protected readonly commentCount = computed(() => stateValue(this.discussion())?.comments?.length ?? 0);
  protected readonly selectedIdentity = computed(() => {
    const selected = this.selected();
    return selected ? this.documentIdentity(selected) : null;
  });
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

  protected documentIdentity(document: DenDocumentSummary): string {
    return `${document.project_id}/${document.slug}`;
  }

  protected tagList(tags: readonly string[] | null | undefined): string {
    return tags && tags.length > 0 ? tags.join(', ') : 'none';
  }

  protected displayDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  protected shortDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  protected author = discussionAuthor;
  protected commentBody = discussionBody;

  protected errorText(error: { readonly kind: string; readonly message: string } | null): string {
    return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load';
  }
}

function errorOf<T>(state: { readonly kind: string; readonly error?: T }): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}
